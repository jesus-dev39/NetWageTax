/**
 * phaseout.ts
 * Reducción por ingresos (MAGI) de las deducciones del Schedule 1-A. Cada deducción
 * usa una de estas reglas:
 *
 * - Propinas y horas extra (IRC §224, §225): $100 por cada $1,000 completo por encima
 *   del umbral → step, rounding 'down'.
 * - Intereses del coche (IRC §163(h)(4)(C)(ii)): $200 por cada $1,000 "o fracción"
 *   → step, rounding 'up' (Schedule 1-A: "increase 0.05 to 1").
 * - Mayores de 65 (IRC §151(d)(5)(C)(iii)): 6 % del exceso, sin tramos → rate.
 *
 * Funciones puras: sin estado ni fechas, para que los tests sean deterministas.
 */

export type PhaseoutRule =
  | { kind: 'step'; stepSize: number; perStep: number; rounding: 'down' | 'up' }
  | { kind: 'rate'; rate: number };

/** MAGI por encima del umbral (0 si no lo supera). */
export function phaseoutExcess(magi: number, threshold: number): number {
  return Math.max(0, magi - threshold);
}

/** Número de tramos de stepSize que cuenta la regla (0 para reglas 'rate'). */
export function phaseoutSteps(magi: number, threshold: number, rule: PhaseoutRule): number {
  if (rule.kind !== 'step') return 0;
  const ratio = phaseoutExcess(magi, threshold) / rule.stepSize;
  return rule.rounding === 'down' ? Math.floor(ratio) : Math.ceil(ratio);
}

/** Importe que se resta de la deducción (sin límite superior: el llamador aplica el mínimo 0). */
export function phaseoutReduction(magi: number, threshold: number, rule: PhaseoutRule): number {
  if (rule.kind === 'rate') return phaseoutExcess(magi, threshold) * rule.rate;
  return phaseoutSteps(magi, threshold, rule) * rule.perStep;
}

/** Deducción tras la reducción, nunca negativa. */
export function applyPhaseout(amount: number, magi: number, threshold: number, rule: PhaseoutRule): number {
  return Math.max(0, amount - phaseoutReduction(magi, threshold, rule));
}
