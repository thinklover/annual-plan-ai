-- 居家評鑑資料系統：資料表與存取規則（可重複執行）
-- 每個登入帳號一份資料，彼此看不到；未登入完全不能讀寫。

-- 文字資料：一個帳號一個區塊一列（org、employees、capacity、plans、meetings…）
create table if not exists public.eval_docs (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  data jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (owner, key)
);

-- 照片：縮圖後的 JPEG（data URL）
create table if not exists public.eval_photos (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  data_url text not null,
  w integer not null,
  h integer not null,
  created_at timestamptz not null default now(),
  primary key (owner, id)
);

alter table public.eval_docs enable row level security;
alter table public.eval_photos enable row level security;

drop policy if exists eval_docs_owner on public.eval_docs;
create policy eval_docs_owner on public.eval_docs
  for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

drop policy if exists eval_photos_owner on public.eval_photos;
create policy eval_photos_owner on public.eval_photos
  for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

revoke all on public.eval_docs, public.eval_photos from anon, authenticated;
grant select, insert, update, delete on public.eval_docs, public.eval_photos to authenticated;

-- 提交：一次交易內寫入多個區塊。每個區塊帶著讀取時的版本號，
-- 版本對不上（別人先提交了）就整筆不寫，回報 conflict。
create or replace function public.eval_save(changes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  k text;
  item jsonb;
  cur integer;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  for k, item in select * from jsonb_each(changes) loop
    select version into cur from eval_docs where owner = uid and key = k for update;
    if coalesce(cur, 0) <> coalesce((item ->> 'version')::integer, 0) then
      raise exception 'conflict:%', k;
    end if;
    insert into eval_docs (owner, key, data, version)
    values (uid, k, item -> 'data', 1)
    on conflict (owner, key) do update
      set data = excluded.data, version = eval_docs.version + 1, updated_at = now();
  end loop;
  return coalesce((select jsonb_object_agg(d.key, d.version) from eval_docs d where d.owner = uid), '{}'::jsonb);
end
$$;

revoke all on function public.eval_save(jsonb) from public, anon;
grant execute on function public.eval_save(jsonb) to authenticated;
