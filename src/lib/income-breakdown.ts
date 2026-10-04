/**
 * income-breakdown.ts
 * "Where your income goes" for the tips and overtime calculator: federal income tax after the
 * Schedule 1-A deduction, FICA, state income tax, and take-home, plus the federal tax the
 * deduction saves. Uses the same functions as the savings figure, so the two always agree.
 */

import { estimateEmployeeFica } from './fica';
import { computeFederalIncomeTax, STANDARD_DEDUCTION_2026 } from './marginal-rate';
import type { FilingStatus } from './obbba-params';

export interface IncomeBreakdown {
  /** Income the breakdown divides up (MAGI, treated as wages). */
  total: number;
  federalWithoutDeduction: number;
  federalWithDeduction: number;
  /** federalWithoutDeduction − federalWithDeduction. */
  federalSaved: number;
  fica: number;
  state: number;
  /** total − federal (with the deduction) − FICA − state, never negative. */
  takeHome: number;
}

export function buildIncomeBreakdown(magi: number, deduction: number, filingStatus: FilingStatus, stateTax = 0): IncomeBreakdown {
  const total = Math.max(0, magi);
  const taxableBefore = Math.max(0, total - STANDARD_DEDUCTION_2026[filingStatus]);
  const taxableAfter = Math.max(0, taxableBefore - Math.max(0, deduction));
  const federalWithoutDeduction = computeFederalIncomeTax(taxableBefore, filingStatus);
  const federalWithDeduction = computeFederalIncomeTax(taxableAfter, filingStatus);
  const fica = estimateEmployeeFica(total).total;
  const state = Math.max(0, stateTax);
  return {
    total,
    federalWithoutDeduction,
    federalWithDeduction,
    federalSaved: federalWithoutDeduction - federalWithDeduction,
    fica,
    state,
    takeHome: Math.max(0, total - federalWithDeduction - fica - state),
  };
}
