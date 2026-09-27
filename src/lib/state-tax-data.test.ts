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
    expect(formatStateRate(STATES_BY_CODE.FL)).toBe('0% State Tax');
    expect(formatStateRate(STATES_BY_CODE.NC)).toBe('3.99% Flat Tax');
    expect(formatStateRate(STATES_BY_CODE.CA)).toBe('1%–13.3% Progressive');
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
