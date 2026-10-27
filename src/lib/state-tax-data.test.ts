import { describe, it, expect } from 'vitest';
import {
  BRACKET_ENGINE_STATES,
  calculateStateIncomeTax,
  estimateStateTax,
  findState,
  formatStateRate,
  relatedStates,
  statePagePath,
  stateTaxBreakdown,
  STATES,
  STATES_BY_CODE,
} from './state-tax-data';
import { US_STATE_PATHS } from './us-state-paths';

describe('state tax dataset', () => {
  it('covers all 50 states plus DC with unique codes and slugs', () => {
    expect(STATES).toHaveLength(51);
    expect(new Set(STATES.map((s) => s.code)).size).toBe(51);
    expect(new Set(STATES.map((s) => s.slug)).size).toBe(51);
  });

  it('has a map shape for every state', () => {
    expect(Object.keys(US_STATE_PATHS).sort()).toEqual(STATES.map((s) => s.code).sort());
  });

  it('lists exactly the nine states without a wage income tax', () => {
    const none = STATES.filter((s) => s.structure === 'none').map((s) => s.code).sort();
    expect(none).toEqual(['AK', 'FL', 'NH', 'NV', 'SD', 'TN', 'TX', 'WA', 'WY']);
  });

  it('keeps rates and exemptions in sane ranges', () => {
    for (const s of STATES) {
      expect(s.estimateRate).toBeGreaterThanOrEqual(0);
      expect(s.estimateRate).toBeLessThan(0.1);
      expect(s.exemptAmount).toBeGreaterThanOrEqual(0);
      expect(s.note.length).toBeGreaterThan(10);
      if (s.structure === 'graduated') expect(s.bracketRange).toBeDefined();
    }
  });
});

describe('calculateStateIncomeTax', () => {
  it('returns 0 for no-income-tax states', () => {
    expect(calculateStateIncomeTax(80_000, 'TX')).toBe(0);
    expect(calculateStateIncomeTax(80_000, 'FL')).toBe(0);
  });

  it('applies flat rates above the exempt amount', () => {
    expect(calculateStateIncomeTax(50_000, 'PA')).toBeCloseTo(1_535);
    expect(calculateStateIncomeTax(62_750, 'NC')).toBeCloseTo(50_000 * 0.0399);
    expect(calculateStateIncomeTax(10_000, 'NC')).toBe(0);
  });

  it('runs the bracket engine only for California, New York, South Carolina, and West Virginia', () => {
    expect(BRACKET_ENGINE_STATES.map((s) => s.code)).toEqual(['CA', 'NY', 'SC', 'WV']);
    // Vermont has a bracket table but stays on the simplified estimate.
    expect(STATES_BY_CODE.VT.bracketEngine).toBeUndefined();
  });

  // Reference values worked out by hand from BRACKETS (single filer, wages = state income).
  it.each([
    // CA: $5,700 deduction. 1% to $11,079; 2% to $26,264; 4% to $41,452; 6% to $57,542; 8% to $72,724; 9.3%...
    ['CA', 30_000, 375.21], //    24,300: 110.79 + 13,221 × 2%
    ['CA', 65_000, 2_128.05], //  59,300: 1,987.41 + 1,758 × 8%
    ['CA', 150_000, 9_858.54], // 144,300: 3,201.97 + 71,576 × 9.3%
    ['CA', 1_200_000, 129_678.51], // 1,194,300: 72,219.83 + 451,347 × 12.3% + 194,300 × 1% surcharge
    // NY: $8,000 deduction. 3.9% to $8,500; 4.4% to $11,700; 5.15% to $13,900; 5.4% to $80,650; 5.9% to $215,400
    ['NY', 30_000, 1_023.0], //   22,000: 585.60 + 8,100 × 5.4%
    ['NY', 65_000, 2_913.0], //   57,000: 585.60 + 43,100 × 5.4%
    ['NY', 150_000, 7_809.75], // 142,000: 4,190.10 + 61,350 × 5.9% (recapture not included)
    // SC: SCIAD $15,000 / $8,190 / $0. 1.99% to $30,000, then 5.21%
    ['SC', 30_000, 298.5], //     15,000 × 1.99%
    ['SC', 65_000, 1_993.8], //   56,810: 597 + 26,810 × 5.21%
    ['SC', 150_000, 6_849.0], //  150,000: 597 + 120,000 × 5.21%
    // WV: $2,000 exemption. 2.11% to $10,000; 2.81% to $25,000; 3.16% to $40,000; 4.22% to $60,000; 4.58%
    ['WV', 30_000, 727.3], //     28,000: 632.50 + 3,000 × 3.16%
    ['WV', 65_000, 2_087.9], //   63,000: 1,950.50 + 3,000 × 4.58%
    ['WV', 150_000, 5_980.9], //  148,000: 1,950.50 + 88,000 × 4.58%
  ] as const)('%s at $%i is $%d', (code, wages, expected) => {
    expect(calculateStateIncomeTax(wages, code)).toBeCloseTo(expected, 2);
  });

  it('uses the single brackets for every filing status for now', () => {
    expect(calculateStateIncomeTax(65_000, 'CA', 'mfj')).toBe(calculateStateIncomeTax(65_000, 'CA'));
    expect(stateTaxBreakdown(65_000, 'CA', 'hoh')?.usedSingleBrackets).toBe(true);
    expect(stateTaxBreakdown(65_000, 'TX')).toBeUndefined();
  });

  it('tells the calculators which method the state uses', () => {
    expect(estimateStateTax(65_000, 'CA').usesBrackets).toBe(true);
    expect(estimateStateTax(65_000, 'GA').usesBrackets).toBe(false);
    expect(estimateStateTax(65_000, 'NY', 0, 'mfj').tax).toBeCloseTo(2_913);
  });

  it('breaks the $65,000 example into one line per bracket used', () => {
    const r = stateTaxBreakdown(65_000, 'WV')!;
    expect(r.deduction).toBe(2_000);
    expect(r.lines.map((l) => [l.from, l.to])).toEqual([
      [0, 10_000],
      [10_000, 25_000],
      [25_000, 40_000],
      [40_000, 60_000],
      [60_000, 63_000],
    ]);
    expect(stateTaxBreakdown(1_200_000, 'CA')!.surcharges[0].tax).toBeCloseTo(1_943);
  });
});

describe('lookup and labels', () => {
  it('finds states by code or slug', () => {
    expect(findState('tx')?.code).toBe('TX');
    expect(findState('north-carolina')?.code).toBe('NC');
    expect(findState('district-of-columbia')?.code).toBe('DC');
    expect(findState('nowhere')).toBeUndefined();
  });

  it('formats rate labels', () => {
    expect(formatStateRate(STATES_BY_CODE.FL)).toBe('No state income tax');
    expect(formatStateRate(STATES_BY_CODE.NC)).toBe('3.99% flat tax');
    expect(formatStateRate(STATES_BY_CODE.CA)).toBe('1%–13.3% progressive');
  });
});

describe('state page data', () => {
  it('uses lowercase hyphenated slugs and trailing-slash page paths', () => {
    for (const s of STATES) expect(s.slug).toMatch(/^[a-z]+(-[a-z]+)*$/);
    expect(statePagePath(STATES_BY_CODE.NY)).toBe('/state-taxes/new-york/');
    expect(statePagePath(STATES_BY_CODE.DC)).toBe('/state-taxes/district-of-columbia/');
  });

  it('has symmetric neighbor lists', () => {
    for (const s of STATES) {
      expect(s.neighbors).not.toContain(s.code);
      for (const n of s.neighbors) expect(STATES_BY_CODE[n].neighbors).toContain(s.code);
    }
  });

  it('does not count Four Corners point contacts as borders', () => {
    expect(STATES_BY_CODE.AZ.neighbors).not.toContain('CO');
    expect(STATES_BY_CODE.CO.neighbors).not.toContain('AZ');
    expect(STATES_BY_CODE.NM.neighbors).not.toContain('UT');
    expect(STATES_BY_CODE.UT.neighbors).not.toContain('NM');
  });

  it('only uses https source URLs, or leaves them empty', () => {
    for (const s of STATES) expect(s.sourceUrl).toMatch(/^(https:\/\/.+)?$/);
  });

  it('links every state to 3–4 other states', () => {
    for (const s of STATES) {
      const related = relatedStates(s.code);
      expect(related.length).toBeGreaterThanOrEqual(3);
      expect(related.length).toBeLessThanOrEqual(4);
      expect(related.map((r) => r.code)).not.toContain(s.code);
      expect(new Set(related.map((r) => r.code)).size).toBe(related.length);
    }
  });
});

describe('bracket schedules', () => {
  const withBrackets = STATES.filter((s) => s.brackets);

  it('includes the verified CA, NY, SC, VT, and WV schedules', () => {
    expect(withBrackets.map((s) => s.code).sort()).toEqual(['CA', 'NY', 'SC', 'VT', 'WV']);
  });

  it('has a year and an official https source for every schedule', () => {
    for (const s of withBrackets) {
      expect(s.bracketsYear).toBeGreaterThanOrEqual(2025);
      expect(s.bracketsSource).toMatch(/^https:\/\//);
    }
  });

  it('starts at $0, rises monotonically and stays inside bracketRange', () => {
    for (const s of withBrackets) {
      const b = s.brackets!;
      expect(b[0].over).toBe(0);
      expect(b[0].rate).toBeCloseTo(s.bracketRange![0]);
      for (let i = 1; i < b.length; i++) {
        expect(b[i].over).toBeGreaterThan(b[i - 1].over);
        expect(b[i].rate).toBeGreaterThan(b[i - 1].rate);
      }
      expect(b[b.length - 1].rate).toBeLessThanOrEqual(s.bracketRange![1]);
    }
  });

  it('does not change the $65,000 estimate without an engine (display only)', () => {
    expect(calculateStateIncomeTax(65_000, 'VT')).toBeCloseTo((65_000 - 13_050) * 0.0351);
  });
});

describe('Georgia (HB 463, 2026)', () => {
  const ga = STATES_BY_CODE.GA;

  it('uses the 4.99% rate and the 2026 $12,000 single standard deduction', () => {
    expect(ga.estimateRate).toBe(0.0499);
    expect(ga.exemptAmount).toBe(12_000);
    expect(calculateStateIncomeTax(65_000, 'GA')).toBeCloseTo((65_000 - 12_000) * 0.0499);
    expect(formatStateRate(ga)).toBe('4.99% flat tax');
  });

  it('has its own tips and overtime exclusion instead of the federal deduction, and cites its source', () => {
    expect(ga.tipsOvertime.treatment).toBe('own');
    expect(ga.tipsOvertime.detail).toContain('up to $1,750 of qualified overtime');
    expect(ga.rateSource?.url).toMatch(/^https:\/\/gov\.georgia\.gov\//);
  });
});

describe('Flat-tax states reviewed October 2026', () => {
  it('uses the verified 2026 exempt amounts', () => {
    expect(STATES_BY_CODE.IL.exemptAmount).toBe(2_925);
    expect(STATES_BY_CODE.KY.exemptAmount).toBe(3_360);
    expect(STATES_BY_CODE.LA.exemptAmount).toBe(12_875);
    expect(STATES_BY_CODE.MI.exemptAmount).toBe(5_900);
  });

  it('adds the $2,150 Ohio personal exemption to the $26,050 0% band', () => {
    expect(STATES_BY_CODE.OH.exemptAmount).toBe(26_050 + 2_150);
    expect(calculateStateIncomeTax(65_000, 'OH')).toBeCloseTo((65_000 - 28_200) * 0.0275);
  });

  it('uses the 4.45% Utah rate from SB 60 (2026) and cites the code', () => {
    expect(STATES_BY_CODE.UT.estimateRate).toBe(0.0445);
    expect(formatStateRate(STATES_BY_CODE.UT)).toBe('4.45% flat tax');
    expect(STATES_BY_CODE.UT.rateSource?.url).toMatch(/^https:\/\/le\.utah\.gov\//);
  });

  it('notes Michigan’s own 2026–2028 tips and overtime deductions', () => {
    expect(STATES_BY_CODE.MI.tipsOvertime.treatment).toBe('follows');
    expect(STATES_BY_CODE.MI.tipsOvertime.detail).toContain('2026 through 2028');
  });
});

describe('local income tax labels', () => {
  it('says None without a local tax note and gives every state with one a label', () => {
    for (const s of STATES) {
      if (!s.localTaxNote) expect(s.localTaxLabel).toBe('None');
      else expect(s.localTaxLabel).not.toBe('None');
    }
    expect(STATES.filter((s) => s.localTaxNote)).toHaveLength(15);
  });

  it('uses "Some cities" where only cities tax wages', () => {
    expect(STATES_BY_CODE.MI.localTaxLabel).toBe('Some cities');
    expect(STATES_BY_CODE.KY.localTaxLabel).toBe('Some cities and counties');
  });
});

describe('progressive states reviewed October 2026', () => {
  const taxFromBrackets = (income: number, brackets: { over: number; rate: number }[]) =>
    brackets.reduce((t, b, i) => {
      const top = brackets[i + 1]?.over ?? Infinity;
      return income > b.over ? t + (Math.min(income, top) - b.over) * b.rate : t;
    }, 0);

  it('matches the SC and WV 2026 schedules and the VT 2025 schedule at $65,000 within $5', () => {
    for (const code of ['SC', 'WV', 'VT'] as const) {
      const s = STATES_BY_CODE[code];
      const exact = taxFromBrackets(65_000 - s.exemptAmount, s.brackets!);
      expect(Math.abs(calculateStateIncomeTax(65_000, code) - exact)).toBeLessThan(5);
    }
  });

  it('uses the 2026 exempt amounts and the Arkansas 3.7% top rate', () => {
    expect(STATES_BY_CODE.AR.exemptAmount).toBe(2_470);
    expect(STATES_BY_CODE.AR.bracketRange![1]).toBe(0.037);
    expect(STATES_BY_CODE.NE.exemptAmount).toBe(8_850);
    expect(STATES_BY_CODE.OR.exemptAmount).toBe(2_910);
    expect(STATES_BY_CODE.RI.exemptAmount).toBe(16_450);
    expect(STATES_BY_CODE.VT.exemptAmount).toBe(7_650 + 5_400);
    expect(STATES_BY_CODE.VA.exemptAmount).toBe(9_680);
    expect(STATES_BY_CODE.ME.exemptAmount).toBe(15_700 + 5_300);
    expect(STATES_BY_CODE.HI.exemptAmount).toBe(8_000 + 1_144);
    expect(STATES_BY_CODE.WI.exemptAmount).toBe(13_960 - Math.round(0.12 * (65_000 - 20_120)) + 700);
  });

  it('calibrates Oregon with the federal tax subtraction and the $256 credit', () => {
    const federalTax = 12_400 * 0.1 + (65_000 - 16_100 - 12_400) * 0.12;
    const taxable = 65_000 - 2_910 - federalTax;
    const exact = 4_550 * 0.0475 + 6_850 * 0.0675 + (taxable - 11_400) * 0.0875 - 256;
    expect(Math.abs(calculateStateIncomeTax(65_000, 'OR') - exact)).toBeLessThan(5);
  });

  it('marks Arizona as following the federal tips and overtime deduction (HB 4168)', () => {
    expect(STATES_BY_CODE.AZ.tipsOvertime.treatment).toBe('follows');
    expect(STATES_BY_CODE.AZ.tipsOvertime.detail).toContain('HB 4168');
    expect(STATES_BY_CODE.AZ.exemptAmount).toBe(16_100);
  });
});
