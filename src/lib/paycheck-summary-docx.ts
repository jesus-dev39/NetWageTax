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
import { cellBorder, FONT, GREEN, GREEN_TINT, INK, INK_2, LINE, metaRow, noBorder, SURFACE, text, totalBorder } from './deduction-summary-docx';
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

function cell(paragraphs: Paragraph[], width: number, fill?: string, topRule = false) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlignTable.CENTER,
    shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
    borders: topRule ? { top: totalBorder } : undefined,
    margins,
    children: paragraphs,
  });
}

function headerRow(): TableRow {
  const head = (value: string, align: (typeof AlignmentType)[keyof typeof AlignmentType], width: number) =>
    cell([new Paragraph({ alignment: align, children: [text(value, { bold: true, size: 19 })] })], width, SURFACE);
  return new TableRow({
    tableHeader: true,
    children: [
      head('Item', AlignmentType.LEFT, COLS[0]),
      head('Per paycheck', AlignmentType.RIGHT, COLS[1]),
      head('Annual', AlignmentType.RIGHT, COLS[2]),
    ],
  });
}

// Net pay: 2px ink rule and the result's green tint; other rows: 1px rules, no zebra stripes.
function bodyRow(r: PaycheckSummaryRow): TableRow {
  const strong = r.kind === 'gross' || r.kind === 'subtotal' || r.kind === 'net';
  const net = r.kind === 'net';
  const fill = net ? GREEN_TINT : undefined;
  const label = [new Paragraph({ children: [text(r.label, { bold: strong })] })];
  if (r.detail) label.push(new Paragraph({ children: [text(r.detail, { size: 17, color: INK_2 })] }));
  const money = (n: number) =>
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [text(formatUSDCents(n), { bold: strong })] });
  return new TableRow({
    cantSplit: true,
    children: [
      cell(label, COLS[0], fill, net),
      cell([money(r.perPeriod)], COLS[1], fill, net),
      cell([money(r.annual)], COLS[2], fill, net),
    ],
  });
}

export function buildPaycheckDocument(s: PaycheckSummary): Document {
  return new Document({
    creator: 'NetWageTax',
    title: `NetWageTax: ${s.taxYear} paycheck and take-home pay estimate`,
    description: PAYCHECK_NOT_A_PAYSTUB,
    styles: { default: { document: { run: { font: FONT } } } },
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
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 6 } },
                children: [text(PAYCHECK_NOT_A_PAYSTUB, { bold: true, size: 16, color: INK_2 })],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            spacing: { after: 60 },
            children: [
              text('NetWageTax', { bold: true, size: 22, color: GREEN }),
              text(`  ·  NetWageTax.com · ${s.taxYear} paycheck estimate`, { size: 20, color: INK_2 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 240 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: INK, space: 8 } },
            children: [text(`${s.taxYear} paycheck and take-home pay estimate`, { bold: true, size: 34 })],
          }),
          metaRow('Date generated', s.generatedAt),
          metaRow('Estimate reference', s.referenceId),
          metaRow('Earnings', s.earnings),
          metaRow('Pay frequency', `${s.frequencyLabel} (${s.periods} paychecks/year)`),
          metaRow('Filing status', s.filingStatus),
          metaRow('State', s.stateName ?? 'Not selected'),
          new Paragraph({
            spacing: { before: 280, after: 120 },
            shading: { type: ShadingType.CLEAR, fill: GREEN_TINT, color: 'auto' },
            children: [
              text('Estimated take-home: ', { bold: true, size: 24 }),
              text(`${formatUSDCents(s.net.perPeriod)} per paycheck · ${formatUSDCents(s.net.annual)} per year`, {
                bold: true,
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
            rows: [headerRow(), ...s.rows.map(bodyRow)],
          }),
          new Paragraph({ spacing: { before: 280 }, children: [text(PAYCHECK_NOT_A_PAYSTUB, { bold: true, size: 20 })] }),
          new Paragraph({ spacing: { before: 60 }, children: [text(PAYCHECK_DISCLAIMER, { size: 18, color: INK_2 })] }),
        ],
      },
    ],
  });
}

export async function downloadPaycheckDocx(s: PaycheckSummary): Promise<void> {
  const blob = await Packer.toBlob(buildPaycheckDocument(s));
  saveBlob(blob, PAYCHECK_DOCX_FILENAME);
}
