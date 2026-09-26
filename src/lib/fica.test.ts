import { describe, it, expect } from 'vitest';
import { estimateEmployeeFica, SOCIAL_SECURITY_WAGE_BASE_2026 } from './fica';

describe('estimateEmployeeFica', () => {
  it('applies the 7.65% baseline below the Social Security wage base', () => {
    const r = estimateEmployeeFica(50_000);
    expect(r.socialSecurity).toBeCloseTo(3_100);
    expect(r.medicare).toBeCloseTo(725);
    expect(r.total).toBeCloseTo(3_825);
  });

  it('caps Social Security at the 2026 wage base but not Medicare', () => {
    const r = estimateEmployeeFica(250_000);
    expect(r.socialSecurity).toBeCloseTo(SOCIAL_SECURITY_WAGE_BASE_2026 * 0.062);
    expect(r.medicare).toBeCloseTo(3_625);
  });

  it('returns zero for zero or negative wages', () => {
    expect(estimateEmployeeFica(0).total).toBe(0);
    expect(estimateEmployeeFica(-100).total).toBe(0);
  });
});
