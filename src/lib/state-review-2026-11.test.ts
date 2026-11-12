/**
 * Review of November 12, 2026 (states left from the initial data): the four updates approved
 * after checking official 2026 sources.
 */
import { describe, expect, it } from 'vitest';
import { estimateStateTax, STATES_BY_CODE } from './state-tax-data';

describe('state review, November 12, 2026', () => {
  it('Missouri: estimateRate from the 2026 brackets of Form 4282 ($2,117.67 on $65,000)', () => {
    expect(STATES_BY_CODE.MO.estimateRate).toBe(0.0433);
    expect(STATES_BY_CODE.MO.exemptAmount).toBe(16_100);
    // 0% on $1,348, then 2%–4.5% in $1,348 steps, 4.7% over $9,436.
    const exact = [0, 0.02, 0.025, 0.03, 0.035, 0.04, 0.045].reduce((t, r) => t + 1_348 * r, 0) + (48_900 - 9_436) * 0.047;
    expect(exact).toBeCloseTo(2_117.67, 2);
    expect(estimateStateTax(65_000, 'MO').tax).toBeCloseTo(exact, -1);
  });

  it('Pennsylvania: Philadelphia wage tax from July 1, 2026', () => {
    expect(STATES_BY_CODE.PA.localTaxNote).toContain('3.735% for residents and 3.425% for nonresidents from July 1, 2026');
    expect(STATES_BY_CODE.PA.estimateRate).toBe(0.0307);
  });

  it('Washington: no wage tax in 2026, with the 2028 tax note', () => {
    expect(STATES_BY_CODE.WA.structure).toBe('none');
    expect(STATES_BY_CODE.WA.note).toContain('From January 1, 2028, a new 9.9% tax on income over $1 million applies (SB 6346, signed March 2026); legal challenges are expected.');
  });

  it('DC: keeps the federal standard deduction, with a note on the overturned $15,000 law', () => {
    expect(STATES_BY_CODE.DC.exemptAmount).toBe(16_100);
    expect(STATES_BY_CODE.DC.note).toContain('Congress overturned the 2025 law that set DC’s own $15,000 deduction');
    expect(STATES_BY_CODE.DC.tipsOvertime.treatment).toBe('unconfirmed');
  });
});
