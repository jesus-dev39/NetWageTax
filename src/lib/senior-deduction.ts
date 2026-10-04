/**
 * senior-deduction.ts
 * Motor puro de la deducción para mayores de 65 (IRC §151(d)(5)(C); Schedule 1-A, Parte V).
 *
 * El formulario calcula la reducción una sola vez (líneas 37–41) y aplica el resultado a cada
 * persona que cumple los requisitos (líneas 42a y 42b): en MFJ la reducción del 6 % se resta de
 * cada $6,000 por separado.
 *
 * El SSN no entra en el cálculo: la lista de requisitos de la página lo pide por separado, igual
 * que la calculadora de propinas.
 */

import {
  ObbbaInvalidInputError,
  ObbbaYearNotSupportedError,
  SENIOR_PARAMS_BY_YEAR,
  SUPPORTED_TAX_YEARS,
  type FilingStatus,
  type TaxYear,
} from './obbba-params';
import { phaseoutExcess, phaseoutReduction } from './phaseout';

export type SeniorIneligibilityReason = 'MARRIED_FILING_SEPARATELY' | 'NO_QUALIFYING_PERSON';

export interface SeniorDeductionInput {
  filingStatus: FilingStatus;
  /** Modified adjusted gross income, USD, >= 0. */
  magi: number;
  taxYear: TaxYear;
  /** El contribuyente cumple 65 antes de que acabe el año (nacido antes del corte). */
  taxpayerIs65: boolean;
  /** Solo cuenta en MFJ. */
  spouseIs65?: boolean;
}

export interface SeniorDeductionResult {
  taxYear: TaxYear;
  filingStatus: FilingStatus;
  magi: number;
  /** Personas que cumplen los requisitos en la declaración (0, 1 o 2). */
  qualifyingPeople: number;
  amountPerPerson: number;
  /** amountPerPerson × qualifyingPeople. */
  maxDeduction: number;
  threshold: number;
  /** MAGI por encima del umbral. */
  excessMagi: number;
  /** Reducción aplicada a cada persona, limitada a amountPerPerson. */
  reductionPerPerson: number;
  /** Reducción total aplicada (reductionPerPerson × qualifyingPeople). */
  reductionTotal: number;
  deductionPerPerson: number;
  deductionFinal: number;
  /** MAGI con el que la deducción llega a $0. */
  fullPhaseoutMagi: number;
  isFullyPhasedOut: boolean;
  isEligible: boolean;
  ineligibilityReason?: SeniorIneligibilityReason;
}

export function calculateSeniorDeduction(input: SeniorDeductionInput): SeniorDeductionResult {
  if (!SUPPORTED_TAX_YEARS.includes(input.taxYear)) {
    throw new ObbbaYearNotSupportedError(input.taxYear);
  }
  if (input.magi < 0) {
    throw new ObbbaInvalidInputError('MAGI must be greater than or equal to 0.');
  }

  const params = SENIOR_PARAMS_BY_YEAR[input.taxYear];
  const isMfj = input.filingStatus === 'mfj';
  const threshold = isMfj ? params.thresholdMfj : params.thresholdSingleOrHoh;
  const fullPhaseoutMagi =
    params.phaseout.kind === 'rate' ? threshold + params.amountPerPerson / params.phaseout.rate : threshold;

  let ineligibilityReason: SeniorIneligibilityReason | undefined;
  let qualifyingPeople = 0;
  if (input.filingStatus === 'mfs') {
    ineligibilityReason = 'MARRIED_FILING_SEPARATELY';
  } else {
    qualifyingPeople = (input.taxpayerIs65 ? 1 : 0) + (isMfj && input.spouseIs65 ? 1 : 0);
    if (qualifyingPeople === 0) ineligibilityReason = 'NO_QUALIFYING_PERSON';
  }

  const excessMagi = phaseoutExcess(input.magi, threshold);
  const rawReduction = phaseoutReduction(input.magi, threshold, params.phaseout);
  const reductionPerPerson = qualifyingPeople > 0 ? Math.min(rawReduction, params.amountPerPerson) : 0;
  const deductionPerPerson = qualifyingPeople > 0 ? params.amountPerPerson - reductionPerPerson : 0;

  return {
    taxYear: input.taxYear,
    filingStatus: input.filingStatus,
    magi: input.magi,
    qualifyingPeople,
    amountPerPerson: params.amountPerPerson,
    maxDeduction: params.amountPerPerson * qualifyingPeople,
    threshold,
    excessMagi,
    reductionPerPerson,
    reductionTotal: reductionPerPerson * qualifyingPeople,
    deductionPerPerson,
    deductionFinal: deductionPerPerson * qualifyingPeople,
    fullPhaseoutMagi,
    isFullyPhasedOut: input.magi >= fullPhaseoutMagi,
    isEligible: qualifyingPeople > 0,
    ineligibilityReason,
  };
}
