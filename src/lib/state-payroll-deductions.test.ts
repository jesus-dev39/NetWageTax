import { describe, it, expect } from 'vitest';
import { calculatePaycheck, type PaycheckInput } from './paycheck';
import { buildPaycheckRows, buildPaycheckSummary } from './paycheck-summary';
import { PAYROLL_MAX_SHARE_NOTE, STATE_PAYROLL_RULES, statePayrollDeductions, statePayrollNoteOnly } from './state-payroll-deductions';
import type { StateCode } from './state-tax-data';

const amounts = (code: StateCode, wages: number) => statePayrollDeductions(code, wages)!.lines.map((l) => [l.name, +l.amount.toFixed(2)]);
const total = (code: StateCode, wages: number) => +statePayrollDeductions(code, wages)!.total.toFixed(2);

// Reference values worked out by hand at $65,000 of wages ($1,250 a week).
const AT_65K: [StateCode, number, string][] = [
  ['CA', 845, '1.3% × $65,000'],
  ['NY', 312, 'SDI 0.5% × $1,250 = $6.25 a week, capped at $0.60 × 52 = $31.20; PFL 0.432% × $65,000 = $280.80'],
  ['NJ', 463.4, 'TDI 0.19% × $65,000 = $123.50; FLI 0.23% × $65,000 = $149.50; UI + WF/SWF 0.425% × $44,800 cap = $190.40'],
  ['WA', 901.65, 'PFML 1.13% × 71.43% × $65,000 = $524.65; WA Cares 0.58% × $65,000 = $377'],
  ['MA', 299, '0.46% × $65,000'],
  ['OR', 455, 'Paid Leave 0.6% × $65,000 = $390; transit tax 0.1% × $65,000 = $65'],
  ['RI', 715, '1.1% × $65,000'],
  ['HI', 325, '0.5% × $1,250 = $6.25 a week (under the $7.50 maximum) × 52'],
  ['CO', 286, '0.44% × $65,000'],
  ['CT', 325, '0.5% × $65,000'],
  ['MN', 286, '0.44% × $65,000'],
  ['DE', 260, '0.4% × $65,000'],
  ['ME', 325, '0.5% × $65,000'],
  ['AK', 271, '0.5% × $54,200 cap'],
  ['PA', 45.5, '0.07% × $65,000'],
];

describe('state payroll deductions at $65,000', () => {
  it.each(AT_65K)('%s: $%d (%s)', (code, expected) => {
    expect(total(code, 65_000)).toBeCloseTo(expected, 2);
  });

  it('covers exactly the states in the approved table', () => {
    expect(Object.keys(STATE_PAYROLL_RULES).sort()).toEqual([...AT_65K.map(([c]) => c), 'MD', 'VT'].sort());
  });
});

describe('caps and maximums', () => {
  it('New Jersey at $200,000: TDI and FLI stop at $171,100, UI + WF/SWF at $44,800', () => {
    expect(amounts('NJ', 200_000)).toEqual([
      ['TDI', 325.09],
      ['FLI', 393.53],
      ['UI + WF/SWF', 190.4],
    ]);
  });

  it('applies the other caps at $200,000', () => {
    expect(amounts('NY', 200_000)).toEqual([['SDI', 31.2], ['PFL', 411.91]]);
    expect(total('HI', 200_000)).toBe(390); // $7.50 a week × 52
    expect(total('RI', 200_000)).toBe(1_100);
    expect(total('CA', 200_000)).toBe(2_600); // no cap
    expect(amounts('WA', 200_000)).toEqual([['PFML', 1_489.21], ['WA Cares', 1_160]]); // PFML on $184,500
    expect(amounts('OR', 200_000)).toEqual([['Paid Leave Oregon', 1_107], ['Statewide Transit Tax', 200]]);
    expect(total('MN', 200_000)).toBe(814); // $185,000 cap
    expect(total('MA', 200_000)).toBeCloseTo(848.7, 2); // $184,500 cap
    expect(total('AK', 200_000)).toBe(271);
    expect(total('PA', 200_000)).toBe(140); // no cap
  });

  it('is nothing in Maryland, Vermont, states without a program, and with no state', () => {
    expect(statePayrollDeductions('MD', 65_000)).toBeNull();
    expect(statePayrollDeductions('VT', 65_000)).toBeNull();
    expect(statePayrollDeductions('TX', 65_000)).toBeNull();
    expect(statePayrollDeductions(null, 65_000)).toBeNull();
    expect(statePayrollNoteOnly('MD')).toMatch(/January 1, 2027/);
    expect(statePayrollNoteOnly('VT')).toMatch(/0\.11%/);
    expect(statePayrollNoteOnly('CA')).toBeUndefined();
  });

  it('notes the maximum employee share, plus Delaware’s employer size', () => {
    expect(statePayrollDeductions('CA', 65_000)!.note).toBe(PAYROLL_MAX_SHARE_NOTE);
    expect(statePayrollDeductions('DE', 65_000)!.note).toContain('25 or more employees');
  });

  it('keeps a source and a check date for every state', () => {
    for (const rule of Object.values(STATE_PAYROLL_RULES)) {
      expect(rule!.sources.length).toBeGreaterThan(0);
      expect(rule!.sources.every((s) => s.url.startsWith('https://'))).toBe(true);
      expect(rule!.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('in the paycheck calculator', () => {
  const base: PaycheckInput = {
    mode: 'salary', hourlyRate: 0, hoursPerWeek: 40, overtimeHoursPerWeek: 0, annualSalary: 65_000,
    frequency: 'biweekly', filingStatus: 'single', stateCode: 'CA',
  };

  it('comes off take-home pay without changing any income tax', () => {
    const ca = calculatePaycheck(base);
    const noState = calculatePaycheck({ ...base, stateCode: null });
    expect(ca.statePayroll?.total).toBeCloseTo(845, 2);
    expect(ca.federalTax).toBe(noState.federalTax);
    expect(ca.taxableIncome).toBe(noState.taxableIncome);
    expect(ca.stateTax).toBeCloseTo(1_974.57, 2); // the same California income tax as before
    expect(ca.netAnnual).toBeCloseTo(noState.netAnnual - ca.stateTax - 845, 2);
    expect(ca.netPerPeriod).toBeCloseTo((noState.netAnnual - ca.stateTax - 845) / 26, 2);
  });

  it('adds a "California SDI" row with the assumption, and keeps rows adding up', () => {
    const r = calculatePaycheck(base);
    const rows = buildPaycheckRows(base, r);
    const sdi = rows.find((x) => x.label === 'California SDI')!;
    expect([sdi.kind, +sdi.annual.toFixed(2), sdi.detail, sdi.note]).toEqual(['tax', 845, 'SDI 1.3% of all wages', PAYROLL_MAX_SHARE_NOTE]);
    const withheld = rows.filter((x) => x.kind === 'tax').reduce((t, x) => t + x.annual, 0);
    expect(withheld).toBeCloseTo(r.totalTax, 6);
    expect(rows.find((x) => x.kind === 'subtotal')!.label).toBe('Total taxes and deductions (est.)');
    expect(buildPaycheckSummary(base, r, new Date('2026-10-29T12:00:00')).totalLabel).toBe('Total taxes and deductions (est.)');
  });

  it('names the combined rows', () => {
    const label = (stateCode: StateCode) => buildPaycheckRows({ ...base, stateCode }, calculatePaycheck({ ...base, stateCode })).map((x) => x.label);
    expect(label('NY')).toContain('New York SDI & PFL');
    expect(label('NJ')).toContain('New Jersey TDI, FLI, UI & WF/SWF');
    expect(label('WA')).toContain('Washington PFML & WA Cares');
    expect(label('TX')).not.toContain('Total taxes and deductions (est.)');
  });

  it('leaves the home page reference case unchanged: $2,092.60 with no state', () => {
    expect(calculatePaycheck({ ...base, stateCode: null }).netPerPeriod.toFixed(2)).toBe('2092.60');
  });
});
