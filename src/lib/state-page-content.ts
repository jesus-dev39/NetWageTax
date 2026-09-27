/**
 * state-page-content.ts
 * Copy for the /state-taxes/[state]/ pages, built only from state-tax-data.ts.
 * Every sentence depends on the state's own numbers (rates, exempt amount,
 * rankings, neighbors), so pages differ in substance, not just in the name.
 */
import { formatUSD } from '../components/CurrencyInput';
import {
  calculateStateIncomeTax,
  GRADUATED_REFERENCE_WAGE,
  STATES,
  STATES_BY_CODE,
  type StateTaxInfo,
} from './state-tax-data';

export const EXAMPLE_WAGE = GRADUATED_REFERENCE_WAGE;

export const pct = (r: number) => `${+(r * 100).toFixed(2)}%`;

export const exampleTax = (s: StateTaxInfo) => calculateStateIncomeTax(EXAMPLE_WAGE, s.code);

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** "3rd-lowest" / "3rd-lowest (tied)"; rank 1 reads "lowest". */
function rankLabel(value: number, all: number[], direction: 'lowest' | 'highest'): string {
  const better = all.filter((v) => (direction === 'lowest' ? v < value : v > value)).length;
  const tied = all.filter((v) => v === value).length > 1;
  const place = better === 0 ? direction : `${ordinal(better + 1)}-${direction}`;
  return tied ? `${place} (tied)` : place;
}

export const STRUCTURE_NAME: Record<StateTaxInfo['structure'], string> = {
  none: 'No income tax on wages',
  flat: 'Flat tax',
  graduated: 'Progressive brackets',
};

/** Page <title> (the layout appends "| NetWageTax"). */
export function pageTitle(s: StateTaxInfo): string {
  if (s.structure === 'none') return `${s.name} Income Tax 2026: No State Tax on Wages & Calculator`;
  if (s.structure === 'flat') return `${s.name} Income Tax 2026: ${pct(s.estimateRate)} Flat Rate & Calculator`;
  return `${s.name} Income Tax 2026: Rates, Brackets & Calculator`;
}

export function metaDescription(s: StateTaxInfo): string {
  const tax = formatUSD(exampleTax(s));
  if (s.structure === 'none') {
    return `${s.name} has no state income tax on wages in 2026, so $65,000 of salary owes $0 in state tax. Compare neighboring states and estimate your federal tips and overtime deduction.`;
  }
  if (s.structure === 'flat') {
    return `${s.name} taxes wages at a flat ${pct(s.estimateRate)} in 2026. A single filer earning $65,000 owes about ${tax} in state income tax. See the math, compare neighbors, and run the calculator.`;
  }
  const [lo, hi] = s.bracketRange!;
  return `${s.name} income tax rates run from ${pct(lo)} to ${pct(hi)} in 2026. Estimated state tax on $65,000 of wages (single): about ${tax}. Compare neighbors and run the calculator.`;
}

/** Opening paragraph under the H1. */
export function leadParagraph(s: StateTaxInfo): string {
  const tax = exampleTax(s);
  const eff = pct(tax / EXAMPLE_WAGE);
  if (s.structure === 'none') {
    return `${s.name} does not tax wages, so a single filer earning ${formatUSD(EXAMPLE_WAGE)} owes ${formatUSD(0)} in state income tax for 2026.`;
  }
  if (s.structure === 'flat') {
    const base =
      s.exemptAmount > 0
        ? `after roughly ${formatUSD(s.exemptAmount)} of income that goes untaxed`
        : 'with no standard deduction or personal exemption in our model';
    return `${s.name} taxes wages at a single ${pct(s.estimateRate)} rate ${base}. A single filer earning ${formatUSD(EXAMPLE_WAGE)} owes an estimated ${formatUSD(tax)} for 2026, an effective rate of ${eff}.`;
  }
  const [lo, hi] = s.bracketRange!;
  return `${s.name} uses progressive brackets, with rates from ${pct(lo)} to ${pct(hi)}. For a single filer earning ${formatUSD(EXAMPLE_WAGE)}, our simplified 2026 estimate is ${formatUSD(tax)}, about ${eff} of wages.`;
}

/** Where the state sits nationally and within its own structure. */
export function rankingSentences(s: StateTaxInfo): string[] {
  if (s.structure === 'none') {
    const others = STATES.filter((x) => x.structure === 'none' && x.code !== s.code).map((x) => x.name);
    return [`${s.name} is one of ${others.length + 1} states with no tax on wages, along with ${listJoin(others)}.`];
  }
  const taxing = STATES.filter((x) => x.structure !== 'none');
  const out = [
    `At ${formatUSD(EXAMPLE_WAGE)} of wages, that is the ${rankLabel(exampleTax(s), taxing.map(exampleTax), 'lowest')} estimated bill of the ${taxing.length} jurisdictions (including DC) that tax wages.`,
  ];
  const peers = STATES.filter((x) => x.structure === s.structure);
  if (s.structure === 'flat') {
    out.push(`Its ${pct(s.estimateRate)} rate is the ${rankLabel(s.estimateRate, peers.map((x) => x.estimateRate), 'lowest')} of the ${peers.length} flat-tax states.`);
  } else {
    const top = s.bracketRange![1];
    out.push(`Its top rate of ${pct(top)} is the ${rankLabel(top, peers.map((x) => x.bracketRange![1]), 'highest')} among the ${peers.length} jurisdictions with progressive brackets.`);
  }
  return out;
}

export interface NeighborRow {
  state: StateTaxInfo;
  tax: number;
  /** Neighbor's estimated tax minus this state's, at the example wage. */
  diff: number;
}

export function neighborRows(s: StateTaxInfo): NeighborRow[] {
  const own = exampleTax(s);
  return s.neighbors
    .map((c) => STATES_BY_CODE[c])
    .map((state) => ({ state, tax: exampleTax(state), diff: exampleTax(state) - own }))
    .sort((a, b) => a.tax - b.tax || a.state.name.localeCompare(b.state.name));
}

export function neighborSummary(s: StateTaxInfo): string {
  const rows = neighborRows(s);
  if (rows.length === 0) {
    return `${s.name} shares no land border with another state, so there is no cross-border commute to compare.`;
  }
  const own = exampleTax(s);
  const cheaper = rows.filter((r) => r.tax < own).map((r) => r.state.name);
  const pricier = rows.filter((r) => r.tax > own).map((r) => r.state.name);
  const same = rows.filter((r) => r.tax === own).map((r) => r.state.name);
  const parts: string[] = [];
  if (s.structure === 'none') {
    if (same.length) parts.push(`${listJoin(same)} ${same.length > 1 ? 'also have' : 'also has'} no tax on wages.`);
    if (pricier.length) {
      const max = rows[rows.length - 1];
      parts.push(`Across the border in ${listJoin(pricier)}, the same ${formatUSD(EXAMPLE_WAGE)} salary would owe up to ${formatUSD(max.tax)} (${max.state.name}).`);
    }
    return parts.join(' ');
  }
  if (cheaper.length) parts.push(`Workers in ${listJoin(cheaper)} would owe less on the same salary.`);
  if (pricier.length) parts.push(`${listJoin(pricier)} would charge more.`);
  if (same.length) parts.push(`${listJoin(same)} would charge about the same.`);
  if (!cheaper.length) parts.unshift(`${s.name} has the lowest estimated bill among its neighbors.`);
  if (!pricier.length) parts.unshift(`${s.name} has the highest estimated bill among its neighbors.`);
  return parts.join(' ');
}

/** Tri-state tips & overtime notice. `unknown` must not claim anything. */
export function tipsOvertimeStatus(s: StateTaxInfo): 'no-wage-tax' | 'follows' | 'does-not-follow' | 'unknown' {
  if (s.structure === 'none') return 'no-wage-tax';
  if (s.followsFederalTipsOvertime === true) return 'follows';
  if (s.followsFederalTipsOvertime === false) return 'does-not-follow';
  return 'unknown';
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}
