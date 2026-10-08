/**
 * schedule-1a-xlsx.ts
 * Excel (.xlsx) worksheet for the senior deduction and car loan interest calculators, generated in
 * the browser. Imported dynamically so SheetJS only loads on click. Amounts stay real numbers with a
 * currency format (xlsx-sheet.ts), so the user can check the math in Excel.
 */

import { utils, write, type WorkBook } from 'xlsx';
import { SUMMARY_DISCLAIMER, SUMMARY_LEGAL_NOTICE } from './deduction-summary';
import { saveBlob } from './save-blob';
import type { Schedule1aSummary } from './schedule-1a-summary';
import { buildSheet, usd, wide, type Cell } from './xlsx-sheet';

const cellOf = (v: number | string): Cell => (typeof v === 'number' ? usd(v) : v);

export function buildSchedule1aWorkbook(s: Schedule1aSummary): WorkBook {
  const cols = Math.max(s.columns.length, 3);
  const rows: Cell[][] = [
    [wide(`NetWageTax: ${s.title}`, cols)],
    ['Reference', s.referenceId, 'Generated', s.generatedAt],
    [wide(s.context, cols)],
    [],
    [wide('Key figures', cols)],
    ['Filing status', s.filingStatus],
    ['MAGI / AGI', usd(s.magi)],
    [`${s.deductionLabel.charAt(0).toUpperCase() + s.deductionLabel.slice(1)} (Schedule 1-A)`, usd(s.deduction)],
    ['Estimated federal tax savings', usd(s.savings)],
  ];
  if (s.savingsNote) rows.push([wide(s.savingsNote, cols)]);
  if (s.zeroReason) rows.push([wide(`Why the deduction is $0: ${s.zeroReason}`, cols)]);

  rows.push([], [wide(s.tableTitle, cols)], s.columns);
  for (const r of s.rows) rows.push([r.detail ? `${r.label} (${r.detail})` : r.label, ...r.values.map(cellOf)]);
  if (s.tableNote) rows.push([wide(s.tableNote, cols)]);

  rows.push(
    [],
    [wide('Federal income tax', cols)],
    [`Without the ${s.deductionLabel}`, usd(s.federal.before)],
    [`With the ${s.deductionLabel}`, usd(s.federal.after)],
    ['Estimated federal tax savings', usd(s.federal.saved)],
  );

  if (s.checklist) {
    rows.push([], [wide(s.checklist.title, cols)], [wide(s.checklist.intro, cols)]);
    for (const item of s.checklist.items) rows.push([wide(`• ${item}`, cols)]);
  }

  rows.push([], [wide('Before you file', cols)]);
  for (const n of s.notices) rows.push([wide(`• ${n}`, cols)]);
  rows.push([], [wide(SUMMARY_DISCLAIMER, cols)], [wide(SUMMARY_LEGAL_NOTICE, cols)]);

  const wb = utils.book_new();
  utils.book_append_sheet(wb, buildSheet(rows, [52, ...Array<number>(cols - 1).fill(20)]), 'Deduction Worksheet');
  wb.Props = { Title: `NetWageTax: ${s.title}`, Author: 'NetWageTax' };
  return wb;
}

export function downloadSchedule1aXlsx(s: Schedule1aSummary): void {
  const bytes = write(buildSchedule1aWorkbook(s), { type: 'array', bookType: 'xlsx', compression: true }) as ArrayBuffer;
  saveBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${s.fileBase}.xlsx`);
}

/** For tests: the workbook as bytes. */
export const schedule1aWorkbookBytes = (s: Schedule1aSummary) => write(buildSchedule1aWorkbook(s), { type: 'buffer', bookType: 'xlsx' }) as Uint8Array;
