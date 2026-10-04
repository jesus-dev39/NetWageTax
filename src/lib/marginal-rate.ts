/**
 * marginal-rate.ts
 * Tabla simplificada de tramos federales 2026 para estimar el ahorro fiscal
 * de la deducción OBBBA (SPEC.md §2.2 — TAX_BRACKETS_2026).
 *
 * Fuente: IRS Rev. Proc. 2025-32 (ajustes por inflación 2026).
 * Simplificación v1: se asume deducción estándar y MAGI ≈ AGI. La deducción
 * OBBBA reduce la base imponible (Schedule 1-A → Form 1040), no el AGI.
 */

import type { FilingStatus } from './obbba-params';

interface Bracket {
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

/** Impuesto federal sobre la renta (ordinaria) para una renta imponible dada. */
export function computeFederalIncomeTax(taxableIncome: number, filingStatus: FilingStatus): number {
  let tax = 0;
  let lower = 0;
  for (const { upTo, rate } of TAX_BRACKETS_2026[filingStatus]) {
    if (taxableIncome <= lower) break;
    tax += (Math.min(taxableIncome, upTo) - lower) * rate;
    lower = upTo;
  }
  return tax;
}

/** Tipo marginal aplicable a una renta imponible dada. */
export function getMarginalRate(taxableIncome: number, filingStatus: FilingStatus): number {
  const brackets = TAX_BRACKETS_2026[filingStatus];
  return (brackets.find((b) => taxableIncome <= b.upTo) ?? brackets[brackets.length - 1]).rate;
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
): number {
  const taxableBefore = Math.max(0, magi - STANDARD_DEDUCTION_2026[filingStatus]);
  const taxableAfter = Math.max(0, taxableBefore - deduction);
  return (
    computeFederalIncomeTax(taxableBefore, filingStatus) -
    computeFederalIncomeTax(taxableAfter, filingStatus)
  );
}

/**
 * True cuando la deducción estándar ya cubre toda la renta: no hay impuesto
 * federal que reducir, así que el ahorro OBBBA es $0 aunque haya deducción.
 */
export function isCoveredByStandardDeduction(magi: number, filingStatus: FilingStatus): boolean {
  return magi > 0 && magi <= STANDARD_DEDUCTION_2026[filingStatus];
}
