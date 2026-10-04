import { describe, it, expect } from 'vitest';
import { parsePaycheckSearchParams, toPaycheckSearchParams } from './paycheck-url';

describe('toPaycheckSearchParams', () => {
  it('writes only the salary fields in salary mode', () => {
    const p = toPaycheckSearchParams({
      mode: 'salary',
      annualSalary: 65_000,
      hourlyRate: 25,
      hoursPerWeek: 40,
      frequency: 'biweekly',
      filingStatus: 'single',
      stateCode: 'CA',
    });
    expect(p.toString()).toBe('mode=salary&salary=65000&freq=biweekly&filing=single&state=CA');
  });

  it('writes rate and hours in hourly mode and skips an empty state', () => {
    const p = toPaycheckSearchParams({
      mode: 'hourly',
      annualSalary: 0,
      hourlyRate: 22.5,
      hoursPerWeek: 38,
      frequency: 'weekly',
      filingStatus: 'hoh',
      stateCode: null,
    });
    expect(p.toString()).toBe('mode=hourly&rate=22.5&hours=38&freq=weekly&filing=hoh');
  });
});

describe('parsePaycheckSearchParams', () => {
  it('round-trips what toPaycheckSearchParams writes', () => {
    const input = {
      mode: 'salary' as const,
      annualSalary: 65_000,
      hourlyRate: 0,
      hoursPerWeek: 40,
      frequency: 'semimonthly' as const,
      filingStatus: 'mfj' as const,
      stateCode: 'NY' as const,
    };
    expect(parsePaycheckSearchParams(toPaycheckSearchParams(input))).toEqual({
      mode: 'salary',
      annualSalary: 65_000,
      frequency: 'semimonthly',
      filingStatus: 'mfj',
      stateCode: 'NY',
    });
  });

  it('accepts a state slug, like the state pages link with', () => {
    expect(parsePaycheckSearchParams('?state=california')).toEqual({ stateCode: 'CA' });
  });

  it('drops invalid values and caps hours at 168 a week', () => {
    expect(
      parsePaycheckSearchParams('mode=weekly&salary=-5&rate=abc&hours=200&ot=&freq=daily&filing=mfs&state=XX'),
    ).toEqual({ hoursPerWeek: 168 });
  });
});
