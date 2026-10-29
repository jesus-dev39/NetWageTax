/**
 * Joint and head of household rules in the four bracket-engine states. Reference values worked out by hand from
 * each state's own table ("$X plus Y% of the excess over $Z"), not from the engine.
 */
import { describe, it, expect } from 'vitest';
import type { FilingStatus } from './obbba-params';
import { calculateStateIncomeTax, estimateStateTax, singleRatesWarning, stateTaxBreakdown, STATES_BY_CODE, type StateCode } from './state-tax-data';

type Case = [StateCode, FilingStatus, number, number];

const CASES: Case[] = [
  // California, Schedule Y: $11,412 deduction, 2 × $153 credits.
  ['CA', 'mfj', 65_000, 565.38], //     $53,588:  $828.98 + 4% × ($53,588 − $52,528) = $871.38 − $306
  ['CA', 'mfj', 120_000, 3_279.06], // $108,588: $2,044.02 + 6% × ($108,588 − $82,904) = $3,585.06 − $306
  ['CA', 'mfj', 250_000, 14_759.96], // $238,588: $6,403.94 + 9.3% × ($238,588 − $145,448) = $15,065.96 − $306
  // California, Schedule Z: $11,412 deduction, 1 × $153 credit.
  ['CA', 'hoh', 65_000, 718.19], //     $53,588:  $828.87 + 4% × ($53,588 − $52,530) = $871.19 − $153
  ['CA', 'hoh', 120_000, 4_356.06], // $108,588: $3,616.45 + 9.3% × ($108,588 − $98,990) = $4,509.06 − $153
  ['CA', 'hoh', 250_000, 16_446.06], // $238,588: $3,616.45 + 9.3% × ($238,588 − $98,990) = $16,599.06 − $153
  // New York, Tax Law 601(a), $16,050 deduction. The statute's base amounts are rounded to the dollar; the bracket
  // sum below is $0.10–$0.20 higher (see the last test).
  ['NY', 'mfj', 65_000, 2_310.8], //    $48,950:  $1,174.10 + 5.4% × ($48,950 − $27,900)
  ['NY', 'mfj', 120_000, 5_280.8], //  $103,950:  $1,174.10 + 5.4% × ($103,950 − $27,900)
  ['NY', 'mfj', 250_000, 12_662.8], // $233,950:  $8,391.20 + 5.9% × ($233,950 − $161,550)
  // New York, 601(b), $11,200 deduction.
  ['NY', 'hoh', 65_000, 2_656.575], //  $53,800:    $879.975 + 5.4% × ($53,800 − $20,900)
  ['NY', 'hoh', 120_000, 5_632.325], // $108,800: $5,564.475 + 5.9% × ($108,800 − $107,650)
  ['NY', 'hoh', 250_000, 13_302.325], // $238,800: $5,564.475 + 5.9% × ($238,800 − $107,650)
  // South Carolina: same brackets for everyone (5.21% × taxable − $966 above $30,000); SCIAD by status.
  ['SC', 'mfj', 65_000, 857.5], //      SCIAD $30,000 (AGI under $80,000): $35,000 × 5.21% − $966
  ['SC', 'mfj', 120_000, 4_290.89], //  $30,000 − $10,900 ($30,000 × 40,000/110,000 = $10,909, down to $10): $100,900
  ['SC', 'mfj', 250_000, 12_059], //    SCIAD $0 from $190,000: $250,000 × 5.21% − $966
  ['SC', 'hoh', 65_000, 1_319.11], //   $22,500 − $1,360 ($22,500 × 5,000/82,500 = $1,364): $43,860
  ['SC', 'hoh', 120_000, 4_966.11], //  $22,500 − $16,360 ($22,500 × 60,000/82,500 = $16,364): $113,860
  ['SC', 'hoh', 250_000, 12_059], //    SCIAD $0 from $142,500
  // West Virginia: same brackets for single, joint, and head of household; $2,000 per exemption.
  ['WV', 'mfj', 65_000, 1_996.3], //    $61,000:  $1,950.50 + 4.58% × ($61,000 − $60,000)
  ['WV', 'mfj', 120_000, 4_515.3], //  $116,000
  ['WV', 'mfj', 250_000, 10_469.3], // $246,000
  ['WV', 'hoh', 65_000, 2_087.9], //    $63,000
  ['WV', 'hoh', 120_000, 4_606.9], //  $118,000
  ['WV', 'hoh', 250_000, 10_560.9], // $248,000
];

describe('joint and head of household state tax, worked out by hand', () => {
  it.each(CASES)('%s %s at $%d is $%d', (code, status, income, expected) => {
    expect(calculateStateIncomeTax(income, code, status)).toBeCloseTo(expected, 2);
  });

  it('matches the external review’s case: California, married filing jointly, $120,000 is about $3,280', () => {
    expect(Math.round(calculateStateIncomeTax(120_000, 'CA', 'mfj'))).toBe(3_279);
  });
});

describe('details of each state’s rules', () => {
  it('California: deduction, credits, and their phase-out by status', () => {
    const mfj = stateTaxBreakdown(120_000, 'CA', 'mfj')!;
    expect([mfj.deduction, mfj.personalCredits, mfj.usedSingleBrackets]).toEqual([11_412, 306, false]);
    expect(stateTaxBreakdown(120_000, 'CA', 'hoh')!.personalCredits).toBe(153);
    // Joint: $12 less for each $2,500 or part above $504,411 → gone at $600,000 (39 steps).
    expect(stateTaxBreakdown(510_000, 'CA', 'mfj')!.personalCredits).toBe(306 - 3 * 12);
    expect(stateTaxBreakdown(600_000, 'CA', 'mfj')!.personalCredits).toBe(0);
    // Head of household: $6 less per step above $378,310 → $400,000 is 9 steps, $153 − $54 = $99.
    expect(stateTaxBreakdown(400_000, 'CA', 'hoh')!.personalCredits).toBe(99);
    expect(calculateStateIncomeTax(400_000, 'CA', 'hoh')).toBeCloseTo(3_616.45 + 0.093 * (388_588 - 98_990) - 99, 2);
  });

  it('California: the 1% surcharge above $1,000,000 applies to every filing status', () => {
    for (const status of ['single', 'mfj', 'hoh'] as FilingStatus[]) {
      const r = stateTaxBreakdown(1_211_412, 'CA', status)!;
      const surcharge = r.surcharges.find((s) => s.label === 'Behavioral Health Services Tax');
      expect(surcharge?.tax).toBeCloseTo(0.01 * (r.taxableIncome - 1_000_000), 2);
    }
  });

  it('South Carolina: SCIAD by status, and the same brackets for everyone', () => {
    expect(stateTaxBreakdown(80_000, 'SC', 'mfj')!.deduction).toBe(30_000);
    expect(stateTaxBreakdown(190_000, 'SC', 'mfj')!.deduction).toBe(0);
    expect(stateTaxBreakdown(60_000, 'SC', 'hoh')!.deduction).toBe(22_500);
    expect(stateTaxBreakdown(142_500, 'SC', 'hoh')!.deduction).toBe(0);
    const rules = STATES_BY_CODE.SC.bracketEngine!;
    expect(rules.bracketsByStatus?.mfj).toEqual(rules.brackets);
    expect(rules.bracketsByStatus?.hoh).toEqual(rules.brackets);
  });

  it('West Virginia: $4,000 of exemptions on a joint return, $2,000 for a head of household', () => {
    expect(stateTaxBreakdown(65_000, 'WV', 'mfj')!.deduction).toBe(4_000);
    expect(stateTaxBreakdown(65_000, 'WV', 'hoh')!.deduction).toBe(2_000);
  });

  it('New York: the bracket sum is within $1 of the statute’s rounded base amounts', () => {
    // 601(a): "$1,174 plus 5.40% of excess over $27,900"; 601(b): "$879 plus 5.40% of excess over $20,900".
    expect(calculateStateIncomeTax(65_000, 'NY', 'mfj') - (1_174 + 0.054 * (48_950 - 27_900))).toBeCloseTo(0.1, 2);
    expect(calculateStateIncomeTax(65_000, 'NY', 'hoh') - (879 + 0.054 * (53_800 - 20_900))).toBeCloseTo(0.975, 2);
  });

  it('keeps the single figures unchanged', () => {
    expect(calculateStateIncomeTax(65_000, 'CA')).toBeCloseTo(1_974.57, 2);
    expect(stateTaxBreakdown(65_000, 'SC')!.deduction).toBe(8_190);
  });
});

describe('single-rates warning', () => {
  it('is gone for joint and head of household filers in the four states, and stays for separate returns', () => {
    for (const code of ['CA', 'NY', 'SC', 'WV'] as StateCode[]) {
      expect(singleRatesWarning(code, 'mfj')).toBeUndefined();
      expect(singleRatesWarning(code, 'hoh')).toBeUndefined();
      expect(singleRatesWarning(code, 'mfs')).toBeDefined();
      expect(estimateStateTax(120_000, code, 0, 'mfj').singleRatesWarning).toBeUndefined();
    }
    expect(singleRatesWarning('GA', 'mfj')).toBeDefined();
  });
});

describe('how the calculators describe the state tax', async () => {
  const { stateTaxMethod } = await import('./state-tax-data');
  const { buildPaycheckRows } = await import('./paycheck-summary');
  const { calculatePaycheck } = await import('./paycheck');

  it('names the method for each kind of state and filing status', () => {
    expect(stateTaxMethod('CA', 'mfj')).toBe('brackets for your filing status');
    expect(stateTaxMethod('CA', 'single')).toBe('brackets for your filing status');
    expect(stateTaxMethod('CA', 'mfs')).toBe('single-filer brackets');
    expect(stateTaxMethod('GA', 'mfj')).toBe('simplified single-filer estimate');
    expect(estimateStateTax(65_000, 'NY', 0, 'hoh').method).toBe('brackets for your filing status');
  });

  it('uses the joint figures in the paycheck breakdown, without the warning', () => {
    const input = {
      mode: 'salary' as const, hourlyRate: 0, hoursPerWeek: 40, overtimeHoursPerWeek: 0, annualSalary: 120_000,
      frequency: 'biweekly' as const, filingStatus: 'mfj' as const, stateCode: 'CA' as const,
    };
    const row = buildPaycheckRows(input, calculatePaycheck(input)).find((r) => r.label === 'State income tax (CA)')!;
    expect(row.annual).toBeCloseTo(3_279.06, 2);
    expect(row.detail).toContain('brackets for your filing status');
    expect(row.warning).toBeUndefined();
  });
});
