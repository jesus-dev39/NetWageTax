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
 *   d) Créditos personales, que restan del impuesto (con una reducción opcional
 *      según la renta, como el de California).
 *   e) Resta del impuesto federal (Oregon; preparada para Alabama y Missouri). Es una
 *      resta de la renta, no del impuesto: reduce la base imponible junto con la
 *      deducción del paso a). Su tope puede depender del AGI federal (Oregon).
 *
 * Las reducciones que dependen de la renta (SCIAD, exención de Maryland, créditos,
 * tope de la resta federal) usan el AGI federal (`agi`), que por defecto es `income`.
 *
 * Estados civiles: un estado civil con tramos en `bracketsByStatus` usa esos
 * tramos y, si existen, su deducción (`deductionByStatus`), su crédito
 * personal (`personalCreditsByStatus`) y su resta federal
 * (`federalTaxSubtractionByStatus`). Los que no tienen tramos propios
 * (hoy, married filing separately) usan todas las reglas de soltero. Los
 * recargos son los mismos para todos.
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
    }
  | {
      /** Depends on the federal AGI band (Maryland's personal exemption): the first tier with agi ≤ `upTo`. */
      kind: 'tiers';
      tiers: { upTo: number; amount: number }[];
      label: string;
    };

/** Step c): an extra rate on taxable income above a threshold. */
export interface Surcharge {
  over: number;
  rate: number;
  label: string;
}

/** Step d): a personal credit subtracted from the tax, optionally reduced as income rises. */
export interface PersonalCredit {
  amount: number;
  /** Row label on the state page, e.g. "Personal exemption credit". */
  label: string;
  /** `reductionPerStep` less for each `stepSize`, or part of one, of income above `start`; never below 0. */
  phaseout?: { start: number; stepSize: number; reductionPerStep: number };
  /** No credit at all once federal AGI is over this amount (Oregon's exemption credit). */
  incomeLimit?: number;
}

/** Step e): subtraction of federal income tax paid, up to an optional cap. */
export interface FederalTaxSubtraction {
  cap?: number;
  /** Cap by federal AGI band (Oregon): the first tier with agi < `below` sets the cap instead of `cap`. */
  capByAgi?: { below: number; cap: number }[];
}

/** Filing statuses that can have rules of their own; single is the default. */
export type OtherFilingStatus = Exclude<FilingStatus, 'single'>;

/** Everything the engine needs about one state. */
export interface BracketEngineRules {
  /** Single-filer deduction, also used by every status without its own brackets. */
  deduction: StateDeduction;
  /** Single-filer brackets, also used for every status without its own schedule. */
  brackets: TaxBracket[];
  /** Brackets for other filing statuses (MFJ, HoH, MFS). A status listed here has its own rules. */
  bracketsByStatus?: Partial<Record<OtherFilingStatus, TaxBracket[]>>;
  /** Deduction of a status in `bracketsByStatus`, when it differs from the single one. */
  deductionByStatus?: Partial<Record<OtherFilingStatus, StateDeduction>>;
  surcharges?: Surcharge[];
  /** Single-filer personal credit, also used by every status without its own brackets. */
  personalCredits?: PersonalCredit;
  /** Personal credit of a status in `bracketsByStatus`, when it differs from the single one. */
  personalCreditsByStatus?: Partial<Record<OtherFilingStatus, PersonalCredit>>;
  federalTaxSubtraction?: FederalTaxSubtraction;
  /** Federal tax subtraction of a status in `bracketsByStatus`, when it differs from the single one. */
  federalTaxSubtractionByStatus?: Partial<Record<OtherFilingStatus, FederalTaxSubtraction>>;
}

export interface BracketEngineInput {
  /** State income before the deduction (wages, less any state tips and overtime subtraction). */
  income: number;
  filingStatus?: FilingStatus;
  /** Federal income tax actually paid, for states with a `federalTaxSubtraction`. */
  federalTax?: number;
  /** Federal AGI for income-based reductions; defaults to `income`. */
  agi?: number;
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
  /** Personal credit actually subtracted (after its phase-out, and no more than the tax). */
  personalCredits: number;
  personalCreditLabel?: string;
  tax: number;
  /** True when the filing status had no schedule of its own and the single brackets were used. */
  usedSingleBrackets: boolean;
}

export function stateDeductionAmount(d: StateDeduction, income: number): number {
  if (d.kind === 'fixed') return d.amount;
  if (d.kind === 'tiers') return (d.tiers.find((t) => income <= t.upTo) ?? d.tiers[d.tiers.length - 1]).amount;
  if (income <= d.phaseoutStart) return d.max;
  if (income >= d.phaseoutEnd) return 0;
  const raw = (d.max * (income - d.phaseoutStart)) / (d.phaseoutEnd - d.phaseoutStart);
  const reduction = d.roundDownTo > 0 ? Math.floor(raw / d.roundDownTo) * d.roundDownTo : raw;
  return Math.max(0, d.max - reduction);
}

export function personalCreditAmount(c: PersonalCredit, income: number): number {
  if (c.incomeLimit !== undefined && income > c.incomeLimit) return 0;
  if (!c.phaseout || income <= c.phaseout.start) return c.amount;
  const steps = Math.ceil((income - c.phaseout.start) / c.phaseout.stepSize);
  return Math.max(0, c.amount - steps * c.phaseout.reductionPerStep);
}

/** Most federal tax that can be subtracted at this federal AGI. */
export function federalTaxSubtractionCap(f: FederalTaxSubtraction, agi: number): number {
  const tier = f.capByAgi?.find((t) => agi < t.below);
  return tier ? tier.cap : (f.cap ?? Infinity);
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
  const byStatus = <T>(map: Partial<Record<OtherFilingStatus, T>> | undefined): T | undefined =>
    own && status !== 'single' ? map?.[status] : undefined;
  const stateDeduction = byStatus(rules.deductionByStatus) ?? rules.deduction;
  const credit = byStatus(rules.personalCreditsByStatus) ?? rules.personalCredits;
  const subtraction = byStatus(rules.federalTaxSubtractionByStatus) ?? rules.federalTaxSubtraction;
  const agi = Math.max(0, input.agi ?? income);

  // a) and e): both reduce the income that the brackets apply to.
  const deduction = Math.min(income, stateDeductionAmount(stateDeduction, agi));
  const federalTaxSubtracted = subtraction
    ? Math.min(income - deduction, Math.max(0, input.federalTax ?? 0), federalTaxSubtractionCap(subtraction, agi))
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
  const personalCredits = credit ? Math.min(beforeCredits, personalCreditAmount(credit, agi)) : 0;

  return {
    income,
    deduction,
    deductionLabel: stateDeduction.label,
    federalTaxSubtracted,
    taxableIncome,
    lines,
    bracketTax,
    surcharges,
    personalCredits,
    personalCreditLabel: credit?.label,
    tax: beforeCredits - personalCredits,
    usedSingleBrackets: status !== 'single' && !own,
  };
}
