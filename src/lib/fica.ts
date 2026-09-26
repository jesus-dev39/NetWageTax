/**
 * fica.ts
 * Estimación del FICA del empleado (Social Security + Medicare) para el
 * gráfico de desglose de ingresos. Las deducciones OBBBA NO reducen el FICA:
 * sigue aplicándose al 100% de propinas y horas extra.
 *
 * Simplificación v1: se asume que toda la MAGI son salarios (W-2) y se omite
 * el Additional Medicare Tax del 0,9% (umbral de $200,000 / $250,000 MFJ).
 */

/** Tipo del empleado para Social Security (OASDI). */
export const SOCIAL_SECURITY_RATE = 0.062;

/** Tipo del empleado para Medicare (HI), sin tope salarial. */
export const MEDICARE_RATE = 0.0145;

/** Tipo combinado de referencia (7.65%). */
export const FICA_BASELINE_RATE = SOCIAL_SECURITY_RATE + MEDICARE_RATE;

/** Base salarial máxima de Social Security para 2026 (SSA, octubre 2025). */
export const SOCIAL_SECURITY_WAGE_BASE_2026 = 184_500;

export interface FicaEstimate {
  socialSecurity: number;
  medicare: number;
  total: number;
}

export function estimateEmployeeFica(wages: number): FicaEstimate {
  const w = Math.max(0, wages);
  const socialSecurity = Math.min(w, SOCIAL_SECURITY_WAGE_BASE_2026) * SOCIAL_SECURITY_RATE;
  const medicare = w * MEDICARE_RATE;
  return { socialSecurity, medicare, total: socialSecurity + medicare };
}
