/**
 * 2027 federal figures (IRS Rev. Proc. 2026-35, published November 5, 2026), added before the
 * January switch: the constants match the Rev. Proc., the site still calculates 2026, and the four
 * reference cases of docs/MAINTENANCE.md (section 2.4) don't change.
 */
import { describe, it, expect } from 'vitest';
import { calculateCarLoanInterestDeduction } from './car-loan-interest';
import {
  ADDITIONAL_STANDARD_DEDUCTION_AGED_2026,
  ADDITIONAL_STANDARD_DEDUCTION_AGED_2027,
  agedAdditionalStandardDeduction,
  compareFederalTax,
  computeFederalIncomeTax,
  STANDARD_DEDUCTION_2026,
  STANDARD_DEDUCTION_2027,
  TAX_BRACKETS_2026,
  TAX_BRACKETS_2027,
} from './marginal-rate';
import { calculateObbbaDeduction } from './obbba-calculator';
import { CAR_LOAN_PARAMS_BY_YEAR, PARAMS_BY_YEAR, SENIOR_PARAMS_BY_YEAR } from './obbba-params';
import { calculatePaycheck } from './paycheck';
import { calculateSeniorDeduction } from './senior-deduction';
import { SITE_TAX_YEAR } from './site';

const limits = (b: { upTo: number }[]) => b.map((x) => x.upTo);

describe('2027 federal figures (Rev. Proc. 2026-35)', () => {
  it('has the standard deductions of section 3.15(1) and IR-2026-133', () => {
    expect(STANDARD_DEDUCTION_2027).toEqual({ single: 16_600, mfj: 33_200, hoh: 24_925, mfs: 16_600 });
  });

  it('has the bracket limits of section 3.01, Tables 1-4', () => {
    expect(limits(TAX_BRACKETS_2027.single)).toEqual([12_800, 52_025, 109_125, 208_325, 264_550, 661_375, Infinity]);
    expect(limits(TAX_BRACKETS_2027.mfj)).toEqual([25_600, 104_050, 218_250, 416_650, 529_100, 793_650, Infinity]);
    expect(limits(TAX_BRACKETS_2027.hoh)).toEqual([18_250, 69_650, 109_100, 208_300, 264_550, 661_350, Infinity]);
    expect(limits(TAX_BRACKETS_2027.mfs)).toEqual([12_800, 52_025, 109_125, 208_325, 264_550, 396_825, Infinity]);
  });

  it('matches the "plus" amounts of the Rev. Proc. tables at the top of the 35% bracket', () => {
    const taxAt = (status: keyof typeof TAX_BRACKETS_2027, income: number) => {
      let tax = 0;
      let lower = 0;
      for (const { upTo, rate } of TAX_BRACKETS_2027[status]) {
        if (income <= lower) break;
        tax += (Math.min(income, upTo) - lower) * rate;
        lower = upTo;
      }
      return tax;
    };
    expect(taxAt('single', 661_375)).toBeCloseTo(199_237.75, 2);
    expect(taxAt('mfj', 793_650)).toBeCloseTo(213_290.5, 2);
    expect(taxAt('hoh', 661_350)).toBeCloseTo(197_360, 2);
    expect(taxAt('mfs', 396_825)).toBeCloseTo(106_645.25, 2);
  });

  it('has the additional standard deduction for age of section 3.15(3)', () => {
    expect(ADDITIONAL_STANDARD_DEDUCTION_AGED_2027).toEqual({ unmarried: 2_100, married: 1_700 });
  });

  it('keeps the Schedule 1-A amounts for 2027 (not indexed for inflation)', () => {
    expect(PARAMS_BY_YEAR[2027]).toBe(PARAMS_BY_YEAR[2026]);
    expect(SENIOR_PARAMS_BY_YEAR[2027]).toBe(SENIOR_PARAMS_BY_YEAR[2026]);
    expect(CAR_LOAN_PARAMS_BY_YEAR[2027]).toBe(CAR_LOAN_PARAMS_BY_YEAR[2026]);
  });
});

describe('the site still calculates 2026', () => {
  it('keeps SITE_TAX_YEAR at 2026', () => {
    expect(SITE_TAX_YEAR).toBe(2026);
  });

  it('uses the 2026 standard deduction, brackets, and age addition', () => {
    expect(STANDARD_DEDUCTION_2026.single).toBe(16_100);
    expect(ADDITIONAL_STANDARD_DEDUCTION_AGED_2026).toEqual({ unmarried: 2_050, married: 1_650 });
    expect(agedAdditionalStandardDeduction('single', 1)).toBe(2_050);
    // $50,000 of taxable income: 1,240 + 12% × 37,600 with the 2026 single brackets.
    expect(computeFederalIncomeTax(50_000, 'single')).toBeCloseTo(5_752, 6);
    expect(limits(TAX_BRACKETS_2026.single)[0]).toBe(12_400);
  });
});

describe('the four reference cases of docs/MAINTENANCE.md don’t change', () => {
  it('1. home page: $2,092.60 per biweekly paycheck', () => {
    const r = calculatePaycheck({
      mode: 'salary', hourlyRate: 0, hoursPerWeek: 40, overtimeHoursPerWeek: 0, annualSalary: 65_000,
      frequency: 'biweekly', filingStatus: 'single', stateCode: null,
    });
    expect(r.netPerPeriod.toFixed(2)).toBe('2092.60');
  });

  it('2. tips: $960 of federal tax saved on $8,000 of tips at $52,000', () => {
    const r = calculateObbbaDeduction({
      filingStatus: 'single', magi: 52_000, taxYear: 2026,
      hasQualifyingTips: true, tipsAmount: 8_000, tipsOccupationConfirmed: true,
      hasQualifyingOvertime: false, overtimePremiumAmount: 0, isFLSANonExempt: true,
    });
    expect(compareFederalTax(52_000, r.totalCombinedDeduction, 'single').saved).toBeCloseTo(960, 6);
  });

  it('3. senior: $1,320 saved, married filing jointly, both 65, $200,000', () => {
    const r = calculateSeniorDeduction({ filingStatus: 'mfj', magi: 200_000, taxYear: 2026, taxpayerIs65: true, spouseIs65: true });
    const extra = agedAdditionalStandardDeduction('mfj', 2);
    expect(compareFederalTax(200_000, r.deductionFinal, 'mfj', extra).saved).toBeCloseTo(1_320, 6);
  });

  it('4. car loan: $720 saved, single, $125,000, $8,000 of interest', () => {
    const r = calculateCarLoanInterestDeduction({
      filingStatus: 'single', magi: 125_000, taxYear: 2026, interestPaid: 8_000, isNewVehicle: true, isUsAssembled: true,
    });
    expect(r.deductionFinal).toBe(3_000);
    expect(compareFederalTax(125_000, r.deductionFinal, 'single').saved).toBeCloseTo(720, 6);
  });
});
