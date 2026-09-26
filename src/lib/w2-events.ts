/**
 * w2-events.ts
 * Canal de comunicación entre islas React (W2Decoder → TaxCalculatorApp).
 * Las islas de Astro se hidratan por separado y no comparten estado de React,
 * así que el decodificador emite un CustomEvent en window que la calculadora escucha.
 */

export const W2_PREFILL_EVENT = 'netwagetax:w2-prefill';

export interface W2PrefillDetail {
  code: 'TP' | 'TT';
  /** Importe de la Casilla 12 introducido en el decodificador, si lo hay. */
  amount?: number;
}

export function dispatchW2Prefill(detail: W2PrefillDetail): void {
  window.dispatchEvent(new CustomEvent<W2PrefillDetail>(W2_PREFILL_EVENT, { detail }));
}
