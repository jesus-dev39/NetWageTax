/**
 * paycheck-summary-xlsx.ts
 * Excel (.xlsx) version of the paycheck estimate, generated in the browser.
 * Imported dynamically from PaycheckExportActions so SheetJS only loads on click.
 */

import { utils, write, type WorkBook } from 'xlsx';
import { saveBlob } from './save-blob';
import { PAYCHECK_DISCLAIMER, PAYCHECK_NOT_A_PAYSTUB, type PaycheckSummary } from './paycheck-summary';
import { buildSheet, pctCell, usd, wide, type Cell } from './xlsx-sheet';

export const PAYCHECK_XLSX_FILENAME = 'NetWageTax_2026_Paycheck_Estimate.xlsx';

const COLS = 4;

export function buildPaycheckWorkbook(s: PaycheckSummary): WorkBook {
  const rows: Cell[][] = [
    [wide(`NetWageTax: ${s.taxYear} paycheck and take-home pay estimate`, COLS)],
    ['Estimate reference', s.referenceId, 'Generated', s.generatedAt],
    [wide(PAYCHECK_NOT_A_PAYSTUB, COLS)],
    [],
    [wide('Pay details', COLS)],
    ['Earnings', s.earnings],
    ['Gross wages (annual)', usd(s.gross.annual)],
    ['Pay frequency', `${s.frequencyLabel} (${s.periods} paychecks/year)`],
    ['Filing status', s.filingStatus],
    ['State', s.stateName ?? 'Not selected'],
    [],
    [wide('Withholding', COLS)],
    ['Item', 'Per paycheck', 'Annual', '% of gross'],
    ...s.rows.map((r): Cell[] => [
      r.kind === 'earning' ? `   ${r.label}` : r.label,
      usd(r.kind === 'tax' ? -r.perPeriod : r.perPeriod),
      usd(r.kind === 'tax' ? -r.annual : r.annual),
      s.gross.annual > 0 ? pctCell(r.annual / s.gross.annual) : null,
    ]),
    [],
    [wide('Net take-home pay', COLS)],
    [`Per ${s.frequencyShort} paycheck`, usd(s.net.perPeriod)],
    ['Per year', usd(s.net.annual)],
    [],
    [wide(PAYCHECK_DISCLAIMER, COLS)],
  ];

  const wb = utils.book_new();
  utils.book_append_sheet(wb, buildSheet(rows, [34, 18, 18, 14]), 'Paycheck Estimate');
  wb.Props = { Title: `NetWageTax: ${s.taxYear} paycheck estimate`, Author: 'NetWageTax' };
  return wb;
}

export function downloadPaycheckXlsx(s: PaycheckSummary): void {
  const bytes = write(buildPaycheckWorkbook(s), { type: 'array', bookType: 'xlsx', compression: true }) as ArrayBuffer;
  saveBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), PAYCHECK_XLSX_FILENAME);
}

/** For tests: the workbook as bytes. */
export const paycheckWorkbookBytes = (s: PaycheckSummary) =>
  write(buildPaycheckWorkbook(s), { type: 'buffer', bookType: 'xlsx' }) as Uint8Array;
