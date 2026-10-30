import type { ReactNode } from 'react'
import {
  DEFAULT_BASIS, makeTitle, newCal, newCash, newContent, newFee, newNamed, newPlanItem, newRole, newStaff, newTarget,
  PERSPECTIVES, TPL_ACTIVITIES, TPL_CASH, TPL_FEES, TPL_OPERATIONS, TPL_ROLES, TPL_SERVICE_CONTENT,
  TPL_SERVICE_TARGETS, TPL_SERVICES, TPL_TARGETS, TPL_VISION,
} from '../defaults'
import { useEditor } from '../editor'
import { calendarRows } from '../calendar'
import type { Plan } from '../types'
import { isBlank, num } from '../util'
import { ListField, TextField } from './Field'
import { MonthPicker, TableEditor, type TCol } from './TableEditor'

function Tools({ children }: { children: ReactNode }) {
  const { locked } = useEditor()
  if (locked) return null
  return <div className="tools">{children}</div>
}

/** 套用範本：區塊已有內容時先詢問 */
function useTemplate() {
  const { update } = useEditor()
  return (current: unknown, apply: (d: Plan) => void, metaKeys: string[]) => {
    if (!isBlank(current) && !window.confirm('此區已有內容，套用範本會覆蓋，確定嗎？')) return
    update((d) => {
      apply(d)
      for (const k of metaKeys) delete d.meta[k]
    })
  }
}

const years = (p: Plan) => {
  const y = num(p.basic.planYear)
  return { y: y || '本', prev: y ? y - 1 : '前一' }
}

function Basic() {
  const { plan, update } = useEditor()
  return (
    <>
      <Tools>
        <button type="button" className="btn tiny ghost"
          onClick={() => update((d) => { d.basic.title = makeTitle(d) }, 'basic.title')}>
          重新產生文件標題
        </button>
      </Tools>
      <div className="cover">
        <div className="cover-org">{plan.basic.orgName || '○○機構'}</div>
        <div className="cover-title">{plan.basic.planYear || '○○○'} 年度業務計畫書</div>
        <div className="cover-date">{plan.basic.madeYear} 年 {plan.basic.madeMonth} 月制定</div>
      </div>
      <div className="grid2">
        <TextField path="basic.orgName" label="機構名稱" required />
        <TextField path="basic.planYear" label="計畫年度（民國年）" required placeholder="例如 115" />
        <TextField path="basic.title" label="文件標題" placeholder={makeTitle(plan)} />
        <TextField path="basic.madeYear" label="制定年（民國年）" />
        <TextField path="basic.madeMonth" label="制定月" />
        <TextField path="basic.serviceType" label="服務類型" required placeholder="例如 日間照顧服務" />
        <TextField path="basic.city" label="縣市" required />
        <TextField path="basic.district" label="行政區" required />
        <TextField path="basic.address" label="地址" />
        <TextField path="basic.approvalDate" label="立案核准日期" placeholder="民國年/月/日" />
        <TextField path="basic.openDate" label="開始營運日期" placeholder="民國年/月/日" />
        <TextField path="basic.versionDate" label="版本日期" placeholder="民國年/月/日" />
      </div>
    </>
  )
}

function Basis() {
  const { update } = useEditor()
  return (
    <>
      <Tools>
        <button type="button" className="btn tiny ghost" onClick={() => update((d) => { d.basis = DEFAULT_BASIS }, 'basis')}>
          還原預設文字
        </button>
      </Tools>
      <TextField path="basis" label="依據文字" multiline rows={3} />
    </>
  )
}

function Vision() {
  const { plan } = useEditor()
  const tpl = useTemplate()
  return (
    <>
      <Tools>
        <button type="button" className="btn tiny ghost"
          onClick={() => tpl(plan.vision, (d) => { d.vision = structuredClone(TPL_VISION) },
            ['vision.vision', 'vision.mission', 'vision.coreValues'])}>
          套用範本文字
        </button>
      </Tools>
      <TextField path="vision.vision" label="願景" multiline rows={2} help="機構希望長期達成的理想樣貌，一句話即可。" />
      <TextField path="vision.mission" label="使命" multiline rows={2} help="機構為了達成願景，日常持續在做的事。" />
      <ListField path="vision.coreValues" label="核心價值" help="機構共同遵循的價值，建議 3～5 項。" />
    </>
  )
}

function So() {
  return (
    <>
      {PERSPECTIVES.map((p) => (
        <div className="so-row" key={p.key}>
          <div className="so-head">
            <strong>{p.label}</strong>
            <span className="help">{p.hint}</span>
          </div>
          <div className="grid3">
            <TextField path={`so.${p.key}.s`} label="內部優勢 S" multiline rows={5} />
            <TextField path={`so.${p.key}.o`} label="外部機會 O" multiline rows={5} />
            <TextField path={`so.${p.key}.goal`} label="目標" multiline rows={5} required
              help="第一行寫目標標題，其後條列可衡量的具體目標。" />
          </div>
        </div>
      ))}
      <TextField path="so.note" label="SO 計分卡說明" multiline rows={3} />
    </>
  )
}

function Okr() {
  const { plan } = useEditor()
  return (
    <>
      <TextField path="okr.o" label="年度目標 O" multiline rows={2} required help="今年最重要的成果方向，一句清楚、具方向性的描述。" />
      <div className="grid2">
        <TextField path="okr.q1" label="Q1 第一季目標" multiline rows={3} required help="第一階段要優先完成什麼？" />
        <TextField path="okr.q2" label="Q2 第二季目標" multiline rows={3} required help="延續第一季，要建立或推進什麼？" />
        <TextField path="okr.q3" label="Q3 第三季目標" multiline rows={3} required help="下半年要深化、改善或導入什麼？" />
        <TextField path="okr.q4" label="Q4 第四季目標" multiline rows={3} required help="年底前要完成什麼成果或檢討？" />
      </div>
      <div className="okr-overview">
        <div><b>年度 O</b>{plan.okr.o || '尚未設定'}</div>
        {(['q1', 'q2', 'q3', 'q4'] as const).map((q, i) => (
          <div key={q}><b>第{'一二三四'[i]}季</b>{plan.okr[q] || '尚未設定'}</div>
        ))}
      </div>
    </>
  )
}

function NamedList({ path, label, tplList }: { path: 'services' | 'targets'; label: string; tplList: string[] }) {
  const { plan } = useEditor()
  const tpl = useTemplate()
  return (
    <>
      <Tools>
        <button type="button" className="btn tiny ghost"
          onClick={() => tpl(plan[path], (d) => { d[path] = tplList.map((n) => newNamed(n)) }, [path])}>
          套用預設{label}
        </button>
      </Tools>
      <TableEditor path={path} metaKey={path} sortable={path === 'services'} addLabel={`新增${label}`}
        cols={[{ key: 'enabled', label: '啟用', type: 'bool', width: '4em' }, { key: 'name', label }]} />
    </>
  )
}

function Staff() {
  const { plan, update, locked } = useEditor()
  const tpl = useTemplate()
  const { y, prev } = years(plan)
  const roleNames = plan.roles.map((r) => r.name).filter(Boolean)
  const generate = () =>
    update((d) => {
      const have = new Set(d.staffing.map((s) => s.title.trim()))
      for (const r of d.roles) if (r.enabled && r.name.trim() && !have.has(r.name.trim())) d.staffing.push(newStaff({ title: r.name.trim() }))
    }, 'staffing')
  return (
    <>
      <Tools>
        <button type="button" className="btn tiny ghost"
          onClick={() => tpl(plan.roles, (d) => { d.roles = TPL_ROLES.map(([n, p]) => newRole(n, p)) }, ['roles'])}>
          套用日照預設人力角色
        </button>
      </Tools>
      <h4>人力角色設定</h4>
      <TableEditor path="roles" metaKey="roles" addLabel="新增角色"
        cols={[
          { key: 'enabled', label: '啟用', type: 'bool', width: '4em' },
          { key: 'name', label: '角色名稱' },
          { key: 'parent', label: '上層角色', type: 'select', options: roleNames },
        ]} />
      <OrgTree plan={plan} />
      <h4>人事編列</h4>
      {!locked && (
        <div className="tools">
          <button type="button" className="btn tiny ghost" onClick={generate} disabled={!plan.roles.length}>
            由角色產生人事編列
          </button>
        </div>
      )}
      <TableEditor path="staffing" metaKey="staffing" addLabel="新增職稱"
        cols={[
          { key: 'title', label: '職稱' },
          { key: 'prevCount', label: `${prev}年聘用人數`, type: 'number', width: '8em' },
          { key: 'planCount', label: `${y}年擬聘用人數`, type: 'number', width: '8em' },
          { key: 'duty', label: '職務說明', type: 'textarea' },
        ]} />
    </>
  )
}

function OrgTree({ plan }: { plan: Plan }) {
  const roles = plan.roles.filter((r) => r.enabled && r.name.trim())
  if (!roles.length) return null
  const names = new Set(roles.map((r) => r.name))
  const children = (parent: string, depth: number): ReactNode =>
    depth > 8 ? null : (
      <ul>
        {roles
          .filter((r) => (parent ? r.parent === parent : !r.parent || !names.has(r.parent)))
          .map((r) => (
            <li key={r.id}>
              <span className="node">{r.name}</span>
              {children(r.name, depth + 1)}
            </li>
          ))}
      </ul>
    )
  return (
    <div className="org">
      <div className="help">組織架構（依上層角色自動繪製）</div>
      {children('', 0)}
    </div>
  )
}

function ServiceContent() {
  const { plan } = useEditor()
  const tpl = useTemplate()
  return (
    <>
      <Tools>
        <button type="button" className="btn tiny ghost"
          onClick={() => tpl(plan.serviceContent, (d) => {
            d.serviceContent = TPL_SERVICE_CONTENT.map(([item, content]) => newContent({ item, content }))
          }, ['serviceContent'])}>
          套用預設服務內容表
        </button>
      </Tools>
      <TableEditor path="serviceContent" metaKey="serviceContent" sortable addLabel="新增服務內容" empty="尚無服務內容。"
        cols={[{ key: 'item', label: '服務項目', width: '14em' }, { key: 'content', label: '服務內容說明', type: 'textarea' }]} />
    </>
  )
}

function Satisfaction() {
  return (
    <>
      <TextField path="satisfaction.year" label="調查年度（民國年）" />
      <TextField path="satisfaction.analysis" label="滿意度分析結果" multiline required />
      <TextField path="satisfaction.issues" label="主要待改善題項" multiline rows={3} />
      <TextField path="satisfaction.improvement" label="改善方案" multiline required />
      <TextField path="satisfaction.strategy" label="本年度策略" multiline rows={3} />
    </>
  )
}

function PlanItems({ path, tplList, label }: { path: 'operations' | 'activities'; tplList: [string, string, number[]][]; label: string }) {
  const { plan } = useEditor()
  const tpl = useTemplate()
  return (
    <>
      <Tools>
        <button type="button" className="btn tiny ghost"
          onClick={() => tpl(plan[path], (d) => {
            d[path] = tplList.map(([name, desc, months]) => newPlanItem({ name, desc, months }))
          }, [path])}>
          套用預設項目
        </button>
      </Tools>
      <TableEditor path={path} metaKey={path} sortable addLabel={`新增${label}`}
        cols={[
          { key: 'name', label: '項目名稱', width: '12em' },
          { key: 'desc', label: '說明', type: 'textarea' },
          { key: 'months', label: '執行月份', type: 'months', width: '15em' },
        ]} />
    </>
  )
}

function ServiceTargets() {
  const { plan } = useEditor()
  const tpl = useTemplate()
  const { y, prev } = years(plan)
  return (
    <>
      <Tools>
        <button type="button" className="btn tiny ghost"
          onClick={() => tpl(plan.serviceTargets, (d) => {
            d.serviceTargets = TPL_SERVICE_TARGETS.map((item) => newTarget({ item }))
          }, ['serviceTargets'])}>
          套用預設服務項目
        </button>
      </Tools>
      <TableEditor path="serviceTargets" metaKey="serviceTargets" addLabel="新增服務項目"
        cols={[
          { key: 'item', label: '服務項目' },
          { key: 'prevCount', label: `${prev}年服務累積人次`, type: 'number', width: '10em' },
          { key: 'target', label: `${y}年目標服務人次`, type: 'number', width: '10em' },
        ]} />
    </>
  )
}

function Calendar() {
  const { plan, update, locked } = useEditor()
  const { y } = years(plan)
  const rows = calendarRows(plan)
  const setManual = (id: string, fn: (c: Plan['calendarManual'][number]) => void) =>
    update((d) => {
      const c = d.calendarManual.find((x) => x.id === id)
      if (c) fn(c)
    })
  return (
    <>
      <div className="help">營運與活動項目會自動連動；如需手動新增，該項目會標示為「未連動」，請確認是否仍需納入。</div>
      <div className="table-wrap">
        <table className="grid cal">
          <thead>
            <tr>
              <th>類別</th>
              <th>項目名稱</th>
              {Array.from({ length: 12 }, (_, i) => <th key={i} className="mcol">{y}/{i + 1}</th>)}
              <th>備註</th>
              <th>來源</th>
              {!locked && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.linked ? '' : 'unlinked'}>
                <td>
                  {r.linked ? r.category : (
                    <input value={r.category} disabled={locked} onChange={(e) => setManual(r.id, (c) => { c.category = e.target.value })} />
                  )}
                </td>
                <td>
                  {r.linked ? r.name : (
                    <input value={r.name} disabled={locked} onChange={(e) => setManual(r.id, (c) => { c.name = e.target.value })} />
                  )}
                </td>
                {r.linked
                  ? Array.from({ length: 12 }, (_, i) => <td key={i} className="mcol">{r.months.includes(i + 1) ? '●' : ''}</td>)
                  : (
                    <td colSpan={12}>
                      <MonthPicker value={r.months} disabled={locked} onChange={(v) => setManual(r.id, (c) => { c.months = v })} />
                    </td>
                  )}
                <td>
                  {r.linked ? '' : (
                    <input value={r.note} disabled={locked} onChange={(e) => setManual(r.id, (c) => { c.note = e.target.value })} />
                  )}
                </td>
                <td><span className={r.linked ? 'chip ok' : 'chip warn'}>{r.linked ? '已連動' : '未連動'}</span></td>
                {!locked && (
                  <td>
                    {!r.linked && (
                      <button type="button" className="icon" title="刪除"
                        onClick={() => update((d) => { d.calendarManual = d.calendarManual.filter((c) => c.id !== r.id) })}>✕</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!locked && (
        <button type="button" className="btn tiny ghost" onClick={() => update((d) => { d.calendarManual.push(newCal()) })}>
          + 新增未連動項目
        </button>
      )}
    </>
  )
}

function Fees() {
  const { plan } = useEditor()
  const tpl = useTemplate()
  return (
    <>
      <div className="notice">收費基準涉及最新法規與地方主管機關規定，範例僅供參考。匯出或送審前，請自行確認是否符合最新規定。</div>
      <Tools>
        <button type="button" className="btn tiny ghost"
          onClick={() => tpl(plan.fees, (d) => {
            d.fees = TPL_FEES.map(([item, amount, unit, note]) => newFee({ item, amount, unit, note }))
          }, ['fees'])}>
          套用收費基準範例
        </button>
      </Tools>
      <TableEditor path="fees" metaKey="fees" sortable addLabel="新增收費項目"
        cols={[
          { key: 'item', label: '收費項目' }, { key: 'amount', label: '金額' },
          { key: 'unit', label: '單位', width: '6em' }, { key: 'note', label: '備註', type: 'textarea' },
        ]} />
    </>
  )
}

function PettyCash() {
  const { plan } = useEditor()
  const tpl = useTemplate()
  const total = plan.pettyCash.reduce((s, r) => s + num(r.monthly), 0)
  return (
    <>
      <Tools>
        <button type="button" className="btn tiny ghost"
          onClick={() => tpl(plan.pettyCash, (d) => {
            d.pettyCash = TPL_CASH.map(([item, content, monthly]) => newCash({ item, content, monthly }))
          }, ['pettyCash'])}>
          套用零用金預算範例
        </button>
      </Tools>
      <TableEditor path="pettyCash" metaKey="pettyCash" addLabel="新增項次" empty="尚無項次，可先套用範例或新增項次。"
        cols={[
          { key: 'item', label: '經費項目' }, { key: 'content', label: '預算內容' },
          { key: 'monthly', label: '每月預算（元）', type: 'number', width: '9em' },
          { key: 'annual', label: '年度預算（元）', width: '9em', render: (r) => (num(r.monthly) * 12).toLocaleString() },
        ]}
        footer={
          <tfoot>
            <tr>
              <td /><td colSpan={2}><b>合計</b></td>
              <td><b>{total.toLocaleString()}</b></td>
              <td><b>{(total * 12).toLocaleString()}</b></td>
              <td />
            </tr>
          </tfoot>
        } />
    </>
  )
}

const RESULT_COLS: TCol[] = [
  { key: 'name', label: '項目名稱', readOnly: true, width: '10em' },
  { key: 'result', label: '執行成果', type: 'textarea' },
  { key: 'participants', label: '參與人次', width: '6em' },
  { key: 'rate', label: '達成率', width: '6em' },
  { key: 'improvement', label: '檢討與改善', type: 'textarea' },
]

function Results({ path }: { path: 'operations' | 'activities' }) {
  return (
    <TableEditor path={path} metaKey={`results.${path}`} fixedRows cols={RESULT_COLS}
      empty={`請先在「${path === 'operations' ? '機構營運管理計畫' : '個案活動管理計畫'}」建立項目。`} />
  )
}

function Hiring() {
  const { plan } = useEditor()
  const { y } = years(plan)
  return (
    <TableEditor path="staffing" metaKey="results.staffing" fixedRows empty="請先在「人事編列」建立職稱。"
      cols={[
        { key: 'title', label: '職稱', readOnly: true },
        { key: 'planCount', label: `${y}年原先擬聘用人數（由人事編列帶入）`, readOnly: true },
        { key: 'actualCount', label: `${y}年實際聘用人數`, type: 'number', width: '9em' },
        {
          key: 'status', label: '比較',
          render: (r) => (isBlank(r.actualCount) ? '' : num(r.actualCount) === num(r.planCount) ? '符合原規劃' : `差 ${num(r.actualCount) - num(r.planCount)} 人`),
        },
      ]} />
  )
}

function TargetResults() {
  const { plan } = useEditor()
  const { y } = years(plan)
  return (
    <TableEditor path="serviceTargets" metaKey="results.serviceTargets" fixedRows empty="請先在「服務目標人數／人次」建立服務項目。"
      cols={[
        { key: 'item', label: '服務項目', readOnly: true },
        { key: 'target', label: `${y}年目標人次`, readOnly: true },
        { key: 'actual', label: `${y}年實際人次`, type: 'number', width: '9em' },
        {
          key: 'rate', label: '達成率',
          render: (r) => (num(r.target) && !isBlank(r.actual) ? `${Math.round((num(r.actual) / num(r.target)) * 100)}%` : ''),
        },
      ]} />
  )
}

export const BLOCK_BODY: Record<string, () => ReactNode> = {
  basic: Basic,
  basis: Basis,
  vision: Vision,
  so: So,
  okr: Okr,
  services: () => <NamedList path="services" label="服務項目" tplList={TPL_SERVICES} />,
  targets: () => <NamedList path="targets" label="服務對象" tplList={TPL_TARGETS} />,
  staff: Staff,
  serviceContent: ServiceContent,
  satisfaction: Satisfaction,
  operations: () => <PlanItems path="operations" tplList={TPL_OPERATIONS} label="營運管理項目" />,
  activities: () => <PlanItems path="activities" tplList={TPL_ACTIVITIES} label="活動項目" />,
  serviceTargets: ServiceTargets,
  calendar: Calendar,
  fees: Fees,
  pettyCash: PettyCash,
  resultsOps: () => <Results path="operations" />,
  resultsActs: () => <Results path="activities" />,
  hiring: Hiring,
  targetResults: TargetResults,
}
