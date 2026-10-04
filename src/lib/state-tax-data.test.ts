import { describe, it, expect } from 'vitest';
import { calculateStateIncomeTax, findState, formatStateRate, relatedStates, statePagePath, STATES, STATES_BY_CODE } from './state-tax-data';
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

  it('includes the verified CA and NY schedules', () => {
    expect(withBrackets.map((s) => s.code).sort()).toEqual(['CA', 'NY']);
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

  it('does not change the $65,000 estimate', () => {
    expect(calculateStateIncomeTax(65_000, 'CA')).toBeCloseTo((65_000 - 5_700) * 0.033);
    expect(calculateStateIncomeTax(65_000, 'NY')).toBeCloseTo((65_000 - 8_000) * 0.051);
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

  it('does not follow the federal tips and overtime deduction and cites its source', () => {
    expect(ga.followsFederalTipsOvertime).toBe(false);
    expect(ga.tipsOvertimeNote).toContain('$1,750 of overtime and $1,750 of cash tips');
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
    expect(STATES_BY_CODE.MI.followsFederalTipsOvertime).toBe(true);
    expect(STATES_BY_CODE.MI.tipsOvertimeNote).toContain('2026 through 2028');
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
