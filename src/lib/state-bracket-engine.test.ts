import { describe, it, expect } from 'vitest';
import { bracketLines, computeBracketTax, personalCreditAmount, stateDeductionAmount, type BracketEngineRules, type StateDeduction } from './state-bracket-engine';

const SCIAD: StateDeduction = { kind: 'phaseout', max: 15_000, phaseoutStart: 40_000, phaseoutEnd: 95_000, roundDownTo: 10, label: 'SCIAD' };

const RULES: BracketEngineRules = {
  deduction: { kind: 'fixed', amount: 5_000, label: 'Standard deduction' },
  brackets: [
    { over: 0, rate: 0.02 },
    { over: 10_000, rate: 0.05 },
  ],
};

describe('stateDeductionAmount', () => {
  it('returns a fixed deduction at every income', () => {
    expect(stateDeductionAmount(RULES.deduction, 0)).toBe(5_000);
    expect(stateDeductionAmount(RULES.deduction, 1_000_000)).toBe(5_000);
  });

  it('phases the SCIAD out between $40,000 and $95,000, rounding the reduction down to $10', () => {
    expect(stateDeductionAmount(SCIAD, 30_000)).toBe(15_000);
    expect(stateDeductionAmount(SCIAD, 40_000)).toBe(15_000);
    // 15,000 × 25,000 / 55,000 = 6,818.18 → 6,810
    expect(stateDeductionAmount(SCIAD, 65_000)).toBe(8_190);
    expect(stateDeductionAmount(SCIAD, 95_000)).toBe(0);
    expect(stateDeductionAmount(SCIAD, 150_000)).toBe(0);
  });
});

describe('bracketLines', () => {
  it('lists only the brackets the taxable income reaches', () => {
    expect(bracketLines(0, RULES.brackets)).toEqual([]);
    expect(bracketLines(12_000, RULES.brackets)).toEqual([
      { from: 0, to: 10_000, rate: 0.02, taxed: 10_000, tax: 200 },
      { from: 10_000, to: 12_000, rate: 0.05, taxed: 2_000, tax: 100 },
    ]);
  });
});

describe('computeBracketTax', () => {
  it('applies the deduction, then the brackets', () => {
    const r = computeBracketTax(RULES, { income: 17_000 });
    expect(r.deduction).toBe(5_000);
    expect(r.taxableIncome).toBe(12_000);
    expect(r.tax).toBeCloseTo(300);
  });

  it('never deducts more than the income', () => {
    const r = computeBracketTax(RULES, { income: 3_000 });
    expect(r.deduction).toBe(3_000);
    expect(r.tax).toBe(0);
  });

  it('adds surcharges on taxable income above their threshold', () => {
    const rules = { ...RULES, surcharges: [{ over: 100_000, rate: 0.01, label: 'Surcharge' }] };
    expect(computeBracketTax(rules, { income: 95_000 }).surcharges).toEqual([]);
    const r = computeBracketTax(rules, { income: 125_000 });
    expect(r.surcharges[0].taxed).toBe(20_000);
    expect(r.tax).toBeCloseTo(200 + 110_000 * 0.05 + 200);
  });

  it('subtracts personal credits from the tax, not below zero', () => {
    const credit = (amount: number) => ({ ...RULES, personalCredits: { amount, label: 'Credit' } });
    expect(computeBracketTax(credit(100), { income: 17_000 }).tax).toBeCloseTo(200);
    expect(computeBracketTax(credit(1_000), { income: 17_000 }).tax).toBe(0);
    expect(computeBracketTax(credit(100), { income: 17_000 }).personalCreditLabel).toBe('Credit');
  });

  it('reduces a credit for each step, or part of one, of income above the start, never below 0', () => {
    const c = { amount: 153, label: 'Credit', phaseout: { start: 252_203, stepSize: 2_500, reductionPerStep: 6 } };
    expect(personalCreditAmount(c, 252_203)).toBe(153);
    expect(personalCreditAmount(c, 252_204)).toBe(147); // a part of a step counts as a full step
    expect(personalCreditAmount(c, 254_703)).toBe(147);
    expect(personalCreditAmount(c, 254_704)).toBe(141);
    expect(personalCreditAmount(c, 1_000_000)).toBe(0);
  });

  it('subtracts federal income tax from the base only when the rule is set, up to its cap', () => {
    expect(computeBracketTax(RULES, { income: 17_000, federalTax: 2_000 }).taxableIncome).toBe(12_000);
    const rules = { ...RULES, federalTaxSubtraction: { cap: 1_500 } };
    const r = computeBracketTax(rules, { income: 17_000, federalTax: 2_000 });
    expect(r.federalTaxSubtracted).toBe(1_500);
    expect(r.taxableIncome).toBe(10_500);
  });

  it('uses the single brackets for a status without its own schedule, and says so', () => {
    const single = computeBracketTax(RULES, { income: 50_000 });
    const mfj = computeBracketTax(RULES, { income: 50_000, filingStatus: 'mfj' });
    expect(mfj.tax).toBe(single.tax);
    expect(single.usedSingleBrackets).toBe(false);
    expect(mfj.usedSingleBrackets).toBe(true);

    const withMfj = { ...RULES, bracketsByStatus: { mfj: [{ over: 0, rate: 0.01 }] } };
    const own = computeBracketTax(withMfj, { income: 50_000, filingStatus: 'mfj' });
    expect(own.tax).toBeCloseTo(450);
    expect(own.usedSingleBrackets).toBe(false);
  });
});
