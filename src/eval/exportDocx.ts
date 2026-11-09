import {
  AlignmentType, BorderStyle, Document, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx'
import { download } from '../util'
import { dataUrlToBytes, type Photo } from './photos'

export const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, '、')

/** Word 文件的組成單位，畫面預覽與匯出共用 */
export type DocBlock =
  | { t: 'title'; text: string; sub?: string }
  | { t: 'h'; text: string }
  | { t: 'p'; text: string }
  /** 標籤＋外框文字，例如「上次追蹤事項」 */
  | { t: 'box'; label: string; text: string }
  /** 基本資料表：每列 [標籤, 值]，兩組並排 */
  | { t: 'kv'; pairs: [string, string][] }
  | { t: 'table'; headers: string[]; rows: string[][]; foot?: string[][] }
  | { t: 'photos'; photos: Photo[] }

const STYLES = {
  default: {
    document: {
      run: { font: { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: '標楷體' }, size: 24 },
      paragraph: { spacing: { line: 340, after: 60 } },
    },
  },
}

const line = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const borders = { top: line, bottom: line, left: line, right: line }
const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none }

const paras = (text: string, opts: { bold?: boolean; size?: number; center?: boolean } = {}) =>
  (text || '').split('\n').map(
    (l) =>
      new Paragraph({
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { line: 300, after: 0 },
        children: [new TextRun({ text: l, bold: opts.bold, size: opts.size ?? 22 })],
      }),
  )

const cell = (text: string, opts: { bold?: boolean; shade?: boolean; span?: number; center?: boolean } = {}) =>
  new TableCell({
    borders,
    columnSpan: opts.span,
    shading: opts.shade ? { fill: 'F2F2F2' } : undefined,
    children: paras(text, { bold: opts.bold, center: opts.center }),
  })

function photoTable(photos: Photo[]) {
  const W = 290
  const rows: TableRow[] = []
  for (let i = 0; i < photos.length; i += 2) {
    rows.push(
      new TableRow({
        children: [photos[i], photos[i + 1]].map(
          (ph) =>
            new TableCell({
              borders: noBorders,
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: ph
                    ? [new ImageRun({ type: 'jpg', data: dataUrlToBytes(ph.dataUrl), transformation: { width: W, height: Math.round((W * ph.h) / ph.w) } })]
                    : [],
                }),
              ],
            }),
        ),
      }),
    )
  }
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows })
}

function render(b: DocBlock): (Paragraph | Table)[] {
  switch (b.t) {
    case 'title':
      return [
        ...(b.sub ? paras(b.sub, { center: true, size: 26 }) : []),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: b.text, bold: true, size: 32 })] }),
      ]
    case 'h':
      return [new Paragraph({ spacing: { before: 240, after: 80 }, children: [new TextRun({ text: b.text, bold: true, size: 26 })] })]
    case 'p':
      return (b.text || '').split('\n').map((l) => new Paragraph({ indent: { firstLine: 480 }, children: [new TextRun(l)] }))
    case 'box':
      return [
        new Paragraph({ spacing: { before: 160, after: 40 }, children: [new TextRun({ text: b.label, bold: true })] }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: [cell(b.text || '（無）')] })] }),
      ]
    case 'kv': {
      const rows: TableRow[] = []
      for (let i = 0; i < b.pairs.length; i += 2) {
        const [a, c] = [b.pairs[i], b.pairs[i + 1]]
        rows.push(
          new TableRow({
            children: c
              ? [cell(a[0], { bold: true, shade: true }), cell(a[1]), cell(c[0], { bold: true, shade: true }), cell(c[1])]
              : [cell(a[0], { bold: true, shade: true }), cell(a[1], { span: 3 })],
          }),
        )
      }
      return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })]
    }
    case 'table':
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: b.headers.map((h) => cell(h, { bold: true, shade: true, center: true })) }),
            ...b.rows.map((r) => new TableRow({ children: r.map((c) => cell(c)) })),
            ...(b.foot ?? []).map((r) => new TableRow({ children: r.map((c) => cell(c, { bold: true, shade: true })) })),
          ],
        }),
        new Paragraph({ spacing: { after: 60 } }),
      ]
    case 'photos':
      return b.photos.length ? [new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: '會議照片', bold: true })] }), photoTable(b.photos)] : []
  }
}

export async function exportDocx(filename: string, blocks: DocBlock[]) {
  const doc = new Document({ styles: STYLES, sections: [{ children: blocks.flatMap(render) }] })
  download(`${safeName(filename)}.docx`, await Packer.toBlob(doc))
}
