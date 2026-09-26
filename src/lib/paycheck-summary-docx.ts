/**
 * paycheck-summary-docx.ts
 * Word (.docx) version of the paycheck estimate, generated in the browser.
 * Imported dynamically from PaycheckExportActions so `docx` only loads on click.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  VerticalAlignTable,
  WidthType,
} from 'docx';
import { saveBlob } from './save-blob';
import { formatUSDCents } from '../components/CurrencyInput';
import { cellBorder, metaRow, MUTED, NAVY, noBorder, RULE, text, TOTAL_FILL, TOTAL_TEXT } from './deduction-summary-docx';
import {
  PAYCHECK_DISCLAIMER,
  PAYCHECK_DOCX_FILENAME,
  PAYCHECK_NOT_A_PAYSTUB,
  type PaycheckSummary,
  type PaycheckSummaryRow,
} from './paycheck-summary';

// US Letter, 1" margins → 9360 twips.
const COLS = [5160, 2100, 2100];

const margins = { top: 90, bottom: 90, left: 140, right: 140 };

function cell(paragraphs: Paragraph[], width: number, fill?: string) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlignTable.CENTER,
    shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
    margins,
    children: paragraphs,
  });
}

function headerRow(): TableRow {
  const head = (value: string, align: (typeof AlignmentType)[keyof typeof AlignmentType], width: number) =>
    cell([new Paragraph({ alignment: align, children: [text(value, { bold: true, size: 19, color: 'FFFFFF' })] })], width, NAVY);
  return new TableRow({
    tableHeader: true,
    children: [
      head('Item', AlignmentType.LEFT, COLS[0]),
      head('Per paycheck', AlignmentType.RIGHT, COLS[1]),
      head('Annual', AlignmentType.RIGHT, COLS[2]),
    ],
  });
}

function bodyRow(r: PaycheckSummaryRow, zebra: boolean): TableRow {
  const strong = r.kind === 'gross' || r.kind === 'subtotal' || r.kind === 'net';
  const color = r.kind === 'net' ? TOTAL_TEXT : undefined;
  const fill = r.kind === 'net' ? TOTAL_FILL : zebra ? 'F8FAFC' : undefined;
  const label = [new Paragraph({ children: [text(r.label, { bold: strong, color })] })];
  if (r.detail) label.push(new Paragraph({ children: [text(r.detail, { size: 17, color: MUTED })] }));
  const money = (n: number) =>
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [text(formatUSDCents(n), { bold: strong, color })] });
  return new TableRow({
    cantSplit: true,
    children: [cell(label, COLS[0], fill), cell([money(r.perPeriod)], COLS[1], fill), cell([money(r.annual)], COLS[2], fill)],
  });
}

export function buildPaycheckDocument(s: PaycheckSummary): Document {
  return new Document({
    creator: 'NetWageTax',
    title: `NetWageTax - ${s.taxYear} Paycheck & Take-Home Pay Estimate`,
    description: PAYCHECK_NOT_A_PAYSTUB,
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [
      {
        properties: {
          page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 6 } },
                children: [text(PAYCHECK_NOT_A_PAYSTUB, { bold: true, size: 16, color: MUTED })],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            spacing: { after: 60 },
            children: [
              text('NetWage', { bold: true, size: 22, color: NAVY }),
              text('Tax', { bold: true, size: 22, color: TOTAL_TEXT }),
              text(`  ·  NetWageTax.com · ${s.taxYear} Paycheck Estimate`, { size: 20, color: MUTED }),
            ],
          }),
          new Paragraph({
            spacing: { after: 240 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 8 } },
            children: [text(`${s.taxYear} Paycheck & Take-Home Pay Estimate`, { bold: true, size: 34 })],
          }),
          metaRow('Date generated', s.generatedAt),
          metaRow('Estimate reference', s.referenceId),
          metaRow('Earnings', s.earnings),
          metaRow('Pay frequency', `${s.frequencyLabel} (${s.periods} paychecks/year)`),
          metaRow('Filing status', s.filingStatus),
          metaRow('State', s.stateName ?? 'Not selected'),
          new Paragraph({
            spacing: { before: 280, after: 120 },
            shading: { type: ShadingType.CLEAR, fill: TOTAL_FILL, color: 'auto' },
            children: [
              text('Estimated take-home: ', { bold: true, color: TOTAL_TEXT, size: 24 }),
              text(`${formatUSDCents(s.net.perPeriod)} per paycheck · ${formatUSDCents(s.net.annual)} per year`, {
                bold: true,
                color: TOTAL_TEXT,
                size: 24,
              }),
            ],
          }),
          new Table({
            width: { size: COLS.reduce((a, b) => a + b, 0), type: WidthType.DXA },
            columnWidths: COLS,
            borders: {
              top: cellBorder,
              bottom: cellBorder,
              left: noBorder,
              right: noBorder,
              insideHorizontal: cellBorder,
              insideVertical: noBorder,
            },
            rows: [headerRow(), ...s.rows.map((r, i) => bodyRow(r, i % 2 === 1))],
          }),
          new Paragraph({ spacing: { before: 280 }, children: [text(PAYCHECK_NOT_A_PAYSTUB, { bold: true, size: 20 })] }),
          new Paragraph({ spacing: { before: 60 }, children: [text(PAYCHECK_DISCLAIMER, { size: 18, color: MUTED })] }),
        ],
      },
    ],
  });
}

export async function downloadPaycheckDocx(s: PaycheckSummary): Promise<void> {
  const blob = await Packer.toBlob(buildPaycheckDocument(s));
  saveBlob(blob, PAYCHECK_DOCX_FILENAME);
}
