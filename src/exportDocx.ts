import {
  AlignmentType, BorderStyle, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx'
import { blockById } from './blocks'
import { buildPlanDoc, type DocNode } from './planDoc'
import type { InterviewScript } from './scripts'
import type { Plan } from './types'
import { download } from './util'

// 標楷體中文、Times New Roman 英數，12pt、1.5 倍行高
const STYLES = {
  default: {
    document: {
      run: { font: { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: '標楷體' }, size: 24 },
      paragraph: { spacing: { line: 360, after: 60 } },
    },
  },
}

const p = (text: string, opts: { bold?: boolean; size?: number; center?: boolean; indent?: boolean } = {}) =>
  new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    indent: opts.indent ? { left: 480 } : undefined,
    children: [new TextRun({ text, bold: opts.bold, size: opts.size })],
  })

const h2 = (text: string) => new Paragraph({ spacing: { before: 360, after: 120 }, children: [new TextRun({ text, bold: true, size: 28 })] })
const h3 = (text: string) => new Paragraph({ spacing: { before: 160, after: 60 }, children: [new TextRun({ text, bold: true })] })

const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' }

function table(headers: string[], rows: string[][]) {
  const cell = (t: string, bold = false) =>
    new TableCell({
      borders: { top: border, bottom: border, left: border, right: border },
      children: (t || '').split('\n').map((l) => new Paragraph({ spacing: { line: 300, after: 0 }, children: [new TextRun({ text: l, bold, size: 22 })] })),
    })
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h) => cell(h, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((c) => cell(c)) })),
    ],
  })
}

function render(n: DocNode): Paragraph | Table {
  if (n.t === 'h3') return h3(n.text)
  if (n.t === 'p') return p(n.text, { indent: true })
  return table(n.headers, n.rows)
}

export async function exportPlanDocx(plan: Plan) {
  const d = buildPlanDoc(plan)
  const children: (Paragraph | Table)[] = [
    new Paragraph({ spacing: { before: 2400 } }),
    p(d.orgName, { bold: true, size: 36, center: true }),
    p(d.yearLine, { bold: true, size: 44, center: true }),
    p(d.madeLine, { center: true }),
    new Paragraph({ pageBreakBefore: true }),
  ]
  for (const sec of d.sections) children.push(h2(sec.heading), ...sec.nodes.map(render))
  const doc = new Document({ styles: STYLES, title: d.title, sections: [{ children }] })
  download(`${d.title}.docx`, await Packer.toBlob(doc))
}

export async function exportScriptDocx(script: InterviewScript, plan: Plan) {
  const children: Paragraph[] = [
    p(script.title, { bold: true, size: 32, center: true }),
    p(`${plan.basic.orgName || '○○機構'}　${plan.basic.planYear || '○○○'} 年度`, { center: true }),
    h3('訪談須知'),
    ...script.intro.map((t) => p(`・${t}`, { indent: true })),
    h3('訪談題目'),
  ]
  let last = ''
  script.questions.forEach((q, i) => {
    const b = blockById(q.block)
    if (b.id !== last) {
      children.push(h3(`【${b.no}、${b.title}】`))
      last = b.id
    }
    children.push(p(`☐ ${i + 1}. ${q.q}`, { indent: true }))
    if (q.tip) children.push(p(`提示：${q.tip}`, { indent: true, size: 20 }))
    for (const t of q.items?.(plan) ?? []) children.push(p(`　□ ${t}`, { indent: true }))
  })
  children.push(h3('結尾'), ...script.outro.map((t) => p(`・${t}`, { indent: true })))
  const doc = new Document({ styles: STYLES, sections: [{ children }] })
  download(`${script.title}.docx`, await Packer.toBlob(doc))
}
