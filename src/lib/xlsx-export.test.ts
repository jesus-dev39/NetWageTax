import { describe, it, expect } from 'vitest';
import { read, utils } from 'xlsx';
import { buildDeductionSummary } from './deduction-summary';
import { deductionWorkbookBytes } from './deduction-summary-xlsx';
import { calculateObbbaDeduction } from './obbba-calculator';
import { calculatePaycheck, type PaycheckInput } from './paycheck';
import { buildPaycheckSummary } from './paycheck-summary';
import { paycheckWorkbookBytes } from './paycheck-summary-xlsx';
import { estimateStateTax } from './state-tax-data';
import { FMT_PCT, FMT_USD } from './xlsx-sheet';

const at = new Date('2026-09-26T12:00:00');
const sheetOf = (bytes: Uint8Array) => {
  const wb = read(bytes, { cellFormula: true, cellNF: true });
  return wb.Sheets[wb.SheetNames[0]];
};
const rowsOf = (ws: ReturnType<typeof sheetOf>) => utils.sheet_to_json<(string | number)[]>(ws, { header: 1, blankrows: true, defval: null });
const find = (rows: (string | number)[][], label: string) => rows.find((r) => r[0] === label);

describe('tips & overtime .xlsx', () => {
  const result = calculateObbbaDeduction({
    filingStatus: 'single', magi: 160_000, taxYear: 2026,
    hasQualifyingTips: true, tipsAmount: 30_000, tipsOccupationConfirmed: true,
    hasQualifyingOvertime: true, overtimePremiumAmount: 5_000, isFLSANonExempt: true,
  });
  const summary = buildDeductionSummary(
    { result, tipsReported: 30_000, overtimeReported: 5_000, savings: 6_600, stateTax: estimateStateTax(160_000, 'IL') },
    at,
  );
  const ws = sheetOf(deductionWorkbookBytes(summary));
  const rows = rowsOf(ws);

  it('has the banner, reference, and parameters', () => {
    expect(rows[0][0]).toBe('NetWageTax - 2026 Federal Tips & Overtime Deduction Worksheet');
    expect(rows[1]).toContain(summary.referenceId);
    expect(find(rows, 'Filing status')?.[1]).toBe('Single');
    expect(find(rows, 'State')?.[1]).toBe('Illinois');
    expect(find(rows, 'MAGI / AGI')?.[1]).toBe(160_000);
    expect(ws['!merges']?.some((m) => m.s.r === 0 && m.e.c === 5)).toBe(true);
  });

  it('stores the breakdown as formatted numbers with SUM totals', () => {
    expect(find(rows, 'Category')?.slice(0, 6)).toEqual(['Category', 'Reported', 'Statutory cap', 'After cap', 'Phase-out', 'Net allowed']);
    const tips = rows.find((r) => String(r[0]).startsWith('Qualified tips (TP)'))!;
    expect(tips.slice(1, 6)).toEqual([30_000, 25_000, 25_000, -1_000, 24_000]);
    const totalRow = rows.findIndex((r) => r[0] === 'Total');
    expect(rows[totalRow][5]).toBe(28_000);
    const cell = ws[utils.encode_cell({ r: totalRow, c: 5 })];
    expect(cell.f).toMatch(/^SUM\(F\d+:F\d+\)$/);
    expect(cell.z).toBe(FMT_USD);
  });

  it('includes the tax impact and the legal note', () => {
    expect(find(rows, 'Estimated federal income tax savings')?.[1]).toBe(6_600);
    expect(find(rows, 'Estimated state income tax (IL)')?.[1]).toBeCloseTo((160_000 - 2_850) * 0.0495, 1);
    expect(rows.some((r) => String(r[0]).startsWith('For estimation purposes only'))).toBe(true);
  });
});

describe('paycheck .xlsx', () => {
  const input: PaycheckInput = {
    mode: 'hourly', hourlyRate: 25, hoursPerWeek: 40, overtimeHoursPerWeek: 5, annualSalary: 0,
    frequency: 'biweekly', filingStatus: 'single', stateCode: 'GA',
  };
  const summary = buildPaycheckSummary(input, calculatePaycheck(input), at);
  const ws = sheetOf(paycheckWorkbookBytes(summary));
  const rows = rowsOf(ws);

  it('has the banner, estimate labels, and pay details', () => {
    expect(rows[0][0]).toBe('NetWageTax - 2026 Paycheck & Take-Home Pay Estimate');
    expect(rows[1]).toContain(summary.referenceId);
    expect(rows[2][0]).toMatch(/Not a pay stub/);
    expect(find(rows, 'Gross wages (annual)')?.[1]).toBe(61_750);
    expect(find(rows, 'Pay frequency')?.[1]).toBe('Bi-Weekly (26 paychecks/year)');
    expect(find(rows, 'State')?.[1]).toBe('Georgia');
  });

  it('itemizes withholding per paycheck and per year with % of gross', () => {
    expect(find(rows, 'Item')?.slice(0, 4)).toEqual(['Item', 'Per paycheck', 'Annual', '% of gross']);
    const federal = find(rows, 'Federal income tax')!;
    expect(federal[2]).toBe(-5_230);
    expect(federal[1]).toBeCloseTo(-5_230 / 26, 2);
    const net = find(rows, 'Net take-home pay')!;
    // Georgia 2026: 4.99% on $61,750 − $12,000 = $2,482.53 (HB 463).
    expect(net[2]).toBeCloseTo(49_313.6, 2);
    const r = rows.findIndex((row) => row[0] === 'Federal income tax');
    expect(ws[utils.encode_cell({ r, c: 3 })].z).toBe(FMT_PCT);
  });

  it('ends with the take-home totals', () => {
    expect(find(rows, 'Per bi-weekly paycheck')?.[1]).toBeCloseTo(1_896.68, 2);
    expect(find(rows, 'Per year')?.[1]).toBeCloseTo(49_313.6, 2);
  });
});
