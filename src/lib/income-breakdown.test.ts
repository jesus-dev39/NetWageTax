import { describe, it, expect } from 'vitest';
import { buildIncomeBreakdown } from './income-breakdown';
import { estimateFederalTaxSavings } from './marginal-rate';
import { calculateStateIncomeTax } from './state-tax-data';

describe('buildIncomeBreakdown', () => {
  // Single filer, $52,000 MAGI, $8,000 qualified tips, Georgia (4.99% above $12,000).
  const state = calculateStateIncomeTax(52_000, 'GA');
  const b = buildIncomeBreakdown(52_000, 8_000, 'single', state);

  it('shows federal income tax before and after the deduction', () => {
    // Taxable 52,000 − 16,100 = 35,900 → $4,060; after the deduction 27,900 → $3,100.
    expect(b.federalWithoutDeduction).toBeCloseTo(4_060);
    expect(b.federalWithDeduction).toBeCloseTo(3_100);
    expect(b.federalSaved).toBeCloseTo(960);
  });

  it('agrees with the savings figure the calculator shows', () => {
    expect(b.federalSaved).toBeCloseTo(estimateFederalTaxSavings(52_000, 8_000, 'single'));
  });

  it('splits the income into federal, FICA, state, and take-home with nothing left over', () => {
    expect(b.fica).toBeCloseTo(52_000 * 0.0765);
    expect(b.state).toBeCloseTo(40_000 * 0.0499);
    expect(b.federalWithDeduction + b.fica + b.state + b.takeHome).toBeCloseTo(b.total);
    expect(b.takeHome).toBeCloseTo(42_926);
  });

  it('is all zeros with no income', () => {
    const empty = buildIncomeBreakdown(0, 0, 'single');
    expect(empty).toEqual({ total: 0, federalWithoutDeduction: 0, federalWithDeduction: 0, federalSaved: 0, fica: 0, state: 0, takeHome: 0 });
  });
});
