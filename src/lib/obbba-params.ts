/**
 * obbba-params.ts
 * Tipos y datos estáticos para la deducción OBBBA (No Tax on Tips / No Tax on Overtime).
 * Fuente: SPEC.md §1, §2.1, §3.
 *
 * Estos valores están vigentes para los años fiscales 2025–2028 según la
 * redacción actual del OBBBA (H.R.1, Pub. L. 119-21). Si el IRS publica
 * ajustes por inflación en años futuros, actualizar PARAMS_BY_YEAR — el resto
 * del sistema no requiere cambios porque la lógica de cálculo lee siempre de
 * esta tabla, nunca de números embebidos.
 */

// ---------------------------------------------------------------------------
// Tipos base
// ---------------------------------------------------------------------------

export type FilingStatus = 'single' | 'hoh' | 'mfj' | 'mfs';

export type TaxYear = 2025 | 2026 | 2027 | 2028;

export const SUPPORTED_TAX_YEARS: readonly TaxYear[] = [2025, 2026, 2027, 2028];

/** Motivos formales de no-elegibilidad para una categoría (tips u overtime). */
export type IneligibilityReason =
  | 'NOT_CLAIMED' // el usuario no activó el toggle de esta categoría
  | 'MARRIED_FILING_SEPARATELY' // MFS: la ley exige declaración conjunta
  | 'SELF_EMPLOYED_SSTB' // autónomo en Specified Service Trade or Business (solo tips)
  | 'FLSA_EXEMPT_EMPLOYEE'; // empleado exento bajo FLSA §7 (solo overtime)

// ---------------------------------------------------------------------------
// Inputs (SPEC.md §3.1)
// ---------------------------------------------------------------------------

export interface ObbbaInput {
  filingStatus: FilingStatus;
  /** Modified Adjusted Gross Income, en USD. Debe ser >= 0. */
  magi: number;
  taxYear: TaxYear;

  hasQualifyingTips: boolean;
  /** Corresponde al código TP del W-2, o entrada manual. Requerido si hasQualifyingTips. */
  tipsAmount?: number;
  /** Checkbox informativo; no altera el cálculo pero se conserva en el resultado. */
  tipsOccupationConfirmed?: boolean;
  isSelfEmployedSSTB?: boolean;

  hasQualifyingOvertime: boolean;
  /** Corresponde al código TT del W-2 (solo la PRIMA, no el pago total de OT). */
  overtimePremiumAmount?: number;
  isFLSANonExempt?: boolean;

  /**
   * Opcional: tasa marginal estimada (0–1) para calcular estimatedFederalTaxSavings.
   * Fuera del alcance de este módulo calcularla (ver marginal-rate.ts, SPEC.md §2.2);
   * si no se provee, estimatedFederalTaxSavings será null.
   */
  marginalRateEstimate?: number;
}

// ---------------------------------------------------------------------------
// Outputs (SPEC.md §3.2)
// ---------------------------------------------------------------------------

export interface CategoryResult {
  deductionBeforePhaseout: number;
  phaseoutReduction: number;
  deductionFinal: number;
  isFullyPhasedOut: boolean;
  isEligible: boolean;
  ineligibilityReason?: IneligibilityReason;
  /** USD que faltan hasta el próximo tramo de $1,000 de phase-out. Null si no aplica. */
  distanceToNextPhaseoutStep: number | null;
}

export interface W2CodeExplanation {
  code: 'TA' | 'TP' | 'TT';
  officialName: string;
  description: string;
  taxpayerImplication: string;
}

export interface ObbbaResult {
  taxYear: TaxYear;
  filingStatus: FilingStatus;
  magi: number;
  tips: CategoryResult;
  overtime: CategoryResult;
  totalCombinedDeduction: number;
  estimatedFederalTaxSavings: number | null;
  ficaStillOwedNotice: string;
  w2CodeExplanations: W2CodeExplanation[];
}

// ---------------------------------------------------------------------------
// Constantes de cálculo (SPEC.md §2.2)
// ---------------------------------------------------------------------------

/** Tamaño del tramo de MAGI para aplicar la reducción de phase-out. */
export const PHASEOUT_STEP_SIZE_USD = 1000;

/** Reducción de deducción aplicada por cada tramo completo de PHASEOUT_STEP_SIZE_USD. */
export const PHASEOUT_REDUCTION_PER_STEP_USD = 100;

// ---------------------------------------------------------------------------
// Parámetros por año (SPEC.md §2.1)
// ---------------------------------------------------------------------------

export interface CategoryYearParams {
  capSingleOrHoh: number;
  capMfj: number;
  phaseoutThresholdSingleOrHoh: number;
  phaseoutThresholdMfj: number;
}

export interface ObbbaYearParams {
  tips: CategoryYearParams;
  overtime: CategoryYearParams;
}

/**
 * Valores estatutarios 2025–2028. El tope de tips NO se duplica por estatuto
 * en MFJ ($25,000 en ambos casos); el de overtime sí duplica ($12,500 → $25,000).
 */
const OBBBA_2026_PARAMS: ObbbaYearParams = {
  tips: {
    capSingleOrHoh: 25_000,
    capMfj: 25_000,
    phaseoutThresholdSingleOrHoh: 150_000,
    phaseoutThresholdMfj: 300_000,
  },
  overtime: {
    capSingleOrHoh: 12_500,
    capMfj: 25_000,
    phaseoutThresholdSingleOrHoh: 150_000,
    phaseoutThresholdMfj: 300_000,
  },
};

export const PARAMS_BY_YEAR: Record<TaxYear, ObbbaYearParams> = {
  2025: OBBBA_2026_PARAMS,
  2026: OBBBA_2026_PARAMS,
  2027: OBBBA_2026_PARAMS,
  2028: OBBBA_2026_PARAMS,
};

// ---------------------------------------------------------------------------
// Textos fijos (SPEC.md §1, §3.2)
// ---------------------------------------------------------------------------

export const FICA_STILL_OWED_NOTICE =
  'Esta deducción reduce tu impuesto federal sobre la renta, pero no afecta ' +
  'a los impuestos FICA (Seguro Social y Medicare), que se siguen pagando ' +
  'sobre el 100% de tus propinas y horas extra.';

export const W2_CODE_EXPLANATIONS: W2CodeExplanation[] = [
  {
    code: 'TA',
    officialName: 'Employer contributions to Trump Accounts',
    description:
      'Aportaciones del empleador (hasta $2,500/año) a una cuenta de inversión ' +
      'tipo "Trump Account" a nombre de un hijo del empleado.',
    taxpayerImplication:
      'No afecta al cálculo de esta herramienta. Es puramente informativo: ' +
      'no se relaciona con propinas ni horas extra.',
  },
  {
    code: 'TP',
    officialName:
      'Total amount of tips subject to the "no tax on tips" deduction',
    description:
      'Importe total de propinas cualificadas (voluntarias, en efectivo o ' +
      'tarjeta) que el empleador identificó como elegibles para la ' +
      'deducción del §224.',
    taxpayerImplication:
      'Input principal de la sección "Tips". El monto reportado por el ' +
      'empleador no aplica el tope de $25,000 ni el phase-out por MAGI — ' +
      'eso lo calcula el contribuyente en el Schedule 1-A.',
  },
  {
    code: 'TT',
    officialName: 'Total amount of qualified overtime compensation',
    description:
      'Importe de la PRIMA de horas extra (la mitad extra de "tiempo y ' +
      'medio"), no el pago total de las horas extra, identificado como ' +
      'cualificado bajo FLSA §7.',
    taxpayerImplication:
      'Input principal de la sección "Overtime". Error común: confundirlo ' +
      'con el pago total de horas extra — solo la prima es deducible.',
  },
];

// ---------------------------------------------------------------------------
// Errores tipados
// ---------------------------------------------------------------------------

export class ObbbaYearNotSupportedError extends Error {
  constructor(public readonly taxYear: number) {
    super(
      `Esta deducción no existe para el año seleccionado (${taxYear}). ` +
        `Años soportados: ${SUPPORTED_TAX_YEARS.join(', ')}.`,
    );
    this.name = 'ObbbaYearNotSupportedError';
  }
}

export class ObbbaInvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObbbaInvalidInputError';
  }
}