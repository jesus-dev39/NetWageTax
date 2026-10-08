import { describe, it, expect } from 'vitest';
import { STATES, STATES_BY_CODE } from './state-tax-data';
import {
  TIPS_OVERTIME_LAST_CHECKED,
  TIPS_OVERTIME_RULES,
  TREATMENT_LABEL,
  TREATMENT_ORDER,
  type TipsOvertimeTreatment,
} from './state-tips-overtime';

const codesWith = (t: TipsOvertimeTreatment) =>
  STATES.filter((s) => s.tipsOvertime.treatment === t)
    .map((s) => s.code)
    .sort();

describe('state tips and overtime rules', () => {
  it('covers all 50 states and DC', () => {
    expect(Object.keys(TIPS_OVERTIME_RULES)).toHaveLength(51);
    for (const s of STATES) expect(s.tipsOvertime).toBe(TIPS_OVERTIME_RULES[s.code]);
  });

  it('marks exactly the states with no tax on wages as no-wage-tax', () => {
    for (const s of STATES) expect(s.tipsOvertime.treatment === 'no-wage-tax').toBe(s.structure === 'none');
  });

  it('cites at least one official https source for every confirmed treatment', () => {
    for (const s of STATES) {
      const { treatment, sources } = s.tipsOvertime;
      if (treatment !== 'unconfirmed') expect(sources.length, s.code).toBeGreaterThan(0);
      for (const src of sources) {
        expect(src.url, s.code).toMatch(/^https:\/\//);
        expect(src.label.trim(), s.code).not.toBe('');
      }
    }
  });

  it('only infers "does not follow", and gives every rule a detail and a check date', () => {
    for (const s of STATES) {
      const r = s.tipsOvertime;
      if (r.inferred) expect(r.treatment, s.code).toBe('does-not-follow');
      expect(r.detail.trim(), s.code).not.toBe('');
      expect(r.checked, s.code).toMatch(/^2026-\d{2}-\d{2}$/);
    }
    expect(TIPS_OVERTIME_LAST_CHECKED).toBe('2026-10-08');
  });

  it('matches the classification approved in October 2026', () => {
    expect(codesWith('no-wage-tax')).toEqual(['AK', 'FL', 'NH', 'NV', 'SD', 'TN', 'TX', 'WA', 'WY']);
    expect(codesWith('follows')).toEqual(['AZ', 'IA', 'ID', 'IN', 'MI', 'MT', 'ND', 'OR']);
    expect(codesWith('tips-only')).toEqual(['CO', 'HI', 'NY']);
    expect(codesWith('own')).toEqual(['AL', 'GA']);
    expect(codesWith('unconfirmed')).toEqual(['DC']);
    expect(codesWith('does-not-follow')).toHaveLength(28);
    const inferred = STATES.filter((s) => s.tipsOvertime.inferred).map((s) => s.code).sort();
    expect(inferred).toEqual(['AR', 'CT', 'IL', 'KS', 'LA', 'OH', 'OK', 'UT', 'WI', 'WV']);
  });

  it('labels every treatment, in a fixed order', () => {
    expect(TREATMENT_ORDER).toHaveLength(6);
    for (const t of TREATMENT_ORDER) expect(TREATMENT_LABEL[t]).toBeTruthy();
  });

  it('keeps the own-break caps verified against HB 463 and Act 2026-604', () => {
    expect(STATES_BY_CODE.GA.tipsOvertime.own).toEqual({ tipsCap: 1_750, overtimeCap: 1_750 });
    expect(STATES_BY_CODE.GA.tipsOvertime.detail).toContain('full-time hourly employees');
    expect(STATES_BY_CODE.AL.tipsOvertime.own).toEqual({ overtimeCap: 1_000 });
    expect(STATES_BY_CODE.AL.tipsOvertime.detail).toContain('Tips stay taxable');
    for (const s of STATES) if (s.tipsOvertime.treatment !== 'own') expect(s.tipsOvertime.own, s.code).toBeUndefined();
  });

  it('cites Rhode Island’s official analysis and explains DC', () => {
    expect(STATES_BY_CODE.RI.tipsOvertime.inferred).toBeUndefined();
    expect(STATES_BY_CODE.RI.tipsOvertime.sources[0].url).toMatch(/^https:\/\/tax\.ri\.gov\//);
    expect(STATES_BY_CODE.DC.tipsOvertime.detail).toBe(
      'Congress overturned D.C.’s 2026 law that disallowed these deductions. We’re waiting for D.C.’s 2026 guidance.',
    );
  });
});
