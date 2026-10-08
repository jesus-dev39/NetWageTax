/**
 * state-tips-overtime-subtraction.ts
 * How much of your tips and overtime the selected state lets you subtract, for the state tax
 * estimate in the tips and overtime calculator. Rules come from state-tips-overtime.ts:
 *
 * - follows:          the final federal deductions (after the caps and the income phase-out).
 * - tips-only:        the final federal tips deduction only.
 * - own:              the state's own caps on the qualified amounts you entered (Georgia: $1,750 of
 *                     tips and $1,750 of overtime; Alabama: $1,000 of overtime premium per taxpayer
 *                     with overtime). No federal phase-out or filing-status rule applies.
 * - does-not-follow, no-wage-tax, unconfirmed: nothing.
 */
import type { FilingStatus } from './obbba-params';
import type { StateCode } from './state-tax-data';
import { TIPS_OVERTIME_RULES } from './state-tips-overtime';

export interface StateSubtractionInput {
  /** Final federal tips deduction (after the cap and the phase-out). */
  tipsDeduction: number;
  /** Final federal overtime deduction (after the cap and the phase-out). */
  overtimeDeduction: number;
  /** Qualified tips entered (occupation confirmed), before any cap. */
  tipsReported: number;
  /** Qualified overtime premium entered (FLSA non-exempt confirmed), before any cap. */
  overtimePremiumReported: number;
  filingStatus: FilingStatus;
  /** Joint returns in a per-taxpayer state (Alabama): both spouses earned qualified overtime. */
  bothSpousesHaveOvertime?: boolean;
}

export interface StateSubtraction {
  tips: number;
  overtime: number;
  total: number;
}

const clamp = (amount: number, cap = Infinity) => Math.max(0, Math.min(amount, cap));

export function stateTipsOvertimeSubtraction(code: StateCode, input: StateSubtractionInput): StateSubtraction {
  const rule = TIPS_OVERTIME_RULES[code];
  let tips = 0;
  let overtime = 0;
  switch (rule.treatment) {
    case 'follows':
      tips = clamp(input.tipsDeduction);
      overtime = clamp(input.overtimeDeduction);
      break;
    case 'tips-only':
      tips = clamp(input.tipsDeduction);
      break;
    case 'own': {
      const { tipsCap, overtimeCap, perTaxpayer } = rule.own ?? {};
      const earners = perTaxpayer && input.filingStatus === 'mfj' && input.bothSpousesHaveOvertime ? 2 : 1;
      if (tipsCap !== undefined) tips = clamp(input.tipsReported, tipsCap);
      if (overtimeCap !== undefined) overtime = clamp(input.overtimePremiumReported, overtimeCap * earners);
      break;
    }
  }
  return { tips, overtime, total: tips + overtime };
}
