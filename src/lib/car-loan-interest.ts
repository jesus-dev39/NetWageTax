/**
 * car-loan-interest.ts
 * Motor puro de la deducción por intereses de préstamos de vehículos (IRC §163(h)(4);
 * Schedule 1-A, Parte IV, líneas 28–36).
 *
 * Solo dos requisitos cambian el cálculo, los mismos que el Schedule 1-A pregunta por cada VIN:
 * vehículo nuevo (el uso original empieza con el contribuyente) y ensamblaje final en EE. UU.
 * El resto (fecha y garantía del préstamo, tipo y peso, uso personal, leasing, partes vinculadas,
 * VIN) se confirma en la lista de requisitos de la página.
 */

import {
  CAR_LOAN_PARAMS_BY_YEAR,
  ObbbaInvalidInputError,
  ObbbaYearNotSupportedError,
  SUPPORTED_TAX_YEARS,
  type FilingStatus,
  type TaxYear,
} from './obbba-params';
import { phaseoutExcess, phaseoutReduction, phaseoutSteps } from './phaseout';

export type CarLoanIneligibilityReason = 'USED_VEHICLE' | 'ASSEMBLED_OUTSIDE_US';

export interface CarLoanInterestInput {
  filingStatus: FilingStatus;
  /** Modified adjusted gross income, USD, >= 0. */
  magi: number;
  taxYear: TaxYear;
  /** Intereses pagados en el año sobre los préstamos que cumplen (Form 1098-VLI, casilla 1). */
  interestPaid: number;
  isNewVehicle: boolean;
  isUsAssembled: boolean;
}

export interface CarLoanInterestResult {
  taxYear: TaxYear;
  filingStatus: FilingStatus;
  magi: number;
  interestPaid: number;
  cap: number;
  /** Línea 30: el menor de los intereses y el tope. */
  afterCap: number;
  threshold: number;
  excessMagi: number;
  /** Línea 34: tramos de $1,000, redondeados hacia arriba. */
  phaseoutSteps: number;
  /** Línea 35 sin límite: tramos × $200. */
  phaseoutReduction: number;
  /** Reducción efectivamente aplicada (limitada a afterCap). */
  reductionApplied: number;
  /** Línea 36. */
  deductionFinal: number;
  /** MAGI por encima del cual la deducción máxima ($10,000) llega a $0. */
  fullPhaseoutAboveMagi: number;
  isFullyPhasedOut: boolean;
  /** MAGI a partir del cual (al superarlo) se pierden otros $200; null si la deducción ya es $0. */
  nextStepAboveMagi: number | null;
  isEligible: boolean;
  ineligibilityReason?: CarLoanIneligibilityReason;
}

export function calculateCarLoanInterestDeduction(input: CarLoanInterestInput): CarLoanInterestResult {
  if (!SUPPORTED_TAX_YEARS.includes(input.taxYear)) {
    throw new ObbbaYearNotSupportedError(input.taxYear);
  }
  if (input.magi < 0) {
    throw new ObbbaInvalidInputError('MAGI must be greater than or equal to 0.');
  }
  if (input.interestPaid < 0) {
    throw new ObbbaInvalidInputError('Interest paid must be greater than or equal to 0.');
  }

  const params = CAR_LOAN_PARAMS_BY_YEAR[input.taxYear];
  const rule = params.phaseout;
  const threshold = input.filingStatus === 'mfj' ? params.thresholdMfj : params.thresholdOther;

  const ineligibilityReason: CarLoanIneligibilityReason | undefined = !input.isNewVehicle
    ? 'USED_VEHICLE'
    : !input.isUsAssembled
      ? 'ASSEMBLED_OUTSIDE_US'
      : undefined;
  const isEligible = ineligibilityReason === undefined;

  const afterCap = isEligible ? Math.min(input.interestPaid, params.capPerReturn) : 0;
  const steps = phaseoutSteps(input.magi, threshold, rule);
  const reduction = phaseoutReduction(input.magi, threshold, rule);
  const reductionApplied = Math.min(reduction, afterCap);
  const deductionFinal = afterCap - reductionApplied;

  // With rounding up, the cap is gone once MAGI passes threshold + (cap / perStep − 1) steps.
  const stepSize = rule.kind === 'step' ? rule.stepSize : 0;
  const perStep = rule.kind === 'step' ? rule.perStep : params.capPerReturn;
  const fullPhaseoutAboveMagi = threshold + (Math.ceil(params.capPerReturn / perStep) - 1) * stepSize;

  return {
    taxYear: input.taxYear,
    filingStatus: input.filingStatus,
    magi: input.magi,
    interestPaid: input.interestPaid,
    cap: params.capPerReturn,
    afterCap,
    threshold,
    excessMagi: phaseoutExcess(input.magi, threshold),
    phaseoutSteps: steps,
    phaseoutReduction: reduction,
    reductionApplied,
    deductionFinal,
    fullPhaseoutAboveMagi,
    isFullyPhasedOut: reduction >= params.capPerReturn,
    nextStepAboveMagi: deductionFinal > 0 ? threshold + steps * stepSize : null,
    isEligible,
    ineligibilityReason,
  };
}
