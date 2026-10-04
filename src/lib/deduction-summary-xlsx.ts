/**
 * deduction-summary-xlsx.ts
 * Excel (.xlsx) version of the tips & overtime worksheet, generated in the browser.
 * Imported dynamically from ExportSummaryActions so SheetJS only loads on click.
 */

import { utils, write, type WorkBook } from 'xlsx';
import { saveBlob } from './save-blob';
import { SUMMARY_DISCLAIMER, SUMMARY_LEGAL_NOTICE, type DeductionSummary } from './deduction-summary';
import { addr, buildSheet, usd, wide, type Cell } from './xlsx-sheet';

export const XLSX_FILENAME = 'NetWageTax_2026_Deduction_Summary.xlsx';

const COLS = 6;

export function buildDeductionWorkbook(s: DeductionSummary): WorkBook {
  const rows: Cell[][] = [
    [wide(`NetWageTax: ${s.taxYear} tips and overtime deduction worksheet`, COLS)],
    ['Reference', s.referenceId, null, 'Generated', s.generatedAt],
    [],
    [wide('Parameters', COLS)],
    ['Filing status', s.filingStatus],
    ['State', s.stateTax?.name ?? 'Not selected'],
    ['MAGI / AGI', usd(s.magi)],
    [],
    [wide('Deduction breakdown', COLS)],
    ['Category', 'Reported', 'Statutory cap', 'After cap', 'Phase-out', 'Net allowed'],
  ];

  const first = rows.length; // 0-based index of the first category row
  for (const r of s.worksheet) {
    rows.push([
      `${r.label} (${r.code})${r.note ? `: ${r.note}` : ''}`,
      usd(r.reported),
      usd(r.cap),
      usd(r.afterCap),
      usd(-r.phaseoutReduction),
      usd(r.allowed),
    ]);
  }
  const last = rows.length - 1;
  const total = (c: number) => usd(
    s.worksheet.reduce((t, r) => t + [r.reported, r.cap, r.afterCap, -r.phaseoutReduction, r.allowed][c - 1], 0),
    `SUM(${addr(first, c)}:${addr(last, c)})`,
  );
  rows.push(['Total', total(1), null, total(3), total(4), total(5)]);

  rows.push(
    [],
    [wide('Tax impact', COLS)],
    ['Net federal deduction (Schedule 1-A)', usd(s.totalDeduction)],
    ['Estimated federal income tax savings', usd(s.savings)],
    ['Estimated FICA still owed on tips and overtime', usd(s.fica)],
    [
      s.stateTax ? `Estimated state income tax (${s.stateTax.code})` : 'Estimated state income tax',
      s.stateTax ? usd(s.stateTax.tax) : 'No state selected',
    ],
  );
  if (s.stateTipsOvertimeNote) rows.push([wide(s.stateTipsOvertimeNote, COLS)]);
  if (s.savingsNote) rows.push([wide(s.savingsNote, COLS)]);

  rows.push([], [wide(SUMMARY_DISCLAIMER, COLS)], [wide(SUMMARY_LEGAL_NOTICE, COLS)]);

  const wb = utils.book_new();
  utils.book_append_sheet(wb, buildSheet(rows, [44, 16, 16, 16, 16, 16]), 'Deduction Worksheet');
  wb.Props = { Title: `NetWageTax: ${s.taxYear} tips and overtime deduction worksheet`, Author: 'NetWageTax' };
  return wb;
}

export function downloadDeductionXlsx(s: DeductionSummary): void {
  const bytes = write(buildDeductionWorkbook(s), { type: 'array', bookType: 'xlsx', compression: true }) as ArrayBuffer;
  saveBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), XLSX_FILENAME);
}

/** For tests: the workbook as bytes. */
export const deductionWorkbookBytes = (s: DeductionSummary) =>
  write(buildDeductionWorkbook(s), { type: 'buffer', bookType: 'xlsx' }) as Uint8Array;
