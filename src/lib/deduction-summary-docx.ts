/**
 * deduction-summary-docx.ts
 * Genera el resumen en Word (.docx) en el navegador. Se importa de forma
 * dinámica desde ExportSummaryActions para no cargar `docx` hasta que se usa.
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
  TextRun,
  VerticalAlignTable,
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';
import {
  DOCX_FILENAME,
  SUMMARY_DISCLAIMER,
  SUMMARY_LEGAL_NOTICE,
  type DeductionSummary,
  type SummaryLine,
} from './deduction-summary';

export const FONT = 'Calibri';
export const INK = '0B0F19';
export const MUTED = '64748B';
export const NAVY = '1F335A';
export const RULE = 'CBD5E1';
export const TOTAL_FILL = 'ECFDF5';
export const TOTAL_TEXT = '047857';

// US Letter, 1" margins → 9360 twips of usable width.
const LABEL_WIDTH = 6360;
const VALUE_WIDTH = 3000;

export const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: RULE };
export const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

export function text(value: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) {
  return new TextRun({ text: value, font: FONT, size: opts.size ?? 21, color: opts.color ?? INK, ...opts });
}

function headerRow(): TableRow {
  const cell = (value: string, align: (typeof AlignmentType)[keyof typeof AlignmentType], width: number) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: NAVY, color: 'auto' },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      children: [new Paragraph({ alignment: align, children: [text(value, { bold: true, size: 19, color: 'FFFFFF' })] })],
    });
  return new TableRow({
    tableHeader: true,
    children: [cell('Line item', AlignmentType.LEFT, LABEL_WIDTH), cell('Amount', AlignmentType.RIGHT, VALUE_WIDTH)],
  });
}

function lineRow(line: SummaryLine): TableRow {
  const shading = line.total ? { type: ShadingType.CLEAR, fill: TOTAL_FILL, color: 'auto' } : undefined;
  const margins = { top: 90, bottom: 90, left: 140, right: 140 };
  const labelChildren = [
    new Paragraph({ children: [text(line.label, { bold: line.total, color: line.total ? TOTAL_TEXT : INK })] }),
  ];
  if (line.detail) {
    labelChildren.push(new Paragraph({ children: [text(line.detail, { size: 17, color: MUTED })] }));
  }
  return new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: LABEL_WIDTH, type: WidthType.DXA },
        verticalAlign: VerticalAlignTable.CENTER,
        shading,
        margins,
        children: labelChildren,
      }),
      new TableCell({
        width: { size: VALUE_WIDTH, type: WidthType.DXA },
        verticalAlign: VerticalAlignTable.CENTER,
        shading,
        margins,
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [text(line.value, { bold: line.total, size: line.total ? 24 : 21, color: line.total ? TOTAL_TEXT : INK })],
          }),
        ],
      }),
    ],
  });
}

export function metaRow(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [text(`${label}: `, { bold: true, color: MUTED, size: 20 }), text(value, { size: 20 })],
  });
}

export function buildSummaryDocument(summary: DeductionSummary): Document {
  return new Document({
    creator: 'NetWageTax',
    title: `NetWageTax - ${summary.taxYear} Federal Tips & Overtime Deduction Summary`,
    description: SUMMARY_DISCLAIMER,
    styles: { default: { document: { run: { font: FONT } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 6 } },
                children: [text(SUMMARY_DISCLAIMER, { bold: true, size: 16, color: MUTED })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [text('NetWageTax.com is not affiliated with the IRS or any government agency.', { size: 16, color: MUTED })],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            spacing: { after: 60 },
            children: [text('NetWage', { bold: true, size: 22, color: NAVY }), text('Tax', { bold: true, size: 22, color: '2E4E86' }), text(`  ·  NetWageTax.com · ${summary.taxYear} Tax Estimate`, { size: 20, color: MUTED })],
          }),
          new Paragraph({
            spacing: { after: 240 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 8 } },
            children: [text(`NetWageTax - ${summary.taxYear} Federal Tips & Overtime Deduction Summary`, { bold: true, size: 34 })],
          }),

          metaRow('Date generated', summary.generatedAt),
          metaRow('Reference', summary.referenceId),
          metaRow('Tax year', String(summary.taxYear)),
          metaRow('Filing status', summary.filingStatus),

          new Paragraph({
            spacing: { before: 280, after: 120 },
            children: [text('Line-item breakdown', { bold: true, size: 24, color: NAVY })],
          }),
          new Table({
            width: { size: LABEL_WIDTH + VALUE_WIDTH, type: WidthType.DXA },
            columnWidths: [LABEL_WIDTH, VALUE_WIDTH],
            borders: {
              top: cellBorder,
              bottom: cellBorder,
              left: noBorder,
              right: noBorder,
              insideHorizontal: cellBorder,
              insideVertical: noBorder,
            },
            rows: [headerRow(), ...summary.lines.map(lineRow)],
          }),

          new Paragraph({
            spacing: { before: 280, after: 120 },
            shading: { type: ShadingType.CLEAR, fill: 'FFFBEB', color: 'auto' },
            children: [text('Important: ', { bold: true, color: '92400E' }), text(summary.ficaNotice, { color: '92400E' })],
          }),
          new Paragraph({
            spacing: { before: 120 },
            children: [text('Disclaimer', { bold: true, size: 20, color: MUTED })],
          }),
          new Paragraph({
            spacing: { before: 60 },
            children: [text(`${SUMMARY_DISCLAIMER} ${SUMMARY_LEGAL_NOTICE}`, { size: 18, color: MUTED })],
          }),
        ],
      },
    ],
  });
}

export async function downloadSummaryDocx(summary: DeductionSummary): Promise<void> {
  const blob = await Packer.toBlob(buildSummaryDocument(summary));
  saveAs(blob, DOCX_FILENAME);
}
