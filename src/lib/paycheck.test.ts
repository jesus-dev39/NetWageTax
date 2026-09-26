import { describe, it, expect } from 'vitest';
import { calculatePaycheck, type PaycheckInput } from './paycheck';

const base: PaycheckInput = {
  mode: 'hourly',
  hourlyRate: 25,
  hoursPerWeek: 40,
  overtimeHoursPerWeek: 0,
  annualSalary: 0,
  frequency: 'biweekly',
  filingStatus: 'single',
  stateCode: null,
};

describe('calculatePaycheck', () => {
  it('annualizes hourly pay and computes 2026 federal tax and FICA', () => {
    const r = calculatePaycheck(base);
    expect(r.grossAnnual).toBe(52_000);
    // Taxable 52,000 − 16,100 = 35,900 → 10% × 12,400 + 12% × 23,500.
    expect(r.taxableIncome).toBe(35_900);
    expect(r.federalTax).toBeCloseTo(4_060);
    expect(r.marginalRate).toBe(0.12);
    expect(r.socialSecurity).toBeCloseTo(3_224);
    expect(r.medicare).toBeCloseTo(754);
    expect(r.netAnnual).toBeCloseTo(52_000 - 4_060 - 3_224 - 754);
    expect(r.netPerPeriod).toBeCloseTo(r.netAnnual / 26);
  });

  it('pays overtime at 1.5× the hourly rate', () => {
    const r = calculatePaycheck({ ...base, overtimeHoursPerWeek: 5 });
    expect(r.overtimePay).toBe(25 * 1.5 * 5 * 52);
    expect(r.grossAnnual).toBe(52_000 + 9_750);
  });

  it('uses the salary directly in salary mode and splits by frequency', () => {
    for (const [frequency, periods] of [['weekly', 52], ['semimonthly', 24], ['monthly', 12]] as const) {
      const r = calculatePaycheck({ ...base, mode: 'salary', annualSalary: 90_000, frequency });
      expect(r.grossAnnual).toBe(90_000);
      expect(r.periods).toBe(periods);
    }
  });

  it('caps Social Security at the 2026 wage base and adds Additional Medicare by filing status', () => {
    const single = calculatePaycheck({ ...base, mode: 'salary', annualSalary: 300_000 });
    expect(single.socialSecurity).toBeCloseTo(184_500 * 0.062);
    expect(single.additionalMedicare).toBeCloseTo(100_000 * 0.009);
    expect(single.medicare).toBeCloseTo(300_000 * 0.0145 + 900);

    const joint = calculatePaycheck({ ...base, mode: 'salary', annualSalary: 300_000, filingStatus: 'mfj' });
    expect(joint.additionalMedicare).toBeCloseTo(50_000 * 0.009);
  });

  it('adds state tax only when a state is chosen', () => {
    expect(calculatePaycheck({ ...base, stateCode: 'TX' }).stateTax).toBe(0);
    expect(calculatePaycheck({ ...base, stateCode: 'PA' }).stateTax).toBeCloseTo(52_000 * 0.0307);
  });

  it('treats empty or invalid inputs as zero', () => {
    const r = calculatePaycheck({ ...base, hourlyRate: Number.NaN, hoursPerWeek: -5 });
    expect(r.grossAnnual).toBe(0);
    expect(r.totalTax).toBe(0);
    expect(r.netPerPeriod).toBe(0);
  });
});

describe('paycheck export summary', async () => {
  const { buildPaycheckSummary } = await import('./paycheck-summary');
  const { buildPaycheckDocument } = await import('./paycheck-summary-docx');
  const { Packer } = await import('docx');
  const input = { ...base, overtimeHoursPerWeek: 5, stateCode: 'GA' as const };
  const s = buildPaycheckSummary(input, calculatePaycheck(input), new Date('2026-09-26T12:00:00'));

  it('labels itself an estimate and itemizes regular and overtime pay', () => {
    expect(s.referenceId).toMatch(/^NWT-2026-[0-9A-Z]{6}$/);
    expect(s.rows.map((r) => r.label)).toEqual([
      'Regular pay',
      'Overtime pay (1.5×)',
      'Gross pay',
      'Federal income tax',
      'Social Security',
      'Medicare',
      'State income tax (GA)',
      'Total taxes withheld (est.)',
      'Net take-home pay',
    ]);
  });

  it('keeps taxes + net equal to gross, per paycheck and per year', () => {
    const taxes = s.rows.filter((r) => r.kind === 'tax').reduce((t, r) => t + r.annual, 0);
    expect(taxes + s.net.annual).toBeCloseTo(s.gross.annual);
    expect(s.net.perPeriod * 26).toBeCloseTo(s.net.annual);
  });

  it('produces a valid .docx package', async () => {
    const buf = await Packer.toBuffer(buildPaycheckDocument(s));
    expect(buf.subarray(0, 2).toString()).toBe('PK');
  });
});
