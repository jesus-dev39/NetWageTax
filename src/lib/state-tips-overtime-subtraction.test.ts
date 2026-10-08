import { describe, it, expect } from 'vitest';
import { calculateObbbaDeduction } from './obbba-calculator';
import type { FilingStatus } from './obbba-params';
import { calculateStateIncomeTax, estimateStateTax, type StateCode } from './state-tax-data';
import { stateTipsOvertimeSubtraction } from './state-tips-overtime-subtraction';

/** Runs the federal engine, then the state subtraction, the way TaxCalculatorApp does. */
function subtract(code: StateCode, opts: { magi: number; tips: number; overtime: number; filing?: FilingStatus; both?: boolean }) {
  const filingStatus = opts.filing ?? 'single';
  const result = calculateObbbaDeduction({
    filingStatus, magi: opts.magi, taxYear: 2026,
    hasQualifyingTips: opts.tips > 0, tipsAmount: opts.tips, tipsOccupationConfirmed: true,
    hasQualifyingOvertime: opts.overtime > 0, overtimePremiumAmount: opts.overtime, isFLSANonExempt: true,
  });
  return {
    result,
    sub: stateTipsOvertimeSubtraction(code, {
      tipsDeduction: result.tips.deductionFinal,
      overtimeDeduction: result.overtime.deductionFinal,
      tipsReported: opts.tips,
      overtimePremiumReported: opts.overtime,
      filingStatus,
      bothSpousesHaveOvertime: opts.both,
    }),
  };
}

const base = { magi: 60_000, tips: 8_000, overtime: 3_000 };

describe('stateTipsOvertimeSubtraction', () => {
  it('follows (Arizona): subtracts both final federal deductions', () => {
    const { sub } = subtract('AZ', base);
    expect(sub).toEqual({ tips: 8_000, overtime: 3_000, total: 11_000 });
    const est = estimateStateTax(60_000, 'AZ', sub.total);
    expect(est.stateDeduction).toBe(11_000);
    expect(est.tax).toBeCloseTo((60_000 - 11_000 - 16_100) * 0.025);
  });

  it('tips only (New York): subtracts the tips deduction, not overtime', () => {
    expect(subtract('NY', base).sub).toEqual({ tips: 8_000, overtime: 0, total: 8_000 });
  });

  it('own (Georgia): $1,750 of tips and $1,750 of overtime, whatever the federal amounts', () => {
    expect(subtract('GA', base).sub).toEqual({ tips: 1_750, overtime: 1_750, total: 3_500 });
    expect(subtract('GA', { magi: 60_000, tips: 1_000, overtime: 500 }).sub.total).toBe(1_500);
    // No federal phase-out: at $500,000 the federal deductions are gone, Georgia's isn't.
    const high = subtract('GA', { ...base, magi: 500_000 });
    expect(high.result.totalCombinedDeduction).toBe(0);
    expect(high.sub.total).toBe(3_500);
  });

  it('own (Alabama): overtime premium up to $1,000 per taxpayer with overtime, never tips', () => {
    expect(subtract('AL', base).sub).toEqual({ tips: 0, overtime: 1_000, total: 1_000 });
    expect(subtract('AL', { ...base, filing: 'mfj' }).sub.total).toBe(1_000);
    expect(subtract('AL', { ...base, filing: 'mfj', both: true }).sub.total).toBe(2_000);
    expect(subtract('AL', { ...base, overtime: 1_500, filing: 'mfj', both: true }).sub.total).toBe(1_500);
    // "Both spouses" only matters on a joint return.
    expect(subtract('AL', { ...base, both: true }).sub.total).toBe(1_000);
  });

  it('does not follow (California), not yet confirmed (DC), and no wage tax (Texas): nothing', () => {
    for (const code of ['CA', 'DC', 'TX'] as const) expect(subtract(code, base).sub.total).toBe(0);
    expect(estimateStateTax(60_000, 'TX', 5_000)).toMatchObject({ tax: 0, stateDeduction: 0 });
  });

  it('follows the federal phase-out: subtracts the deduction already reduced by income', () => {
    // Single, $200,000 of MAGI: $50,000 over the threshold cuts $5,000 from $10,000 of tips.
    const { result, sub } = subtract('AZ', { magi: 200_000, tips: 10_000, overtime: 0 });
    expect(result.tips.deductionFinal).toBe(5_000);
    expect(sub.total).toBe(5_000);
    expect(subtract('NY', { magi: 200_000, tips: 10_000, overtime: 0 }).sub.total).toBe(5_000);
  });

  it('married filing separately: no federal deduction, so nothing in follows or tips-only states', () => {
    const mfs = { ...base, filing: 'mfs' as const };
    expect(subtract('AZ', mfs).result.totalCombinedDeduction).toBe(0);
    expect(subtract('AZ', mfs).sub.total).toBe(0);
    expect(subtract('NY', mfs).sub.total).toBe(0);
    // Georgia's own exclusion has no filing-status rule.
    expect(subtract('GA', mfs).sub.total).toBe(3_500);
  });

  it('never subtracts more than income in the estimate', () => {
    const est = estimateStateTax(2_000, 'GA', 3_500);
    expect(est.stateDeduction).toBe(2_000);
    expect(est.tax).toBe(calculateStateIncomeTax(0, 'GA'));
  });
});
