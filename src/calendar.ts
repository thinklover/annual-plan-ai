import type { Plan, PlanItem } from './types'

/** 年度行事曆：營運與活動項目自動連動，再加上手動新增的未連動項目 */
export function calendarRows(p: Plan) {
  const linked = (items: PlanItem[], category: string) =>
    items.filter((i) => i.name.trim()).map((i) => ({ id: i.id, category, name: i.name, months: i.months, note: '', linked: true }))
  return [
    ...linked(p.operations, '營運'),
    ...linked(p.activities, '活動'),
    ...p.calendarManual.map((c) => ({ ...c, linked: false })),
  ]
}
