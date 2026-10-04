/**
 * obbba-calculator.ts
 * Motor de cálculo puro de la deducción OBBBA (Tips + Overtime).
 * Implementa la fórmula de 4 pasos de SPEC.md §2.2.
 *
 * IMPORTANTE: esta función es pura — mismo input siempre produce el mismo
 * output, sin acceso a Date.now(), fetch, ni estado global — para que los
 * tests sean 100% deterministas (SPEC.md §5).
 */

import {
  PARAMS_BY_YEAR,
  PHASEOUT_STEP_SIZE_USD,
  PHASEOUT_REDUCTION_PER_STEP_USD,
  TIPS_OVERTIME_PHASEOUT,
  FICA_STILL_OWED_NOTICE,
  W2_CODE_EXPLANATIONS,
  SUPPORTED_TAX_YEARS,
  ObbbaYearNotSupportedError,
  ObbbaInvalidInputError,
  type ObbbaInput,
  type ObbbaResult,
  type CategoryResult,
  type CategoryYearParams,
  type IneligibilityReason,
} from './obbba-params';
import { phaseoutReduction } from './phaseout';

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Paso 3: reducción de phase-out, con redondeo hacia abajo por tramos de $1,000. */
function computePhaseoutReduction(magi: number, threshold: number): number {
  return phaseoutReduction(magi, threshold, TIPS_OVERTIME_PHASEOUT);
}

/** MAGI a partir del cual la deducción de esta categoría llega exactamente a $0. */
function computeZeroPointMagi(cap: number, threshold: number): number {
  return threshold + (cap / PHASEOUT_REDUCTION_PER_STEP_USD) * PHASEOUT_STEP_SIZE_USD;
}

/** USD que faltan hasta que la deducción baje otro tramo de $100 (o null si no aplica). */
function computeDistanceToNextStep(magi: number, threshold: number): number | null {
  const excess = Math.max(0, magi - threshold);
  if (excess === 0 && magi < threshold) {
    // Aún no se ha entrado en phase-out: la "distancia" es hasta tocar el umbral + 1 tramo.
    return threshold + PHASEOUT_STEP_SIZE_USD - magi;
  }
  const currentStepFloor = Math.floor(excess / PHASEOUT_STEP_SIZE_USD) * PHASEOUT_STEP_SIZE_USD;
  const nextStepBoundary = threshold + currentStepFloor + PHASEOUT_STEP_SIZE_USD;
  return nextStepBoundary - magi;
}

/** Resuelve tope y umbral aplicables según el estatus civil (MFJ vs. resto). */
function resolveCategoryParams(
  params: CategoryYearParams,
  filingStatus: ObbbaInput['filingStatus'],
): { cap: number; threshold: number } {
  const isMfj = filingStatus === 'mfj';
  return {
    cap: isMfj ? params.capMfj : params.capSingleOrHoh,
    threshold: isMfj ? params.phaseoutThresholdMfj : params.phaseoutThresholdSingleOrHoh,
  };
}

/** Construye el CategoryResult "cero" para casos de no-elegibilidad. */
function buildIneligibleResult(reason: IneligibilityReason): CategoryResult {
  return {
    deductionBeforePhaseout: 0,
    phaseoutReduction: 0,
    deductionFinal: 0,
    isFullyPhasedOut: false,
    isEligible: false,
    ineligibilityReason: reason,
    distanceToNextPhaseoutStep: null,
  };
}

/** Aplica los 4 pasos de SPEC.md §2.2 para una categoría elegible. */
function calculateEligibleCategory(
  reportedAmount: number,
  cap: number,
  threshold: number,
  magi: number,
): CategoryResult {
  // Paso 1
  const deductionBeforePhaseout = Math.min(Math.max(0, reportedAmount), cap);

  // Paso 2 + 3
  const phaseoutReduction = computePhaseoutReduction(magi, threshold);

  // Paso 4
  const deductionFinal = Math.max(0, deductionBeforePhaseout - phaseoutReduction);

  const zeroPointMagi = computeZeroPointMagi(cap, threshold);
  const isFullyPhasedOut = magi >= zeroPointMagi;

  const distanceToNextPhaseoutStep =
    deductionFinal > 0 || magi < threshold ? computeDistanceToNextStep(magi, threshold) : null;

  return {
    deductionBeforePhaseout,
    phaseoutReduction,
    deductionFinal,
    isFullyPhasedOut,
    isEligible: true,
    ineligibilityReason: undefined,
    distanceToNextPhaseoutStep,
  };
}

// ---------------------------------------------------------------------------
// Función principal
// ---------------------------------------------------------------------------

export function calculateObbbaDeduction(input: ObbbaInput): ObbbaResult {
  // --- Validaciones de entrada -------------------------------------------
  if (!SUPPORTED_TAX_YEARS.includes(input.taxYear)) {
    throw new ObbbaYearNotSupportedError(input.taxYear);
  }
  if (input.magi < 0) {
    throw new ObbbaInvalidInputError('MAGI must be greater than or equal to 0.');
  }

  const yearParams = PARAMS_BY_YEAR[input.taxYear];
  const isMfs = input.filingStatus === 'mfs';

  const { cap: tipsCap, threshold: tipsThreshold } = resolveCategoryParams(
    yearParams.tips,
    input.filingStatus,
  );
  const { cap: overtimeCap, threshold: overtimeThreshold } = resolveCategoryParams(
    yearParams.overtime,
    input.filingStatus,
  );

  // --- Categoría: Tips ------------------------------------------------------
  let tips: CategoryResult;
  if (isMfs) {
    tips = buildIneligibleResult('MARRIED_FILING_SEPARATELY');
  } else if (!input.hasQualifyingTips) {
    tips = buildIneligibleResult('NOT_CLAIMED');
  } else if (input.isSelfEmployedSSTB === true) {
    tips = buildIneligibleResult('SELF_EMPLOYED_SSTB');
  } else {
    tips = calculateEligibleCategory(input.tipsAmount ?? 0, tipsCap, tipsThreshold, input.magi);
  }

  // --- Categoría: Overtime ----------------------------------------------
  let overtime: CategoryResult;
  if (isMfs) {
    overtime = buildIneligibleResult('MARRIED_FILING_SEPARATELY');
  } else if (!input.hasQualifyingOvertime) {
    overtime = buildIneligibleResult('NOT_CLAIMED');
  } else if (input.isFLSANonExempt !== true) {
    overtime = buildIneligibleResult('FLSA_EXEMPT_EMPLOYEE');
  } else {
    overtime = calculateEligibleCategory(
      input.overtimePremiumAmount ?? 0,
      overtimeCap,
      overtimeThreshold,
      input.magi,
    );
  }

  // --- Totales -------------------------------------------------------------
  const totalCombinedDeduction = tips.deductionFinal + overtime.deductionFinal;

  const estimatedFederalTaxSavings =
    typeof input.marginalRateEstimate === 'number'
      ? totalCombinedDeduction * input.marginalRateEstimate
      : null;

  return {
    taxYear: input.taxYear,
    filingStatus: input.filingStatus,
    magi: input.magi,
    tips,
    overtime,
    totalCombinedDeduction,
    estimatedFederalTaxSavings,
    ficaStillOwedNotice: FICA_STILL_OWED_NOTICE,
    w2CodeExplanations: W2_CODE_EXPLANATIONS,
  };
}