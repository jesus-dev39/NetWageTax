import { describe, it, expect } from 'vitest';
import { STATES, STATES_BY_CODE } from './state-tax-data';
import { leadParagraph, metaDescription, pageTitle, rankingSentences, stateTipsOvertimeNote, tipsOvertimeStatus } from './state-page-content';

describe('state page copy', () => {
  it('gives every state a unique title, description and lead', () => {
    for (const fn of [pageTitle, metaDescription, leadParagraph]) {
      expect(new Set(STATES.map(fn)).size).toBe(51);
    }
  });

  it('names the tax structure in the title', () => {
    expect(pageTitle(STATES_BY_CODE.CA)).toBe('California Income Tax 2026: Rates, Brackets & Calculator');
    expect(pageTitle(STATES_BY_CODE.CO)).toBe('Colorado Income Tax 2026: 4.4% Flat Rate & Calculator');
    expect(pageTitle(STATES_BY_CODE.TX)).toBe('Texas Income Tax 2026: No State Tax on Wages & Calculator');
  });

  it('ranks without awkward phrasing', () => {
    for (const s of STATES) for (const t of rankingSentences(s)) expect(t).not.toMatch(/the tied/);
  });

  it('reads the tips/overtime treatment from the state data', () => {
    expect(tipsOvertimeStatus(STATES_BY_CODE.CA)).toBe('does-not-follow');
    expect(tipsOvertimeStatus(STATES_BY_CODE.TX)).toBe('no-wage-tax');
    expect(tipsOvertimeStatus(STATES_BY_CODE.NY)).toBe('tips-only');
    expect(tipsOvertimeStatus(STATES_BY_CODE.DC)).toBe('unconfirmed');
  });

  it('writes a calculator note for every state that taxes wages, and none for the rest', () => {
    for (const s of STATES) {
      const note = stateTipsOvertimeNote(s);
      if (s.structure === 'none') expect(note).toBeUndefined();
      else expect(note).toContain(s.tipsOvertime.treatment === 'unconfirmed' ? 'D.C.' : s.name);
    }
    expect(stateTipsOvertimeNote(STATES_BY_CODE.NY)).toBe(
      'New York follows the federal deduction for tips only. Our estimate doesn’t subtract it yet: it taxes your full income.',
    );
    expect(stateTipsOvertimeNote(STATES_BY_CODE.AL)).toContain('up to $1,000 per taxpayer');
  });
});
