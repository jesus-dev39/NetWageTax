/**
 * paycheck-url.ts
 * Paycheck inputs in the query string, so the home page estimate can open the full
 * calculator with the same values: /tools/paycheck-calculator/?mode=salary&salary=65000&freq=biweekly…
 *
 * Keys: mode, salary, rate, hours, ot, freq, filing, state. Anything missing or invalid is
 * left out of the parsed result, so the calculator keeps its own default for it.
 */

import { PAY_FREQUENCIES, PAYCHECK_FILING_STATUSES, type PaycheckInput } from './paycheck';
import { findState } from './state-tax-data';

export type PaycheckUrlInput = Omit<PaycheckInput, 'overtimeHoursPerWeek'> & { overtimeHoursPerWeek?: number };

const MAX_HOURS_PER_WEEK = 168;

/** Only the fields that matter for the chosen mode, with no zero or default noise. */
export function toPaycheckSearchParams(input: PaycheckUrlInput): URLSearchParams {
  const p = new URLSearchParams();
  p.set('mode', input.mode);
  if (input.mode === 'salary') {
    if (input.annualSalary > 0) p.set('salary', String(input.annualSalary));
  } else {
    if (input.hourlyRate > 0) p.set('rate', String(input.hourlyRate));
    p.set('hours', String(input.hoursPerWeek));
    if (input.overtimeHoursPerWeek) p.set('ot', String(input.overtimeHoursPerWeek));
  }
  p.set('freq', input.frequency);
  p.set('filing', input.filingStatus);
  if (input.stateCode) p.set('state', input.stateCode);
  return p;
}

const amount = (raw: string | null, max = Infinity): number | undefined => {
  if (raw === null || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : undefined;
};

export function parsePaycheckSearchParams(search: string | URLSearchParams): Partial<PaycheckInput> {
  const p = typeof search === 'string' ? new URLSearchParams(search) : search;
  const out: Partial<PaycheckInput> = {};

  const mode = p.get('mode');
  if (mode === 'salary' || mode === 'hourly') out.mode = mode;

  const salary = amount(p.get('salary'));
  if (salary !== undefined) out.annualSalary = salary;
  const rate = amount(p.get('rate'));
  if (rate !== undefined) out.hourlyRate = rate;
  const hours = amount(p.get('hours'), MAX_HOURS_PER_WEEK);
  if (hours !== undefined) out.hoursPerWeek = hours;
  const ot = amount(p.get('ot'), MAX_HOURS_PER_WEEK);
  if (ot !== undefined) out.overtimeHoursPerWeek = ot;

  const freq = PAY_FREQUENCIES.find((f) => f.value === p.get('freq'));
  if (freq) out.frequency = freq.value;
  const filing = PAYCHECK_FILING_STATUSES.find((f) => f.value === p.get('filing'));
  if (filing) out.filingStatus = filing.value;

  // Accepts a code or a slug (?state=CA, ?state=california), like the state pages' deep links.
  const state = findState(p.get('state'));
  if (state) out.stateCode = state.code;

  return out;
}
