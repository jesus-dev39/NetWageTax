/**
 * state-bracket-engine.ts
 * Motor de cálculo del impuesto estatal con tramos completos (fase 1 del
 * "Bracket engine" de docs/PENDING-UPDATES.md). Función pura: recibe las reglas
 * de un estado y la renta, y devuelve el impuesto con el detalle de cada paso.
 *
 * Orden de cálculo:
 *   a) Deducción: fija (estándar + exención) o dependiente de la renta (SCIAD).
 *   b) Tramos del estado sobre la base imponible.
 *   c) Recargos especiales (el 1% de California por encima de $1,000,000).
 *   d) Créditos personales fijos, que restan del impuesto.
 *   e) Resta del impuesto federal (Oregon, Alabama, Missouri): preparada pero sin
 *      activar. Es una resta de la renta, no del impuesto, así que cuando se active
 *      reduce la base imponible junto con la deducción del paso a).
 *
 * Solo hay tramos de soltero. Los demás estados civiles usan esos mismos tramos
 * hasta que se añadan los suyos en `bracketsByStatus`.
 */

import type { FilingStatus } from './obbba-params';

/** One bracket of a schedule: `rate` applies to taxable income above `over`. */
export interface TaxBracket {
  over: number;
  rate: number;
}

/** Step a): income the state doesn't tax. */
export type StateDeduction =
  | {
      kind: 'fixed';
      /** Standard deduction + personal exemption of a single filer. */
      amount: number;
      /** Row label on the state page, e.g. "Standard deduction". */
      label: string;
    }
  | {
      /** Shrinks in proportion to income between `phaseoutStart` and `phaseoutEnd` (South Carolina's SCIAD). */
      kind: 'phaseout';
      max: number;
      phaseoutStart: number;
      phaseoutEnd: number;
      /** The reduction is rounded down to a multiple of this amount (0 = no rounding). */
      roundDownTo: number;
      label: string;
    };

/** Step c): an extra rate on taxable income above a threshold. */
export interface Surcharge {
  over: number;
  rate: number;
  label: string;
}

/** Step e): subtraction of federal income tax paid, up to an optional cap. Not active in any state yet. */
export interface FederalTaxSubtraction {
  cap?: number;
}

/** Everything the engine needs about one state. */
export interface BracketEngineRules {
  deduction: StateDeduction;
  /** Single-filer brackets, also used for every status without its own schedule. */
  brackets: TaxBracket[];
  /** Brackets for other filing statuses, when the state's are added (MFJ, HoH, MFS). */
  bracketsByStatus?: Partial<Record<Exclude<FilingStatus, 'single'>, TaxBracket[]>>;
  surcharges?: Surcharge[];
  /** Step d): fixed personal credits subtracted from the tax (USD). */
  personalCredits?: number;
  federalTaxSubtraction?: FederalTaxSubtraction;
}

export interface BracketEngineInput {
  /** State income before the deduction (wages, less any state tips and overtime subtraction). */
  income: number;
  filingStatus?: FilingStatus;
  /** Federal income tax, for states with an active `federalTaxSubtraction`. */
  federalTax?: number;
}

/** One bracket the taxable income reached: `taxed` dollars between `from` and `to` at `rate`. */
export interface BracketLine {
  from: number;
  /** Upper end of the part taxed in this bracket (the taxable income in the last one used). */
  to: number;
  rate: number;
  taxed: number;
  tax: number;
}

export interface SurchargeLine extends Surcharge {
  taxed: number;
  tax: number;
}

export interface BracketEngineResult {
  income: number;
  deduction: number;
  deductionLabel: string;
  federalTaxSubtracted: number;
  taxableIncome: number;
  lines: BracketLine[];
  bracketTax: number;
  surcharges: SurchargeLine[];
  personalCredits: number;
  tax: number;
  /** True when the filing status had no schedule of its own and the single brackets were used. */
  usedSingleBrackets: boolean;
}

export function stateDeductionAmount(d: StateDeduction, income: number): number {
  if (d.kind === 'fixed') return d.amount;
  if (income <= d.phaseoutStart) return d.max;
  if (income >= d.phaseoutEnd) return 0;
  const raw = (d.max * (income - d.phaseoutStart)) / (d.phaseoutEnd - d.phaseoutStart);
  const reduction = d.roundDownTo > 0 ? Math.floor(raw / d.roundDownTo) * d.roundDownTo : raw;
  return Math.max(0, d.max - reduction);
}

export function bracketLines(taxable: number, brackets: TaxBracket[]): BracketLine[] {
  const lines: BracketLine[] = [];
  brackets.forEach((b, i) => {
    if (taxable <= b.over) return;
    const next = brackets[i + 1];
    const to = next ? Math.min(taxable, next.over) : taxable;
    const taxed = to - b.over;
    lines.push({ from: b.over, to, rate: b.rate, taxed, tax: taxed * b.rate });
  });
  return lines;
}

export function computeBracketTax(rules: BracketEngineRules, input: BracketEngineInput): BracketEngineResult {
  const income = Math.max(0, input.income);
  const status = input.filingStatus ?? 'single';
  const own = status === 'single' ? undefined : rules.bracketsByStatus?.[status];
  const brackets = own ?? rules.brackets;

  // a) and e): both reduce the income that the brackets apply to.
  const deduction = Math.min(income, stateDeductionAmount(rules.deduction, income));
  const federalTaxSubtracted = rules.federalTaxSubtraction
    ? Math.min(income - deduction, Math.max(0, input.federalTax ?? 0), rules.federalTaxSubtraction.cap ?? Infinity)
    : 0;
  const taxableIncome = income - deduction - federalTaxSubtracted;

  // b)
  const lines = bracketLines(taxableIncome, brackets);
  const bracketTax = lines.reduce((sum, l) => sum + l.tax, 0);

  // c)
  const surcharges = (rules.surcharges ?? [])
    .filter((s) => taxableIncome > s.over)
    .map((s) => ({ ...s, taxed: taxableIncome - s.over, tax: (taxableIncome - s.over) * s.rate }));
  const beforeCredits = bracketTax + surcharges.reduce((sum, s) => sum + s.tax, 0);

  // d)
  const personalCredits = Math.min(beforeCredits, rules.personalCredits ?? 0);

  return {
    income,
    deduction,
    deductionLabel: rules.deduction.label,
    federalTaxSubtracted,
    taxableIncome,
    lines,
    bracketTax,
    surcharges,
    personalCredits,
    tax: beforeCredits - personalCredits,
    usedSingleBrackets: status !== 'single' && !own,
  };
}
