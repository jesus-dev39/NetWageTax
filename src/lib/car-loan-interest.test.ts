import { describe, expect, it } from 'vitest';
import { calculateCarLoanInterestDeduction, type CarLoanInterestInput } from './car-loan-interest';
import { estimateFederalTaxSavings } from './marginal-rate';
import { ObbbaInvalidInputError, ObbbaYearNotSupportedError, type TaxYear } from './obbba-params';

function input(overrides: Partial<CarLoanInterestInput>): CarLoanInterestInput {
  return { filingStatus: 'single', magi: 0, taxYear: 2026, interestPaid: 0, isNewVehicle: true, isUsAssembled: true, ...overrides };
}

const deduction = (o: Partial<CarLoanInterestInput>) => calculateCarLoanInterestDeduction(input(o)).deductionFinal;

describe('car loan interest deduction (Schedule 1-A, Part IV)', () => {
  it('C1: single below the threshold keeps all the interest and saves $1,760', () => {
    const r = calculateCarLoanInterestDeduction(input({ magi: 90_000, interestPaid: 8_000 }));
    expect(r.deductionFinal).toBe(8_000);
    expect(r.reductionApplied).toBe(0);
    // Taxable $90,000 − $16,100 = $73,900 → $65,900, all in the 22% bracket.
    expect(estimateFederalTaxSavings(90_000, r.deductionFinal, 'single')).toBeCloseTo(1_760, 6);
  });

  it('C2: no reduction at exactly $100,000; $1 over costs a full $200 step', () => {
    expect(deduction({ magi: 100_000, interestPaid: 8_000 })).toBe(8_000);
    const r = calculateCarLoanInterestDeduction(input({ magi: 100_001, interestPaid: 8_000 }));
    expect(r.phaseoutSteps).toBe(1);
    expect(r.deductionFinal).toBe(7_800);
    expect(r.nextStepAboveMagi).toBe(101_000);
  });

  it('C3: during the phase-out, $125,000 → 25 steps → $3,000 left of $8,000', () => {
    const r = calculateCarLoanInterestDeduction(input({ magi: 125_000, interestPaid: 8_000 }));
    expect(r.excessMagi).toBe(25_000);
    expect(r.phaseoutSteps).toBe(25);
    expect(r.phaseoutReduction).toBe(5_000);
    expect(r.deductionFinal).toBe(3_000);
    expect(r.nextStepAboveMagi).toBe(125_000);
  });

  it('C4: interest above $10,000 is capped, on a joint return too', () => {
    expect(deduction({ magi: 90_000, interestPaid: 12_000 })).toBe(10_000);
    expect(deduction({ filingStatus: 'mfj', magi: 150_000, interestPaid: 18_000 })).toBe(10_000);
  });

  it('C5: past the end of the phase-out the deduction is $0', () => {
    for (const magi of [149_001, 150_000]) {
      const r = calculateCarLoanInterestDeduction(input({ magi, interestPaid: 10_000 }));
      expect(r.deductionFinal).toBe(0);
      expect(r.isFullyPhasedOut).toBe(true);
      expect(r.nextStepAboveMagi).toBeNull();
    }
    expect(deduction({ magi: 149_000, interestPaid: 10_000 })).toBe(200);
    expect(calculateCarLoanInterestDeduction(input({})).fullPhaseoutAboveMagi).toBe(149_000);
    expect(calculateCarLoanInterestDeduction(input({ filingStatus: 'mfj' })).fullPhaseoutAboveMagi).toBe(249_000);
  });

  it('C6: married filing jointly uses the $200,000 threshold', () => {
    expect(deduction({ filingStatus: 'mfj', magi: 210_500, interestPaid: 6_000 })).toBe(3_800);
  });

  it('C7: married filing separately can claim it, with the $100,000 threshold', () => {
    const r = calculateCarLoanInterestDeduction(input({ filingStatus: 'mfs', magi: 110_000, interestPaid: 5_000 }));
    expect(r.isEligible).toBe(true);
    expect(r.deductionFinal).toBe(3_000);
  });

  it('C8: a small amount is wiped out before the cap would be', () => {
    const r = calculateCarLoanInterestDeduction(input({ magi: 120_000, interestPaid: 3_000 }));
    expect(r.deductionFinal).toBe(0);
    expect(r.reductionApplied).toBe(3_000);
    expect(r.isFullyPhasedOut).toBe(false);
  });

  it('C9: used or foreign-assembled vehicles do not qualify', () => {
    const used = calculateCarLoanInterestDeduction(input({ magi: 50_000, interestPaid: 4_000, isNewVehicle: false }));
    expect(used.deductionFinal).toBe(0);
    expect(used.ineligibilityReason).toBe('USED_VEHICLE');
    const imported = calculateCarLoanInterestDeduction(input({ magi: 50_000, interestPaid: 4_000, isUsAssembled: false }));
    expect(imported.deductionFinal).toBe(0);
    expect(imported.ineligibilityReason).toBe('ASSEMBLED_OUTSIDE_US');
  });

  it('validates the year, MAGI, and interest', () => {
    expect(() => calculateCarLoanInterestDeduction(input({ taxYear: 2029 as TaxYear }))).toThrow(ObbbaYearNotSupportedError);
    expect(() => calculateCarLoanInterestDeduction(input({ magi: -1 }))).toThrow(ObbbaInvalidInputError);
    expect(() => calculateCarLoanInterestDeduction(input({ interestPaid: -1 }))).toThrow(ObbbaInvalidInputError);
  });
});
