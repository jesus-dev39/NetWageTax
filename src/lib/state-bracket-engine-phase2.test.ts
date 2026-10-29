/**
 * Bracket engine phase 2: Arizona, Georgia, Maryland, North Carolina, and Oregon by filing status. Reference values worked
 * out by hand from each state's own documents (see the comments in BRACKETS), not from the engine.
 */
import { describe, it, expect } from 'vitest';
import type { FilingStatus } from './obbba-params';
import { calculatePaycheck } from './paycheck';
import {
  calculateStateIncomeTax,
  estimateStateTax,
  federalTaxOnWages,
  singleRatesWarning,
  stateTaxBreakdown,
  type StateCode,
} from './state-tax-data';

type Case = [StateCode, FilingStatus, number, number, string];

const CASES: Case[] = [
  ['AZ', 'single', 65_000, 1_222.5, '2.5% × ($65,000 − $16,100)'],
  ['AZ', 'single', 150_000, 3_347.5, '2.5% × ($150,000 − $16,100)'],
  ['AZ', 'mfj', 65_000, 820, '2.5% × ($65,000 − $32,200)'],
  ['AZ', 'mfj', 150_000, 2_945, '2.5% × ($150,000 − $32,200)'],
  ['AZ', 'hoh', 65_000, 1_021.25, '2.5% × ($65,000 − $24,150)'],
  ['AZ', 'hoh', 150_000, 3_146.25, '2.5% × ($150,000 − $24,150)'],
  ['NC', 'single', 65_000, 2_084.775, '3.99% × ($65,000 − $12,750)'],
  ['NC', 'single', 150_000, 5_476.275, '3.99% × ($150,000 − $12,750)'],
  ['NC', 'mfj', 65_000, 1_576.05, '3.99% × ($65,000 − $25,500)'],
  ['NC', 'mfj', 150_000, 4_967.55, '3.99% × ($150,000 − $25,500)'],
  ['NC', 'hoh', 65_000, 1_830.4125, '3.99% × ($65,000 − $19,125)'],
  ['NC', 'hoh', 150_000, 5_221.9125, '3.99% × ($150,000 − $19,125)'],
  ['GA', 'single', 65_000, 2_495, '4.99% × ($65,000 − $15,000)'],
  ['GA', 'single', 150_000, 6_736.5, '4.99% × ($150,000 − $15,000)'],
  ['GA', 'mfj', 65_000, 1_746.5, '4.99% × ($65,000 − $30,000)'],
  ['GA', 'mfj', 150_000, 5_988, '4.99% × ($150,000 − $30,000)'],
  ['GA', 'hoh', 65_000, 2_495, '4.99% × ($65,000 − $15,000)'],
  ['GA', 'hoh', 150_000, 6_736.5, '4.99% × ($150,000 − $15,000)'],
  // Maryland Schedule I (single): $90 + 4.75% over $3,000 up to $100,000, $4,697.50 + 5% to $125,000, $5,947.50 + 5.25% to $150,000,
  // $7,260 + 5.5% to $250,000. Schedule II (joint, head of household): $90 + 4.75% to $150,000, $7,072.50 + 5% to $175,000,
  // $8,322.50 + 5.25% to $225,000. Deduction: $3,350 / $6,700 plus the exemptions for the federal AGI band.
  ['MD', 'single', 65_000, 2_723.875, '$65,000 − $6,550 = $58,450: $90 + 4.75% × $55,450'],
  ['MD', 'single', 100_000, 4_386.375, 'top of the full exemption: $100,000 − $6,550 = $93,450: $90 + 4.75% × $90,450'],
  ['MD', 'single', 110_000, 4_950, '$1,600 exemption: $110,000 − $4,950 = $105,050: $4,697.50 + 5% × $5,050'],
  ['MD', 'single', 140_000, 6_517.125, '$800 exemption: $140,000 − $4,150 = $135,850: $5,947.50 + 5.25% × $10,850'],
  ['MD', 'single', 150_000, 7_042.125, '$800 exemption: $145,850: $5,947.50 + 5.25% × $20,850'],
  ['MD', 'single', 160_000, 7_625.75, 'no exemption: $160,000 − $3,350 = $156,650: $7,260 + 5.5% × $6,650'],
  ['MD', 'mfj', 65_000, 2_412.75, '$65,000 − $13,100 = $51,900: $90 + 4.75% × $48,900'],
  ['MD', 'mfj', 150_000, 6_450.25, '2 × $3,200: $150,000 − $13,100 = $136,900: $90 + 4.75% × $133,900'],
  ['MD', 'mfj', 160_000, 7_077.5, '2 × $1,600: $160,000 − $9,900 = $150,100: $7,072.50 + 5% × $100'],
  ['MD', 'mfj', 190_000, 8_674.25, '2 × $800: $190,000 − $8,300 = $181,700: $8,322.50 + 5.25% × $6,700'],
  ['MD', 'mfj', 210_000, 9_808.25, 'no exemption: $210,000 − $6,700 = $203,300: $8,322.50 + 5.25% × $28,300'],
  ['MD', 'hoh', 65_000, 2_564.75, '$65,000 − $9,900 = $55,100: $90 + 4.75% × $52,100'],
  ['MD', 'hoh', 150_000, 6_602.25, '$3,200: $150,000 − $9,900 = $140,100: $90 + 4.75% × $137,100'],
  ['MD', 'hoh', 160_000, 7_157.5, '$1,600: $160,000 − $8,300 = $151,700: $7,072.50 + 5% × $1,700'],
  ['MD', 'hoh', 190_000, 8_716.25, '$800: $190,000 − $7,500 = $182,500: $8,322.50 + 5.25% × $7,500'],
  ['MD', 'hoh', 210_000, 9_808.25, 'no exemption: $203,300'],
  // Oregon: single 4.75% / 6.75% over $4,550 / 8.75% over $11,400 / 9.9% over $125,000; joint and head of household twice as
  // wide. Federal tax on wages: 2026 standard deduction and brackets.
  ['OR', 'single', 65_000, 4_359.125, 'federal $5,620 (under the $8,750 cap): $56,470 taxable, $4,622.13 − $263 credit'],
  ['OR', 'single', 100_000, 7_147.75, 'federal $13,170, capped at $8,750: $88,340 taxable, $7,410.75 − $263'],
  ['OR', 'single', 127_000, 9_926.375, 'AGI $125,000–$130,000: cap $7,000; $117,090 taxable; no credit over $100,000'],
  ['OR', 'single', 150_000, 12_805.41, 'AGI $145,000 or more: no subtraction, no credit; $147,090 taxable'],
  ['OR', 'mfj', 65_000, 3_713.25, 'federal $3,440: $55,740 taxable, $4,239.25 − 2 × $263'],
  ['OR', 'mfj', 150_000, 10_686.125, 'federal $15,340, capped at $8,750: $135,430 taxable, $11,212.13 − $526'],
  ['OR', 'mfj', 255_000, 20_552.75, 'AGI $250,000–$260,000: cap $7,000; $242,180 taxable; no credit over $200,000'],
  ['OR', 'hoh', 65_000, 3_989.55, 'federal $4,548: $65,000 − $4,560 − $4,548 = $55,892, joint brackets $4,252.55 − $263'],
  ['OR', 'hoh', 150_000, 11_059.375, 'federal $20,991, capped at $8,750: $136,690 taxable, $11,322.38 − $263'],
];

describe('state tax by filing status, worked out by hand', () => {
  it.each(CASES)('%s %s at $%d: $%d (%s)', (code, status, income, expected) => {
    expect(calculateStateIncomeTax(income, code, status)).toBeCloseTo(expected, 2);
  });
});

describe('Oregon federal tax subtraction', () => {
  it('subtracts the federal tax when it is under the cap, and the cap when it is over', () => {
    expect(stateTaxBreakdown(65_000, 'OR')!.federalTaxSubtracted).toBe(5_620);
    expect(stateTaxBreakdown(100_000, 'OR')!.federalTaxSubtracted).toBe(8_750);
  });

  it('lowers the cap by $1,750 for each step of federal AGI', () => {
    const cap = (income: number, status: FilingStatus) => stateTaxBreakdown(income, 'OR', status)!.federalTaxSubtracted;
    expect([124_999, 125_000, 127_000, 130_000, 135_000, 140_000, 144_999, 145_000].map((i) => cap(i, 'single'))).toEqual([
      8_750, 7_000, 7_000, 5_250, 3_500, 1_750, 1_750, 0,
    ]);
    expect([249_999, 250_000, 260_000, 270_000, 280_000, 290_000].map((i) => cap(i, 'mfj'))).toEqual([8_750, 7_000, 5_250, 3_500, 1_750, 0]);
    expect(cap(255_000, 'hoh')).toBe(7_000);
  });

  it('drops the exemption credit above $100,000 single and $200,000 joint or head of household', () => {
    expect(stateTaxBreakdown(100_000, 'OR')!.personalCredits).toBe(263);
    expect(stateTaxBreakdown(100_001, 'OR')!.personalCredits).toBe(0);
    expect(stateTaxBreakdown(200_000, 'OR', 'mfj')!.personalCredits).toBe(526);
    expect(stateTaxBreakdown(200_001, 'OR', 'mfj')!.personalCredits).toBe(0);
    expect(stateTaxBreakdown(200_000, 'OR', 'hoh')!.personalCredits).toBe(263);
  });

  it('uses the federal tax actually paid: after the Schedule 1-A deduction in the tips calculator', () => {
    // $52,000 MAGI with $8,000 of tips: federal tax $3,100 after the deduction ($4,060 before). Oregon follows the federal
    // deduction, so state income is $44,000: $44,000 − $2,910 − $3,100 = $37,990 taxable, $3,005.13 − $263 = $2,742.13.
    expect(federalTaxOnWages(44_000, 'single')).toBe(3_100);
    const withPaid = estimateStateTax(52_000, 'OR', 8_000, 'single', 3_100);
    expect(withPaid.tax).toBeCloseTo(2_742.125, 2);
    // Without it, the default is the federal tax on the full $52,000 ($4,060), which would be wrong here.
    expect(estimateStateTax(52_000, 'OR', 8_000, 'single').tax).toBeCloseTo(2_742.125 - 0.0875 * 960, 2);
  });

  it('measures the phase-out on federal AGI, not on state income after the tips subtraction', () => {
    // $128,000 MAGI with $5,000 subtracted: the $123,000 left would get the full cap, but AGI $128,000 means $7,000.
    expect(stateTaxBreakdown(123_000, 'OR', 'single', { agi: 128_000, federalTax: 20_000 })!.federalTaxSubtracted).toBe(7_000);
  });

  it('matches the paycheck calculator, whose federal tax is the same model', () => {
    const r = calculatePaycheck({
      mode: 'salary', hourlyRate: 0, hoursPerWeek: 40, overtimeHoursPerWeek: 0, annualSalary: 65_000,
      frequency: 'biweekly', filingStatus: 'single', stateCode: 'OR',
    });
    expect(r.federalTax).toBe(5_620);
    expect(r.stateTax).toBeCloseTo(4_359.125, 2);
  });
});

describe('the five states have their own rules for joint and head of household returns', () => {
  it('drops the single-filer rates warning', () => {
    for (const code of ['AZ', 'GA', 'MD', 'NC', 'OR'] as StateCode[]) {
      for (const status of ['single', 'mfj', 'hoh'] as FilingStatus[]) {
        expect(singleRatesWarning(code, status), `${code} ${status}`).toBeUndefined();
        expect(stateTaxBreakdown(65_000, code, status)!.usedSingleBrackets).toBe(false);
      }
    }
    expect(singleRatesWarning('IL', 'mfj')).toBeDefined();
  });

  it('keeps reference case 2 unchanged: Georgia single, $52,000 MAGI with the $1,750 tips exclusion', () => {
    // (52,000 − 1,750 − 15,000) × 4.99% = $1,758.975 ($1,759), as before the move to the engine.
    expect(estimateStateTax(52_000, 'GA', 1_750).tax).toBeCloseTo(1_758.975, 6);
  });
});
