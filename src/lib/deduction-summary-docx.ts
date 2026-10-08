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
import { saveBlob } from './save-blob';
import {
  DOCX_FILENAME,
  SUMMARY_DISCLAIMER,
  SUMMARY_LEGAL_NOTICE,
  type DeductionSummary,
  type SummaryLine,
} from './deduction-summary';

// Public Sans isn't installed on most computers, so Word files keep a font every copy of Word has.
export const FONT = 'Calibri';
// Light design tokens (docs/DESIGN.md §2), without the '#'.
export const INK = '1A1F24';
export const INK_2 = '4B5560';
export const LINE = 'D5D9DE';
export const SURFACE = 'F3F4F5';
export const GREEN = '0D6B47';
export const GREEN_TINT = 'E9F3EE';
export const WARNING = 'A56A12';
export const WARNING_TINT = 'FBF5E9';

// US Letter, 1" margins → 9360 twips of usable width.
const LABEL_WIDTH = 6360;
const VALUE_WIDTH = 3000;

export const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: LINE };
/** 2px ink rule above a total row (docs/DESIGN.md §6, Table). */
export const totalBorder = { style: BorderStyle.SINGLE, size: 12, color: INK };
export const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

export function text(value: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) {
  return new TextRun({ text: value, font: FONT, size: opts.size ?? 21, color: opts.color ?? INK, ...opts });
}

function headerRow(): TableRow {
  const cell = (value: string, align: (typeof AlignmentType)[keyof typeof AlignmentType], width: number) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: SURFACE, color: 'auto' },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      children: [new Paragraph({ alignment: align, children: [text(value, { bold: true, size: 19 })] })],
    });
  return new TableRow({
    tableHeader: true,
    children: [cell('Line item', AlignmentType.LEFT, LABEL_WIDTH), cell('Amount', AlignmentType.RIGHT, VALUE_WIDTH)],
  });
}

function lineRow(line: SummaryLine): TableRow {
  const borders = line.total ? { top: totalBorder } : undefined;
  const margins = { top: 90, bottom: 90, left: 140, right: 140 };
  const labelChildren = [new Paragraph({ children: [text(line.label, { bold: line.total })] })];
  if (line.detail) {
    labelChildren.push(new Paragraph({ children: [text(line.detail, { size: 17, color: INK_2 })] }));
  }
  return new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: LABEL_WIDTH, type: WidthType.DXA },
        verticalAlign: VerticalAlignTable.CENTER,
        borders,
        margins,
        children: labelChildren,
      }),
      new TableCell({
        width: { size: VALUE_WIDTH, type: WidthType.DXA },
        verticalAlign: VerticalAlignTable.CENTER,
        borders,
        margins,
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [text(line.value, { bold: line.total, size: line.total ? 24 : 21 })],
          }),
        ],
      }),
    ],
  });
}

/** Page footer with the estimate disclaimer, shared by the deduction worksheets. */
export function disclaimerFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 6 } },
        children: [text(SUMMARY_DISCLAIMER, { bold: true, size: 16, color: INK_2 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [text('NetWageTax.com is not affiliated with the IRS or any government agency.', { size: 16, color: INK_2 })],
      }),
    ],
  });
}

export function metaRow(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [text(`${label}: `, { bold: true, color: INK_2, size: 20 }), text(value, { size: 20 })],
  });
}

export function buildSummaryDocument(summary: DeductionSummary): Document {
  return new Document({
    creator: 'NetWageTax',
    title: `NetWageTax: ${summary.taxYear} tips and overtime deduction summary`,
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
        footers: { default: disclaimerFooter() },
        children: [
          new Paragraph({
            spacing: { after: 60 },
            children: [text('NetWageTax', { bold: true, size: 22, color: GREEN }), text(`  ·  NetWageTax.com · ${summary.taxYear} tax estimate`, { size: 20, color: INK_2 })],
          }),
          new Paragraph({
            spacing: { after: 240 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: INK, space: 8 } },
            children: [text(`${summary.taxYear} tips and overtime deduction summary`, { bold: true, size: 34 })],
          }),

          metaRow('Date generated', summary.generatedAt),
          metaRow('Reference', summary.referenceId),
          metaRow('Tax year', String(summary.taxYear)),
          metaRow('Filing status', summary.filingStatus),

          new Paragraph({
            spacing: { before: 280, after: 120 },
            children: [text('Line-item breakdown', { bold: true, size: 24 })],
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
            // Notice (docs/DESIGN.md §6): warning left border, light tint, ink text.
            shading: { type: ShadingType.CLEAR, fill: WARNING_TINT, color: 'auto' },
            border: { left: { style: BorderStyle.SINGLE, size: 24, color: WARNING, space: 8 } },
            indent: { left: 160 },
            children: [text('Important: ', { bold: true }), text(summary.ficaNotice)],
          }),
          new Paragraph({
            spacing: { before: 120 },
            children: [text('Disclaimer', { bold: true, size: 20 })],
          }),
          new Paragraph({
            spacing: { before: 60 },
            children: [text(`${SUMMARY_DISCLAIMER} ${SUMMARY_LEGAL_NOTICE}`, { size: 18, color: INK_2 })],
          }),
        ],
      },
    ],
  });
}

export async function downloadSummaryDocx(summary: DeductionSummary): Promise<void> {
  const blob = await Packer.toBlob(buildSummaryDocument(summary));
  saveBlob(blob, DOCX_FILENAME);
}
