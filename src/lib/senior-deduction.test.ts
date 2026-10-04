import { describe, expect, it } from 'vitest';
import { agedAdditionalStandardDeduction, estimateFederalTaxSavings } from './marginal-rate';
import { ObbbaInvalidInputError, ObbbaYearNotSupportedError, seniorBirthCutoffLabel, type TaxYear } from './obbba-params';
import { calculateSeniorDeduction, type SeniorDeductionInput } from './senior-deduction';

function input(overrides: Partial<SeniorDeductionInput>): SeniorDeductionInput {
  return { filingStatus: 'single', magi: 0, taxYear: 2026, taxpayerIs65: true, ...overrides };
}

/** Savings the way the page figures them: standard deduction plus the extra amount for age 65. */
function savings(i: SeniorDeductionInput) {
  const r = calculateSeniorDeduction(i);
  return estimateFederalTaxSavings(i.magi, r.deductionFinal, i.filingStatus, agedAdditionalStandardDeduction(i.filingStatus, r.qualifyingPeople));
}

describe('senior deduction (Schedule 1-A, Part V)', () => {
  it('2026 birth cutoff is January 2, 1962', () => {
    expect(seniorBirthCutoffLabel(2026)).toBe('January 2, 1962');
    expect(seniorBirthCutoffLabel(2025)).toBe('January 2, 1961');
  });

  it('S1: single below the threshold gets the full $6,000 and saves $720', () => {
    const i = input({ magi: 60_000 });
    const r = calculateSeniorDeduction(i);
    expect(r.deductionFinal).toBe(6_000);
    expect(r.reductionTotal).toBe(0);
    // Taxable $60,000 − $16,100 − $2,050 = $41,850 → $35,850, all in the 12% bracket.
    expect(savings(i)).toBeCloseTo(720, 6);
  });

  it('S2: single at $100,000 loses 6% of $25,000', () => {
    const r = calculateSeniorDeduction(input({ magi: 100_000 }));
    expect(r.excessMagi).toBe(25_000);
    expect(r.reductionPerPerson).toBeCloseTo(1_500, 6);
    expect(r.deductionFinal).toBeCloseTo(4_500, 6);
    expect(r.isFullyPhasedOut).toBe(false);
  });

  it('S3: fully phased out at $175,000 (single) and above', () => {
    for (const magi of [175_000, 180_000]) {
      const r = calculateSeniorDeduction(input({ magi }));
      expect(r.deductionFinal).toBe(0);
      expect(r.reductionPerPerson).toBe(6_000);
      expect(r.isFullyPhasedOut).toBe(true);
    }
    expect(calculateSeniorDeduction(input({ magi: 175_000 })).fullPhaseoutMagi).toBe(175_000);
  });

  it('S4: head of household uses the $75,000 threshold', () => {
    expect(calculateSeniorDeduction(input({ filingStatus: 'hoh', magi: 85_000 })).deductionFinal).toBeCloseTo(5_400, 6);
  });

  it('S5: married filing jointly, both 65: reduction applies to each $6,000', () => {
    const i = input({ filingStatus: 'mfj', magi: 200_000, spouseIs65: true });
    const r = calculateSeniorDeduction(i);
    expect(r.qualifyingPeople).toBe(2);
    expect(r.maxDeduction).toBe(12_000);
    expect(r.reductionPerPerson).toBeCloseTo(3_000, 6);
    expect(r.deductionFinal).toBeCloseTo(6_000, 6);
    expect(r.fullPhaseoutMagi).toBe(250_000);
    // Taxable $200,000 − $32,200 − 2 × $1,650 = $164,500 → $158,500, all in the 22% bracket.
    expect(savings(i)).toBeCloseTo(1_320, 6);
  });

  it('S6: married filing jointly, only one spouse 65', () => {
    const r = calculateSeniorDeduction(input({ filingStatus: 'mfj', magi: 120_000, spouseIs65: false }));
    expect(r.qualifyingPeople).toBe(1);
    expect(r.deductionFinal).toBe(6_000);
    const spouseOnly = calculateSeniorDeduction(input({ filingStatus: 'mfj', magi: 120_000, taxpayerIs65: false, spouseIs65: true }));
    expect(spouseOnly.deductionFinal).toBe(6_000);
  });

  it('S7: a spouse only counts on a joint return', () => {
    expect(calculateSeniorDeduction(input({ filingStatus: 'single', taxpayerIs65: false, spouseIs65: true })).isEligible).toBe(false);
  });

  it('S8: married filing separately cannot claim it', () => {
    const r = calculateSeniorDeduction(input({ filingStatus: 'mfs', magi: 50_000, spouseIs65: true }));
    expect(r.deductionFinal).toBe(0);
    expect(r.ineligibilityReason).toBe('MARRIED_FILING_SEPARATELY');
  });

  it('S9: under 65 (born on or after January 2, 1962) gets nothing', () => {
    const r = calculateSeniorDeduction(input({ magi: 50_000, taxpayerIs65: false }));
    expect(r.deductionFinal).toBe(0);
    expect(r.ineligibilityReason).toBe('NO_QUALIFYING_PERSON');
  });

  it('S10: the 6% reduction is not rounded', () => {
    expect(calculateSeniorDeduction(input({ magi: 75_010.5 })).deductionFinal).toBeCloseTo(5_999.37, 6);
  });

  it('S11: savings are $0 when the standard deduction covers all income', () => {
    expect(savings(input({ magi: 18_000 }))).toBe(0);
  });

  it('validates the year and MAGI', () => {
    expect(() => calculateSeniorDeduction(input({ taxYear: 2029 as TaxYear }))).toThrow(ObbbaYearNotSupportedError);
    expect(() => calculateSeniorDeduction(input({ magi: -1 }))).toThrow(ObbbaInvalidInputError);
  });
});
