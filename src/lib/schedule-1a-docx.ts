/**
 * schedule-1a-docx.ts
 * Word (.docx) worksheet for the senior deduction and car loan interest calculators, generated in
 * the browser. Imported dynamically so `docx` only loads on click. Styles and helpers come from
 * deduction-summary-docx.ts, so every Word export looks the same.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  VerticalAlignTable,
  WidthType,
} from 'docx';
import { formatUSD } from '../components/CurrencyInput';
import { SUMMARY_DISCLAIMER, SUMMARY_LEGAL_NOTICE } from './deduction-summary';
import {
  cellBorder,
  disclaimerFooter,
  FONT,
  GREEN,
  GREEN_TINT,
  INK,
  INK_2,
  metaRow,
  noBorder,
  SURFACE,
  text,
  totalBorder,
  WARNING,
  WARNING_TINT,
} from './deduction-summary-docx';
import { saveBlob } from './save-blob';
import { worksheetValue, type Schedule1aSummary, type WorksheetRow } from './schedule-1a-summary';

// US Letter, 1" margins → 9360 twips of usable width.
const WIDTH = 9360;
const margins = { top: 90, bottom: 90, left: 140, right: 140 };
const tableBorders = { top: cellBorder, bottom: cellBorder, left: noBorder, right: noBorder, insideHorizontal: cellBorder, insideVertical: noBorder };

/** First column takes what the value columns leave. */
function columnWidths(count: number): number[] {
  const value = count > 2 ? 1700 : 3000;
  return [WIDTH - value * (count - 1), ...Array<number>(count - 1).fill(value)];
}

function cell(children: Paragraph[], width: number, opts: { fill?: string; top?: typeof totalBorder } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlignTable.CENTER,
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: 'auto' } : undefined,
    borders: opts.top ? { top: opts.top } : undefined,
    margins,
    children,
  });
}

const right = (value: string, bold = false) => new Paragraph({ alignment: AlignmentType.RIGHT, children: [text(value, { bold })] });

function worksheetTable(s: Schedule1aSummary): Table {
  const widths = columnWidths(s.columns.length);
  const header = new TableRow({
    tableHeader: true,
    children: s.columns.map((c, i) =>
      cell([new Paragraph({ alignment: i > 0 ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [text(c, { bold: true, size: 19 })] })], widths[i], { fill: SURFACE }),
    ),
  });
  const row = (r: WorksheetRow) => {
    const top = r.total ? totalBorder : undefined;
    const label = [new Paragraph({ children: [text(r.label, { bold: true })] })];
    if (r.detail) label.push(new Paragraph({ children: [text(r.detail, { size: 17, color: INK_2 })] }));
    return new TableRow({
      cantSplit: true,
      children: [cell(label, widths[0], { top }), ...r.values.map((v, i) => cell([right(worksheetValue(v), r.total)], widths[i + 1], { top }))],
    });
  };
  return new Table({ width: { size: WIDTH, type: WidthType.DXA }, columnWidths: widths, borders: tableBorders, rows: [header, ...s.rows.map(row)] });
}

function figuresTable(s: Schedule1aSummary): Table {
  const w = WIDTH / 3;
  const figure = (label: string, value: string, fill?: string) =>
    cell(
      [new Paragraph({ children: [text(label, { bold: true, size: 17, color: INK_2 })] }), new Paragraph({ children: [text(value, { bold: true, size: 32 })] })],
      w,
      { fill },
    );
  const label = s.deductionLabel.charAt(0).toUpperCase() + s.deductionLabel.slice(1);
  return new Table({
    width: { size: WIDTH, type: WidthType.DXA },
    columnWidths: [w, w, w],
    borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder, insideHorizontal: cellBorder, insideVertical: cellBorder },
    rows: [
      new TableRow({
        children: [
          figure('Total income (MAGI)', formatUSD(s.magi)),
          figure(`${label} (Schedule 1-A)`, formatUSD(s.deduction)),
          figure('Federal tax savings', formatUSD(s.savings), GREEN_TINT),
        ],
      }),
    ],
  });
}

function federalTable(s: Schedule1aSummary): Table {
  const [a, b] = [WIDTH - 3000, 3000];
  const row = (label: string, value: number, total = false) =>
    new TableRow({
      children: [
        cell([new Paragraph({ children: [text(label, { bold: total })] })], a, { top: total ? totalBorder : undefined }),
        cell([right(formatUSD(value), total)], b, { top: total ? totalBorder : undefined }),
      ],
    });
  return new Table({
    width: { size: WIDTH, type: WidthType.DXA },
    columnWidths: [a, b],
    borders: tableBorders,
    rows: [
      row(`Without the ${s.deductionLabel}`, s.federal.before),
      row(`With the ${s.deductionLabel}`, s.federal.after),
      row('Estimated federal tax savings', s.federal.saved, true),
    ],
  });
}

const heading = (value: string) => new Paragraph({ spacing: { before: 280, after: 120 }, children: [text(value, { bold: true, size: 24 })] });
const small = (value: string, before = 80) => new Paragraph({ spacing: { before }, children: [text(value, { size: 18, color: INK_2 })] });
/** Notice (docs/DESIGN.md §6): warning left border, light tint, ink text. */
const notice = (children: ReturnType<typeof text>[], before = 120) =>
  new Paragraph({
    spacing: { before, after: 0 },
    shading: { type: ShadingType.CLEAR, fill: WARNING_TINT, color: 'auto' },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: WARNING, space: 8 } },
    indent: { left: 160 },
    children,
  });

export function buildSchedule1aDocument(s: Schedule1aSummary): Document {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      spacing: { after: 60 },
      children: [text('NetWageTax', { bold: true, size: 22, color: GREEN }), text(`  ·  NetWageTax.com · ${s.taxYear} tax estimate`, { size: 20, color: INK_2 })],
    }),
    new Paragraph({
      spacing: { after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: INK, space: 8 } },
      children: [text(s.title.charAt(0).toUpperCase() + s.title.slice(1), { bold: true, size: 34 })],
    }),
    new Paragraph({ spacing: { after: 200 }, children: [text(s.context, { size: 20, color: INK_2 })] }),
    metaRow('Date generated', s.generatedAt),
    metaRow('Reference', s.referenceId),
    metaRow('Tax year', String(s.taxYear)),
    metaRow('Filing status', s.filingStatus),
    new Paragraph({ spacing: { before: 200 }, children: [] }),
    figuresTable(s),
  ];
  if (s.savingsNote) children.push(small(s.savingsNote));
  if (s.zeroReason) children.push(notice([text('Why the deduction is $0: ', { bold: true }), text(s.zeroReason)], 160));

  children.push(heading(s.tableTitle), worksheetTable(s));
  if (s.tableNote) children.push(small(s.tableNote));
  children.push(heading('Federal income tax'), federalTable(s));

  if (s.checklist) {
    children.push(heading(s.checklist.title), small(s.checklist.intro, 0));
    for (const item of s.checklist.items) children.push(new Paragraph({ bullet: { level: 0 }, spacing: { before: 40 }, children: [text(item, { size: 20 })] }));
  }

  children.push(heading('Before you file'));
  s.notices.forEach((n, i) => children.push(notice([text(n, { size: 20 })], i === 0 ? 0 : 60)));
  children.push(
    new Paragraph({ spacing: { before: 240 }, children: [text('Disclaimer', { bold: true, size: 20 })] }),
    new Paragraph({ spacing: { before: 60 }, children: [text(`${SUMMARY_DISCLAIMER} ${SUMMARY_LEGAL_NOTICE}`, { size: 18, color: INK_2 })] }),
  );

  return new Document({
    creator: 'NetWageTax',
    title: `NetWageTax: ${s.title}`,
    description: SUMMARY_DISCLAIMER,
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
        footers: { default: disclaimerFooter() },
        children,
      },
    ],
  });
}

export async function downloadSchedule1aDocx(s: Schedule1aSummary): Promise<void> {
  saveBlob(await Packer.toBlob(buildSchedule1aDocument(s)), `${s.fileBase}.docx`);
}
