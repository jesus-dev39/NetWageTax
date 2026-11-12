/**
 * marginal-rate.ts
 * Tabla simplificada de tramos federales 2026 para estimar el ahorro fiscal
 * de la deducción OBBBA (SPEC.md §2.2 — TAX_BRACKETS_2026).
 *
 * Fuente: IRS Rev. Proc. 2025-32 (ajustes por inflación 2026).
 * Las constantes *_2027 (Rev. Proc. 2026-35) ya están añadidas, pero todavía no
 * se usan: el cálculo sigue en 2026 hasta el cambio de año de enero.
 * Simplificación v1: se asume deducción estándar y MAGI ≈ AGI. La deducción
 * OBBBA reduce la base imponible (Schedule 1-A → Form 1040), no el AGI.
 */

import type { FilingStatus } from './obbba-params';

export interface Bracket {
  /** Límite superior del tramo (renta imponible), Infinity para el último. */
  upTo: number;
  rate: number;
}

const rates = [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];

function buildBrackets(limits: number[]): Bracket[] {
  return rates.map((rate, i) => ({ upTo: limits[i] ?? Infinity, rate }));
}

export const TAX_BRACKETS_2026: Record<FilingStatus, Bracket[]> = {
  single: buildBrackets([12_400, 50_400, 105_700, 201_775, 256_225, 640_600]),
  hoh: buildBrackets([17_700, 67_450, 105_700, 201_750, 256_200, 640_600]),
  mfj: buildBrackets([24_800, 100_800, 211_400, 403_550, 512_450, 768_700]),
  mfs: buildBrackets([12_400, 50_400, 105_700, 201_775, 256_225, 384_350]),
};

export const STANDARD_DEDUCTION_2026: Record<FilingStatus, number> = {
  single: 16_100,
  hoh: 24_150,
  mfj: 32_200,
  mfs: 16_100,
};

/**
 * Tramos federales 2027: IRS Rev. Proc. 2026-35, §3.01, Tables 1-4 (publicada
 * el 5 de noviembre de 2026: https://www.irs.gov/pub/irs-drop/rp-26-35.pdf).
 * Not used yet: switch in January (SITE_TAX_YEAR → 2027, MAINTENANCE.md §3.1).
 */
export const TAX_BRACKETS_2027: Record<FilingStatus, Bracket[]> = {
  single: buildBrackets([12_800, 52_025, 109_125, 208_325, 264_550, 661_375]),
  hoh: buildBrackets([18_250, 69_650, 109_100, 208_300, 264_550, 661_350]),
  mfj: buildBrackets([25_600, 104_050, 218_250, 416_650, 529_100, 793_650]),
  mfs: buildBrackets([12_800, 52_025, 109_125, 208_325, 264_550, 396_825]),
};

/**
 * Deducción estándar 2027: IRS Rev. Proc. 2026-35, §3.15(1) (publicada el 5 de
 * noviembre de 2026: https://www.irs.gov/pub/irs-drop/rp-26-35.pdf).
 * Not used yet: switch in January (SITE_TAX_YEAR → 2027, MAINTENANCE.md §3.1).
 */
export const STANDARD_DEDUCTION_2027: Record<FilingStatus, number> = {
  single: 16_600,
  hoh: 24_925,
  mfj: 33_200,
  mfs: 16_600,
};

/** Impuesto sobre una renta imponible con una tabla de tramos cualquiera (2026, 2027…). */
export function taxFromBrackets(taxableIncome: number, brackets: readonly Bracket[]): number {
  let tax = 0;
  let lower = 0;
  for (const { upTo, rate } of brackets) {
    if (taxableIncome <= lower) break;
    tax += (Math.min(taxableIncome, upTo) - lower) * rate;
    lower = upTo;
  }
  return tax;
}

/** Impuesto federal sobre la renta (ordinaria) para una renta imponible dada. */
export function computeFederalIncomeTax(taxableIncome: number, filingStatus: FilingStatus): number {
  return taxFromBrackets(taxableIncome, TAX_BRACKETS_2026[filingStatus]);
}

/** Tipo marginal aplicable a una renta imponible dada. */
export function getMarginalRate(taxableIncome: number, filingStatus: FilingStatus): number {
  const brackets = TAX_BRACKETS_2026[filingStatus];
  return (brackets.find((b) => taxableIncome <= b.upTo) ?? brackets[brackets.length - 1]).rate;
}

/**
 * Deducción estándar adicional por edad (65+) en 2026, IRC §63(f), Rev. Proc. 2025-32 §3.14(3):
 * $2,050 para quien no está casado (ni es surviving spouse) y $1,650 por cónyuge casado.
 */
export const ADDITIONAL_STANDARD_DEDUCTION_AGED_2026 = { unmarried: 2_050, married: 1_650 } as const;

/**
 * Deducción estándar adicional por edad (65+) en 2027, IRC §63(f), IRS Rev. Proc.
 * 2026-35 §3.15(3) (publicada el 5 de noviembre de 2026:
 * https://www.irs.gov/pub/irs-drop/rp-26-35.pdf): $2,100 para quien no está casado
 * (ni es surviving spouse) y $1,700 por cónyuge casado.
 * Not used yet: switch in January (SITE_TAX_YEAR → 2027, MAINTENANCE.md §3.1).
 */
export const ADDITIONAL_STANDARD_DEDUCTION_AGED_2027 = { unmarried: 2_100, married: 1_700 } as const;

/** Deducción estándar adicional por edad para `people65` personas de 65+ en la declaración. */
export function agedAdditionalStandardDeduction(filingStatus: FilingStatus, people65: number): number {
  const married = filingStatus === 'mfj' || filingStatus === 'mfs';
  const perPerson = married ? ADDITIONAL_STANDARD_DEDUCTION_AGED_2026.married : ADDITIONAL_STANDARD_DEDUCTION_AGED_2026.unmarried;
  return perPerson * Math.max(0, people65);
}

export interface FederalTaxComparison {
  /** Impuesto federal sin la deducción del Schedule 1-A. */
  before: number;
  /** Impuesto federal con la deducción. */
  after: number;
  /** before − after. */
  saved: number;
}

/**
 * Impuesto federal con y sin la deducción, asumiendo deducción estándar (más
 * `extraStandardDeduction`, p. ej. la adicional por edad).
 */
export function compareFederalTax(
  magi: number,
  deduction: number,
  filingStatus: FilingStatus,
  extraStandardDeduction = 0,
): FederalTaxComparison {
  const taxableBefore = Math.max(0, magi - STANDARD_DEDUCTION_2026[filingStatus] - extraStandardDeduction);
  const taxableAfter = Math.max(0, taxableBefore - deduction);
  const before = computeFederalIncomeTax(taxableBefore, filingStatus);
  const after = computeFederalIncomeTax(taxableAfter, filingStatus);
  return { before, after, saved: before - after };
}

/**
 * Ahorro estimado = impuesto sin la deducción − impuesto con la deducción,
 * asumiendo deducción estándar. Más preciso que deducción × tipo marginal
 * cuando la deducción cruza un límite de tramo.
 */
export function estimateFederalTaxSavings(
  magi: number,
  deduction: number,
  filingStatus: FilingStatus,
  extraStandardDeduction = 0,
): number {
  return compareFederalTax(magi, deduction, filingStatus, extraStandardDeduction).saved;
}

/**
 * True cuando la deducción estándar ya cubre toda la renta: no hay impuesto
 * federal que reducir, así que el ahorro OBBBA es $0 aunque haya deducción.
 */
export function isCoveredByStandardDeduction(magi: number, filingStatus: FilingStatus, extraStandardDeduction = 0): boolean {
  return magi > 0 && magi <= STANDARD_DEDUCTION_2026[filingStatus] + extraStandardDeduction;
}
