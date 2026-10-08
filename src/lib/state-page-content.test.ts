import { describe, it, expect } from 'vitest';
import { STATES, STATES_BY_CODE } from './state-tax-data';
import { leadParagraph, metaDescription, pageTitle, rankingSentences, stateCalculatorLinks, stateTipsOvertimeNote, tipsOvertimeStatus } from './state-page-content';

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
    expect(stateTipsOvertimeNote(STATES_BY_CODE.NY)).toBe('New York follows the federal deduction for tips only, so it taxes overtime.');
    expect(stateTipsOvertimeNote(STATES_BY_CODE.NY, 8_000)).toBe(
      'Includes your $8,000 state deduction. New York follows the federal deduction for tips only, so it taxes overtime.',
    );
    expect(stateTipsOvertimeNote(STATES_BY_CODE.AL)).toContain('doesn’t say how the cap works on a joint return');
    expect(stateTipsOvertimeNote(STATES_BY_CODE.GA)).toContain('full-time employees paid by the hour');
  });
});

describe('calculators for each state', () => {
  it('links the four calculators, the first two with the state selected', () => {
    for (const s of STATES) {
      const links = stateCalculatorLinks(s);
      expect(links.map((l) => l.title)).toEqual(['Paycheck calculator', 'Tips and overtime calculator', 'Senior deduction calculator', 'Car loan interest calculator']);
      expect(links[0].href).toBe(`/tools/paycheck-calculator/?state=${s.code}#calculator`);
      expect(links[1].href).toBe(`/tools/obbba-tax-calculator/?state=${s.code}#calculator`);
      expect(links[2].body).toMatch(/^A federal deduction of up to \$6,000/);
      expect(links[3].body).toMatch(/^A federal deduction/);
    }
  });

  it('says the tips savings are federal only in states with no tax on wages', () => {
    for (const s of STATES.filter((x) => x.structure === 'none')) {
      expect(stateCalculatorLinks(s)[1].body).toContain('The savings are federal only');
    }
    expect(stateCalculatorLinks(STATES_BY_CODE.CA)[1].body).not.toContain('federal only');
  });

  it('notes that Oregon doesn’t allow the car loan interest deduction, and only Oregon', () => {
    expect(stateCalculatorLinks(STATES_BY_CODE.OR)[3].body).toContain('Oregon doesn’t allow it on the state return');
    expect(STATES.filter((s) => stateCalculatorLinks(s)[3].body.includes('state return')).map((s) => s.code)).toEqual(['OR']);
  });
});
