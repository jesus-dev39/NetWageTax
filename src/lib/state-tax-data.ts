/**
 * state-tax-data.ts
 * Estimaciones del impuesto estatal sobre la renta (salarios) para 2026:
 * 50 estados + DC.
 *
 * Los estados con `engine` en BRACKETS (CA, NY, SC, WV) se calculan tramo a tramo
 * con state-bracket-engine.ts. Los demás usan el modelo simplificado:
 *   impuesto ≈ max(0, ingreso − exemptAmount) × estimateRate
 * - 'none':       sin impuesto sobre salarios.
 * - 'flat':       estimateRate = tipo estatutario; exemptAmount ≈ deducción
 *                 estándar / exención personal de un contribuyente single.
 * - 'graduated':  estimateRate = tipo medio sobre la renta gravable de un
 *                 contribuyente single con ~$65,000 de salario; útil para
 *                 salarios típicos, menos preciso en rentas muy altas o bajas.
 *
 * No incluye impuestos locales (condados, ciudades, school districts) ni
 * créditos estatales. El tratamiento estatal de la deducción federal OBBBA de
 * propinas/horas extra está en state-tips-overtime.ts (campo tipsOvertime), pero la
 * estimación todavía se calcula sobre el MAGI completo.
 *
 * Fuentes: departamentos de hacienda estatales y legislación 2025 aprobada
 * con efecto para el año fiscal 2026. Revisar cada enero (DATA_AS_OF).
 */

import type { FilingStatus } from './obbba-params';
import {
  computeBracketTax,
  type BracketEngineResult,
  type BracketEngineRules,
  type StateDeduction,
  type Surcharge,
  type TaxBracket,
} from './state-bracket-engine';
import { computeFederalIncomeTax, STANDARD_DEDUCTION_2026 } from './marginal-rate';
import { TIPS_OVERTIME_RULES, type TipsOvertimeRule } from './state-tips-overtime';

export type { TaxBracket };

export const STATE_TAX_DATA_AS_OF = '2026 tax year (laws enacted through mid-2026)';

/** Salario de referencia con el que se calibraron los tipos 'graduated'. */
export const GRADUATED_REFERENCE_WAGE = 65_000;

export type StateCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'DC' | 'FL' | 'GA' | 'HI' | 'ID'
  | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME' | 'MD' | 'MA' | 'MI' | 'MN' | 'MS' | 'MO'
  | 'MT' | 'NE' | 'NV' | 'NH' | 'NJ' | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA'
  | 'RI' | 'SC' | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI' | 'WY';

export type TaxStructure = 'none' | 'flat' | 'graduated';

export interface StateTaxInfo {
  code: StateCode;
  name: string;
  slug: string;
  structure: TaxStructure;
  /** Rate (0–1) applied to income above exemptAmount in the estimate. Not used when `bracketEngine` is set. */
  estimateRate: number;
  /** Approximate single-filer income not subject to the rate (standard deduction, exemptions, 0% bracket). Not used when `bracketEngine` is set. */
  exemptAmount: number;
  /** Graduated states: lowest and highest statutory marginal rates (0–1). */
  bracketRange?: [number, number];
  note: string;
  /** Local income taxes that the estimate does not include. */
  localTaxNote?: string;
  /** Short answer for "Local income taxes" in summary tables: 'None' without a localTaxNote, else LOCAL_TAX_LABELS or 'Some cities and counties'. */
  localTaxLabel: string;
  /** Official state revenue department website ('' = not yet verified). */
  sourceUrl: string;
  /** How the state treats the federal tips and overtime deduction, with sources (state-tips-overtime.ts). */
  tipsOvertime: TipsOvertimeRule;
  /** Official document the current rate comes from (a law or a state publication), when verified. */
  rateSource?: { url: string; label: string };
  /** Full single-filer bracket schedule, when verified. Pages show a table only if present (plus `bracketEngine.bracketsByStatus`). */
  brackets?: TaxBracket[];
  /** Set when the state is calculated bracket by bracket (state-bracket-engine.ts) instead of with estimateRate. */
  bracketEngine?: BracketEngineRules;
  /** Extra rate on income above `over` after exemptAmount, added to the simplified estimate (Massachusetts). */
  surtax?: Surcharge;
  /** Tax year of `brackets` (set whenever `brackets` is). */
  bracketsYear?: number;
  /** Official document the `brackets` were taken from. */
  bracketsSource?: string;
  /** Extra context shown under the bracket table (surcharges, recapture, ...). */
  bracketsNote?: string;
  /** Bordering states (DC counts as bordering MD and VA). */
  neighbors: StateCode[];
}

type Row = Omit<StateTaxInfo, 'slug' | 'sourceUrl' | 'neighbors' | 'localTaxLabel' | 'tipsOvertime' | 'surtax'>;

const NO_TAX = (code: StateCode, name: string, note: string): Row => ({
  code, name, structure: 'none', estimateRate: 0, exemptAmount: 0, note,
});

const FLAT = (code: StateCode, name: string, rate: number, exemptAmount: number, note: string, localTaxNote?: string): Row => ({
  code, name, structure: 'flat', estimateRate: rate, exemptAmount, note, localTaxNote,
});

const GRAD = (
  code: StateCode, name: string, estimateRate: number, exemptAmount: number,
  bracketRange: [number, number], note: string, localTaxNote?: string,
): Row => ({ code, name, structure: 'graduated', estimateRate, exemptAmount, bracketRange, note, localTaxNote });

const ROWS: Row[] = [
  GRAD('AL', 'Alabama', 0.044, 4_000, [0.02, 0.05], 'Three brackets (2%–5%). Alabama is one of the few states that lets you deduct federal income tax paid.', 'Some cities (e.g., Birmingham) levy a 1% occupational tax.'),
  NO_TAX('AK', 'Alaska', 'Alaska has no state income tax or statewide sales tax, and pays residents an annual Permanent Fund Dividend.'),
  FLAT('AZ', 'Arizona', 0.025, 16_100, 'Flat 2.5% since 2023, one of the lowest flat rates in the country. Uses the federal standard deduction.'),
  // HB 1001 (2026 First Extraordinary Session): net income up to $94,700 uses 0% / 2% / 3% / 3.4% / 3.7%.
  // estimateRate = that schedule on $65,000 − $2,470 (the $29 personal credit isn't applied).
  GRAD('AR', 'Arkansas', 0.0311, 2_470, [0.02, 0.037], 'Top rate cut to 3.7% for 2026 by HB 1001 (2026), applied back to January 1. Filers with net income up to $94,700 use a schedule that starts at 0%.'),
  GRAD('CA', 'California', 0.033, 5_700, [0.01, 0.133], 'Nine brackets from 1% to 12.3%, plus a 1% Behavioral Health Services Tax (formerly the Mental Health Services Tax) above $1 million. California does not follow the federal tips and overtime deduction.'),
  FLAT('CO', 'Colorado', 0.044, 16_100, 'Flat 4.4%, calculated from federal taxable income. TABOR refunds can temporarily lower the rate.', 'Denver and a few other cities charge a small monthly occupational privilege tax.'),
  GRAD('CT', 'Connecticut', 0.0435, 0, [0.02, 0.0699], 'Seven brackets (2%–6.99%). The personal exemption phases out by about $44,000 for single filers.'),
  GRAD('DE', 'Delaware', 0.048, 3_250, [0.022, 0.066], 'Brackets from 2.2% to 6.6% above $60,000. Delaware has no state sales tax.', 'Wilmington levies a 1.25% city wage tax.'),
  GRAD('DC', 'District of Columbia', 0.057, 16_100, [0.04, 0.1075], 'Seven brackets from 4% to 10.75%. Uses the federal standard deduction.'),
  NO_TAX('FL', 'Florida', 'Florida has no personal income tax. Article VII, Section 5 of the Florida Constitution prohibits one.'),
  // HB 463 (2026): 4.99% and the $15,000 single standard deduction ($30,000 joint), Section 2-3, for taxable years from
  // January 1, 2026 (Section 5-1). The deduction then rises $375 a year from 2027, up to $18,000, unless revenue triggers delay it.
  FLAT('GA', 'Georgia', 0.0499, 15_000, 'Flat 4.99% tax from January 1, 2026, under HB 463 (2026). Further cuts of 0.125 point a year toward 3.99% depend on state revenue.'),
  // Act 46 (2024): $8,000 single standard deduction for 2026 (Announcement 2024-03) + the $1,144 personal exemption.
  GRAD('HI', 'Hawaii', 0.064, 9_144, [0.014, 0.11], 'Twelve brackets up to 11%. Recent laws are doubling the standard deduction and widening brackets through 2031.'),
  FLAT('ID', 'Idaho', 0.053, 20_900, 'Flat 5.3% on income above a 0% band, after the federal standard deduction.'),
  FLAT('IL', 'Illinois', 0.0495, 2_925, 'Flat 4.95%, set by the Illinois Constitution, which requires a single rate.'),
  FLAT('IN', 'Indiana', 0.0295, 1_000, 'Flat rate cut to 2.95% for 2026.', 'All 92 counties add a local income tax, typically 1%–3%.'),
  FLAT('IA', 'Iowa', 0.038, 16_100, 'Flat 3.8% since 2025, calculated from federal taxable income. Retirement income is exempt.', 'Some school districts add a surtax as a percentage of state tax.'),
  GRAD('KS', 'Kansas', 0.054, 12_765, [0.052, 0.0558], 'Two brackets (5.2% and 5.58%) since 2024.', 'Some localities tax interest and dividends; wages are not locally taxed.'),
  FLAT('KY', 'Kentucky', 0.035, 3_360, 'Flat rate cut to 3.5% for 2026.', 'Most cities and counties charge occupational license taxes on wages (often 1%–2.5%).'),
  FLAT('LA', 'Louisiana', 0.03, 12_875, 'Flat 3% since 2025, with a $12,875 standard deduction for 2026.'),
  // MRS 2026 withholding tables (August 2026): $15,700 basic standard deduction + $5,300 personal exemption, phased out above $102,250.
  GRAD('ME', 'Maine', 0.062, 21_000, [0.058, 0.0715], 'Three brackets (5.8%–7.15%). Maine has its own standard deduction plus a personal exemption, both phased out at higher incomes.'),
  GRAD('MD', 'Maryland', 0.047, 6_550, [0.02, 0.065], 'State brackets from 2% to 6.5%, with new top brackets added in 2025.', 'Every county and Baltimore City add a local income tax of 2.25%–3.3%, not included here.'),
  // The surtax threshold is indexed every year: $1,083,150 in 2025, $1,107,750 in 2026 (MA_SURTAX_THRESHOLD).
  FLAT('MA', 'Massachusetts', 0.05, 4_400, 'Flat 5%, plus a 4% surtax on taxable income above $1,107,750 for 2026 (the "millionaires tax"). Our estimate includes the surtax.'),
  // 4.25% for 2026 confirmed by Treasury's rate notice of April 15, 2026.
  FLAT('MI', 'Michigan', 0.0425, 5_900, 'Flat 4.25%.', 'Detroit (2.4%) and about 20 other cities levy their own income tax.'),
  GRAD('MN', 'Minnesota', 0.059, 15_300, [0.0535, 0.0985], 'Four brackets from 5.35% to 9.85%.'),
  FLAT('MS', 'Mississippi', 0.04, 18_300, 'The first $10,000 of taxable income is exempt, then 4% for 2026, stepping down to 3% by 2030.'),
  GRAD('MO', 'Missouri', 0.044, 16_100, [0.02, 0.047], 'Brackets up to 4.7%, reached at a low income. Uses the federal standard deduction.', 'Kansas City and St. Louis charge a 1% earnings tax.'),
  GRAD('MT', 'Montana', 0.052, 16_100, [0.047, 0.0565], 'Two brackets; the top rate drops to 5.65% for 2026. Starts from federal taxable income.'),
  // estimateRate: 2026 brackets (2.46% / 3.51% over $4,130 / 4.55% over $24,760) on $65,000 − $8,850.
  GRAD('NE', 'Nebraska', 0.0401, 8_850, [0.0246, 0.0455], 'The top rate drops to 4.55% for 2026 on the way to 3.99%.'),
  NO_TAX('NV', 'Nevada', 'Nevada has no personal income tax. The Nevada Constitution (Article 10, Section 1) prohibits one.'),
  NO_TAX('NH', 'New Hampshire', 'No tax on wages. The Interest and Dividends Tax was fully repealed starting in 2025.'),
  GRAD('NJ', 'New Jersey', 0.032, 1_000, [0.014, 0.1075], 'Seven brackets from 1.4% to 10.75%.', 'Newark and Jersey City charge employers a 1% payroll tax.'),
  GRAD('NM', 'New Mexico', 0.039, 16_100, [0.015, 0.059], 'Six brackets from 1.5% to 5.9%, restructured in 2025. Uses the federal standard deduction.'),
  GRAD('NY', 'New York', 0.051, 8_000, [0.039, 0.109], 'Nine brackets up to 10.9%. Rates for the lower brackets were trimmed starting in 2026.', 'New York City adds 3.078%–3.876%; Yonkers adds a resident surcharge.'),
  FLAT('NC', 'North Carolina', 0.0399, 12_750, 'Flat rate cut to 3.99% for 2026, with further cuts possible if revenue triggers are met.'),
  GRAD('ND', 'North Dakota', 0.0195, 64_575, [0, 0.025], 'Most workers owe nothing: the first ~$48,000 of taxable income is taxed at 0%, then 1.95% and 2.5%.'),
  // $26,050 0% band + the $2,150 personal exemption for MAGI of $40,000–$80,000 (the tier of the reference wage).
  FLAT('OH', 'Ohio', 0.0275, 28_200, 'New flat 2.75% for 2026 on income above $26,050, after a personal exemption that depends on income: $2,400 up to $40,000 of modified AGI, $2,150 from $40,000 to $80,000, and $1,900 from $80,000 to $500,000. Our estimate uses the $2,150 exemption at every income.', 'Most cities and many school districts levy income taxes of 1%–2.5%.'),
  GRAD('OK', 'Oklahoma', 0.041, 7_350, [0.025, 0.045], 'Brackets consolidated and the top rate cut to 4.5% for 2026.'),
  // Calculated with the bracket engine (BRACKETS.OR); estimateRate and exemptAmount are only a fallback.
  GRAD('OR', 'Oregon', 0.0703, 2_910, [0.0475, 0.099], 'Four brackets up to 9.9%, with a small standard deduction. You can subtract the federal income tax you paid, up to $8,750 for 2026, a limit that shrinks at higher incomes. Oregon has no sales tax.', 'Portland Metro and Multnomah County add taxes on higher incomes.'),
  FLAT('PA', 'Pennsylvania', 0.0307, 0, 'Flat 3.07% with no standard deduction or personal exemption.', 'Most municipalities levy an earned income tax (usually ~1%; Philadelphia 3.74%).'),
  // $11,200 standard deduction + $5,250 exemption; $48,550 taxable stays in the 3.75% bracket.
  GRAD('RI', 'Rhode Island', 0.0375, 16_450, [0.0375, 0.0599], 'Three brackets (3.75%–5.99%).'),
  // H.4216 (Act 110 of 2026). exemptAmount = the SCIAD at $65,000 of federal AGI ($15,000 less 25/55, rounded down to $10);
  // estimateRate = 1.99% / 5.21% on the remaining $56,810.
  GRAD('SC', 'South Carolina', 0.0351, 8_190, [0.0199, 0.0521], 'Two brackets for 2026, 1.99% and 5.21%, under H.4216 (2026). South Carolina no longer uses the federal standard deduction: its own deduction (SCIAD) is $15,000 for single filers, shrinks once federal AGI passes $40,000, and is gone at $95,000.'),
  NO_TAX('SD', 'South Dakota', 'South Dakota has no personal income tax.'),
  NO_TAX('TN', 'Tennessee', 'No tax on wages. The Hall tax on investment income was fully repealed in 2021, and the Tennessee Constitution bans a payroll tax.'),
  NO_TAX('TX', 'Texas', 'Texas has 0% state income tax. Article VIII, Section 24-a of the Texas Constitution prohibits a personal income tax.'),
  // SB 60 (2026, Chapter 250): 4.45% for taxable years beginning on or after January 1, 2026.
  FLAT('UT', 'Utah', 0.0445, 0, 'Flat 4.45% for 2026, cut from 4.5% in 2026 and applied back to January 1. A taxpayer credit (not included) lowers the tax for most low- and middle-income filers.'),
  // $7,650 standard deduction (2025, until the 2026 figure is published) + the $5,400 2026 exemption (TaxTables-2026);
  // estimateRate: 2025 brackets, 3.35% / 6.6% over $49,400, on $51,950 = $1,823.
  GRAD('VT', 'Vermont', 0.0351, 13_050, [0.0335, 0.0875], 'Four brackets from 3.35% to 8.75%.'),
  // $8,750 standard deduction + $930 exemption; estimateRate: 2% / 3% / 5% / 5.75% over $17,000 on $55,320.
  GRAD('VA', 'Virginia', 0.0528, 9_680, [0.02, 0.0575], 'Four brackets; the 5.75% top rate starts at just $17,000 of taxable income.'),
  NO_TAX('WA', 'Washington', 'No tax on wages. Washington taxes only long-term capital gains above a large exemption.'),
  // SB 392 (2026): estimateRate = the 2026 schedule on $65,000 − $2,000.
  GRAD('WV', 'West Virginia', 0.0331, 2_000, [0.0211, 0.0458], 'Five brackets from 2.11% to 4.58% for 2026, under SB 392 (2026), applied back to January 1.'),
  // Form 1-ES 2026: $13,960 standard deduction less 12% of income over $20,120 ($8,574 at $65,000) + the $700 exemption.
  GRAD('WI', 'Wisconsin', 0.046, 9_274, [0.035, 0.0765], 'Four brackets from 3.5% to 7.65%. The standard deduction phases down as income rises.'),
  NO_TAX('WY', 'Wyoming', 'Wyoming has no personal or corporate income tax.'),
];

/**
 * Date the rules behind the estimates (federal, FICA, and state) were last reviewed by hand (ISO).
 * Shown in the site-wide status strip, on /methodology/, and on the state pages. Update it after every review.
 */
export const STATE_TAX_LAST_UPDATED = '2026-10-04';

/**
 * Official revenue department sites. Leave '' when unsure; pages then omit the link.
 * TODO: verify every URL by hand before each annual update.
 */
const SOURCE_URLS: Record<StateCode, string> = {
  AL: 'https://www.revenue.alabama.gov/',
  AK: 'https://tax.alaska.gov/',
  AZ: 'https://azdor.gov/',
  AR: 'https://www.dfa.arkansas.gov/',
  CA: 'https://www.ftb.ca.gov/',
  CO: 'https://tax.colorado.gov/',
  CT: 'https://portal.ct.gov/drs',
  DE: 'https://revenue.delaware.gov/',
  DC: 'https://otr.cfo.dc.gov/',
  FL: 'https://floridarevenue.com/',
  GA: 'https://dor.georgia.gov/',
  HI: 'https://tax.hawaii.gov/',
  ID: 'https://tax.idaho.gov/',
  IL: 'https://tax.illinois.gov/',
  IN: 'https://www.in.gov/dor/',
  IA: 'https://revenue.iowa.gov/',
  KS: 'https://www.ksrevenue.gov/',
  KY: 'https://revenue.ky.gov/',
  LA: 'https://revenue.louisiana.gov/',
  ME: 'https://www.maine.gov/revenue/',
  MD: 'https://www.marylandcomptroller.gov/',
  MA: 'https://www.mass.gov/orgs/massachusetts-department-of-revenue',
  MI: 'https://www.michigan.gov/taxes',
  MN: 'https://www.revenue.state.mn.us/',
  MS: 'https://www.dor.ms.gov/',
  MO: 'https://dor.mo.gov/',
  MT: 'https://revenue.mt.gov/',
  NE: 'https://revenue.nebraska.gov/',
  NV: 'https://tax.nv.gov/',
  NH: 'https://www.revenue.nh.gov/',
  NJ: 'https://www.nj.gov/treasury/taxation/',
  NM: 'https://www.tax.newmexico.gov/',
  NY: 'https://www.tax.ny.gov/',
  NC: 'https://www.ncdor.gov/',
  ND: 'https://www.tax.nd.gov/',
  OH: '',
  OK: 'https://oklahoma.gov/tax.html',
  OR: 'https://www.oregon.gov/dor/',
  PA: 'https://www.pa.gov/agencies/revenue',
  RI: 'https://tax.ri.gov/',
  SC: 'https://dor.sc.gov/',
  SD: 'https://dor.sd.gov/',
  TN: 'https://www.tn.gov/revenue.html',
  TX: 'https://comptroller.texas.gov/',
  UT: 'https://tax.utah.gov/',
  VT: 'https://tax.vermont.gov/',
  VA: 'https://www.tax.virginia.gov/',
  WA: 'https://dor.wa.gov/',
  WV: 'https://tax.wv.gov/',
  WI: 'https://www.revenue.wi.gov/',
  WY: 'https://revenue.wyo.gov/',
};

/**
 * Short "Local income taxes" answer where the default ('Some cities and counties') would be wrong.
 * Must agree with the state's localTaxNote.
 */
const LOCAL_TAX_LABELS: Partial<Record<StateCode, string>> = {
  AL: 'Some cities',
  CO: 'Some cities',
  DE: 'Wilmington only',
  IN: 'Every county',
  IA: 'Some school districts',
  KS: 'None on wages',
  MD: 'Every county and Baltimore City',
  MI: 'Some cities',
  MO: 'Kansas City and St. Louis',
  NJ: 'Newark and Jersey City, paid by employers',
  NY: 'New York City and Yonkers',
  OH: 'Cities and school districts',
  PA: 'Most municipalities',
};

/** Official documents for current rates, added state by state as each is verified. */
const RATE_SOURCES: Partial<Record<StateCode, { url: string; label: string }>> = {
  GA: { url: 'https://gov.georgia.gov/document/2026-signed-legislation/hb-463/download', label: 'HB 463 (2026), as passed (PDF)' },
  UT: {
    url: 'https://le.utah.gov/xcode/title59/chapter10/C59-10-S104_2026050620260506.pdf',
    label: 'Utah Code § 59-10-104, as amended by SB 60 (2026) (PDF)',
  },
  AR: {
    url: 'https://arkleg.state.ar.us/Home/FTPDocument?path=%2FBills%2F2026S1%2FPublic%2FHB1001.pdf',
    label: 'HB 1001 (2026 First Extraordinary Session) (PDF)',
  },
  SC: { url: 'https://www.scstatehouse.gov/sess126_2025-2026/bills/4216.htm', label: 'H.4216 (Act 110 of 2026)' },
  WV: {
    url: 'https://www.wvlegislature.gov/Bill_Text_HTML/2026_SESSIONS/RS/bills/sb392%20sub1%20enr.htm',
    label: 'SB 392 (2026), enrolled',
  },
};

/** Massachusetts 4% surtax threshold for 2026 (mass.gov, "Massachusetts tax rates"; $1,083,150 in 2025). */
export const MA_SURTAX_THRESHOLD = 1_107_750;

/** Surtaxes added to the simplified estimate. Bracket-engine states use `engine.surcharges` instead. */
const SURTAXES: Partial<Record<StateCode, Surcharge>> = {
  MA: { over: MA_SURTAX_THRESHOLD, rate: 0.04, label: 'Millionaires surtax' },
};

interface BracketSchedule {
  year: number;
  source: string;
  brackets: TaxBracket[];
  note?: string;
  /**
   * Set once the schedule is fit for the calculation: calculateStateIncomeTax then runs the bracket
   * engine (state-bracket-engine.ts) with these rules and `brackets`, instead of estimateRate.
   */
  engine?: Omit<BracketEngineRules, 'brackets'>;
}

/**
 * Verified single-filer bracket schedules, each from an official document. Add states one by one;
 * pages pick them up automatically. Without `engine`, the table is display only and
 * calculateStateIncomeTax uses estimateRate.
 */
// H.4216, Section 1 (12-6-510(C)): one schedule for every filing status.
const SC_BRACKETS: TaxBracket[] = [
  { over: 0, rate: 0.0199 },
  { over: 30_000, rate: 0.0521 },
];

// SB 392, 11-21-4j(a): one schedule for single, joint, and head of household returns (separate returns have their own).
const WV_BRACKETS: TaxBracket[] = [
  { over: 0, rate: 0.0211 },
  { over: 10_000, rate: 0.0281 },
  { over: 25_000, rate: 0.0316 },
  { over: 40_000, rate: 0.0422 },
  { over: 60_000, rate: 0.0458 },
];

/** South Carolina's SCIAD: the reduction is rounded down to a multiple of $10 ($8,190 at $65,000 of federal AGI, single). */
const SCIAD = (max: number, phaseoutStart: number, phaseoutEnd: number): StateDeduction => ({
  kind: 'phaseout',
  max,
  phaseoutStart,
  phaseoutEnd,
  roundDownTo: 10,
  label: 'South Carolina income adjusted deduction (SCIAD)',
});

// One-rate states on the bracket engine: the same schedule for every filing status.
const AZ_BRACKETS: TaxBracket[] = [{ over: 0, rate: 0.025 }];
const NC_BRACKETS: TaxBracket[] = [{ over: 0, rate: 0.0399 }];
const GA_BRACKETS: TaxBracket[] = [{ over: 0, rate: 0.0499 }];

// Maryland Tax Rate Schedule II: married filing jointly, head of household, qualifying surviving spouse.
const MD_JOINT_BRACKETS: TaxBracket[] = [
  { over: 0, rate: 0.02 },
  { over: 1_000, rate: 0.03 },
  { over: 2_000, rate: 0.04 },
  { over: 3_000, rate: 0.0475 },
  { over: 150_000, rate: 0.05 },
  { over: 175_000, rate: 0.0525 },
  { over: 225_000, rate: 0.055 },
  { over: 300_000, rate: 0.0575 },
  { over: 600_000, rate: 0.0625 },
  { over: 1_200_000, rate: 0.065 },
];

// Oregon Chart J: joint, head of household, and qualifying surviving spouse returns.
const OR_JOINT_BRACKETS: TaxBracket[] = [
  { over: 0, rate: 0.0475 },
  { over: 9_100, rate: 0.0675 },
  { over: 22_800, rate: 0.0875 },
  { over: 250_000, rate: 0.099 },
];

/** Oregon's 2026 federal tax subtraction cap: $8,750 below `start` of federal AGI, $1,750 less for each `step` from there. */
const OR_SUBTRACTION_CAPS = (start: number, step: number) => [
  { below: start, cap: 8_750 },
  { below: start + step, cap: 7_000 },
  { below: start + 2 * step, cap: 5_250 },
  { below: start + 3 * step, cap: 3_500 },
  { below: start + 4 * step, cap: 1_750 },
  { below: Infinity, cap: 0 },
];

const BRACKETS: Partial<Record<StateCode, BracketSchedule>> = {
  SC: {
    // H.4216, Section 3 (12-6-1140(15)): $15,000 single, $22,500 head of household, $30,000 joint, each reduced by the
    // share of federal AGI above $40,000 / $60,000 / $80,000 over $55,000 / $82,500 / $110,000.
    engine: {
      deduction: SCIAD(15_000, 40_000, 95_000),
      bracketsByStatus: { mfj: SC_BRACKETS, hoh: SC_BRACKETS },
      deductionByStatus: { mfj: SCIAD(30_000, 80_000, 190_000), hoh: SCIAD(22_500, 60_000, 142_500) },
    },
    year: 2026,
    source: 'https://www.scstatehouse.gov/sess126_2025-2026/bills/4216.htm',
    brackets: SC_BRACKETS,
    note: 'The same brackets apply to every filing status, on South Carolina taxable income after the SCIAD deduction: $15,000 for single filers, reduced by the share of federal AGI above $40,000 over $55,000 (so $8,190 at $65,000 and $0 from $95,000). The SCIAD is $30,000 on a joint return (reduced between $80,000 and $190,000) and $22,500 for a head of household (reduced between $60,000 and $142,500).',
  },
  WV: {
    // W. Va. Code 11-21-16 (https://code.wvlegislature.gov/11-21-16/): $2,000 for each federal exemption, so $4,000 on a
    // joint return. Dependents aren't counted: a head of household gets $2,000 for the filer only.
    engine: {
      deduction: { kind: 'fixed', amount: 2_000, label: 'Personal exemption' },
      bracketsByStatus: { mfj: WV_BRACKETS, hoh: WV_BRACKETS },
      deductionByStatus: { mfj: { kind: 'fixed', amount: 4_000, label: 'Personal exemptions (2 × $2,000)' } },
    },
    year: 2026,
    source: 'https://www.wvlegislature.gov/Bill_Text_HTML/2026_SESSIONS/RS/bills/sb392%20sub1%20enr.htm',
    brackets: WV_BRACKETS,
    note: 'The same brackets apply to single, joint, and head of household returns, on West Virginia taxable income after the $2,000 personal exemption ($4,000 on a joint return). Each dependent adds another $2,000, which we don’t include.',
  },
  CA: {
    // 2025 single standard deduction (Form 540 instructions, https://www.ftb.ca.gov/forms/2025/2025-540-instructions.html)
    // and personal exemption credit, $6 less for each $2,500 or part of federal AGI over $252,203
    // (540 2EZ tax table, https://www.ftb.ca.gov/forms/2025/2025-540-2ez-taxtable-single.pdf).
    // Joint and head of household: Schedules Y and Z of the same PDF, the $11,412 standard deduction (Form 540 instructions,
    // line 18), and the AGI Limitation Worksheet: credits reduced above $504,411 (joint) or $378,310 (head of household)
    // of federal AGI, $6 per credit for each $2,500 or part. Form 540, line 7: 2 personal credits on a joint return, 1 for
    // a head of household. Dependent exemption credits aren't included. The 1% surcharge is the same for every status.
    engine: {
      deduction: { kind: 'fixed', amount: 5_706, label: 'Standard deduction' },
      surcharges: [{ over: 1_000_000, rate: 0.01, label: 'Behavioral Health Services Tax' }],
      personalCredits: {
        amount: 153,
        label: 'Personal exemption credit',
        phaseout: { start: 252_203, stepSize: 2_500, reductionPerStep: 6 },
      },
      bracketsByStatus: {
        mfj: [
          { over: 0, rate: 0.01 },
          { over: 22_158, rate: 0.02 },
          { over: 52_528, rate: 0.04 },
          { over: 82_904, rate: 0.06 },
          { over: 115_084, rate: 0.08 },
          { over: 145_448, rate: 0.093 },
          { over: 742_958, rate: 0.103 },
          { over: 891_542, rate: 0.113 },
          { over: 1_485_906, rate: 0.123 },
        ],
        hoh: [
          { over: 0, rate: 0.01 },
          { over: 22_173, rate: 0.02 },
          { over: 52_530, rate: 0.04 },
          { over: 67_716, rate: 0.06 },
          { over: 83_805, rate: 0.08 },
          { over: 98_990, rate: 0.093 },
          { over: 505_208, rate: 0.103 },
          { over: 606_251, rate: 0.113 },
          { over: 1_010_417, rate: 0.123 },
        ],
      },
      deductionByStatus: {
        mfj: { kind: 'fixed', amount: 11_412, label: 'Standard deduction' },
        hoh: { kind: 'fixed', amount: 11_412, label: 'Standard deduction' },
      },
      personalCreditsByStatus: {
        mfj: {
          amount: 306,
          label: 'Personal exemption credits (2 × $153)',
          phaseout: { start: 504_411, stepSize: 2_500, reductionPerStep: 12 },
        },
        hoh: {
          amount: 153,
          label: 'Personal exemption credit',
          phaseout: { start: 378_310, stepSize: 2_500, reductionPerStep: 6 },
        },
      },
    },
    year: 2025,
    source: 'https://www.ftb.ca.gov/forms/2025/2025-540-tax-rate-schedules.pdf',
    brackets: [
      { over: 0, rate: 0.01 },
      { over: 11_079, rate: 0.02 },
      { over: 26_264, rate: 0.04 },
      { over: 41_452, rate: 0.06 },
      { over: 57_542, rate: 0.08 },
      { over: 72_724, rate: 0.093 },
      { over: 371_479, rate: 0.103 },
      { over: 445_771, rate: 0.113 },
      { over: 742_953, rate: 0.123 },
    ],
    note: 'California adds a 1% Behavioral Health Services Tax (formerly the Mental Health Services Tax) on taxable income over $1,000,000, for a top marginal rate of 13.3%, whatever your filing status. Joint and head of household returns have a $11,412 standard deduction; a joint return gets two $153 personal exemption credits.',
  },
  VT: {
    year: 2025,
    source: 'https://tax.vermont.gov/sites/tax/files/documents/TaxRateSched-2025.pdf',
    brackets: [
      { over: 0, rate: 0.0335 },
      { over: 49_400, rate: 0.066 },
      { over: 119_700, rate: 0.076 },
      { over: 249_700, rate: 0.0875 },
    ],
    note: 'If your adjusted gross income is over $150,000, Vermont tax is the greater of 3% of AGI or the rate schedule amount.',
  },
  NY: {
    // Joint and head of household: Tax Law 601(a) and (b), item (vii), "taxable years beginning after 2025 and before
    // 2027" (https://www.nysenate.gov/legislation/laws/TAX/601; its single table, 601(c), matches the one below).
    // Standard deductions: IT-201 instructions 2025, page 11 ($16,050 joint, $11,200 head of household; not indexed).
    // Tax benefit recapture isn't calculated; the bracket note mentions it.
    engine: {
      deduction: { kind: 'fixed', amount: 8_000, label: 'Standard deduction' },
      bracketsByStatus: {
        mfj: [
          { over: 0, rate: 0.039 },
          { over: 17_150, rate: 0.044 },
          { over: 23_600, rate: 0.0515 },
          { over: 27_900, rate: 0.054 },
          { over: 161_550, rate: 0.059 },
          { over: 323_200, rate: 0.0685 },
          { over: 2_155_350, rate: 0.0965 },
          { over: 5_000_000, rate: 0.103 },
          { over: 25_000_000, rate: 0.109 },
        ],
        hoh: [
          { over: 0, rate: 0.039 },
          { over: 12_800, rate: 0.044 },
          { over: 17_650, rate: 0.0515 },
          { over: 20_900, rate: 0.054 },
          { over: 107_650, rate: 0.059 },
          { over: 269_300, rate: 0.0685 },
          { over: 1_616_450, rate: 0.0965 },
          { over: 5_000_000, rate: 0.103 },
          { over: 25_000_000, rate: 0.109 },
        ],
      },
      deductionByStatus: {
        mfj: { kind: 'fixed', amount: 16_050, label: 'Standard deduction' },
        hoh: { kind: 'fixed', amount: 11_200, label: 'Standard deduction' },
      },
    },
    year: 2026,
    source: 'https://www.tax.ny.gov/pdf/publications/withholding/nys50_t_nys.pdf',
    brackets: [
      { over: 0, rate: 0.039 },
      { over: 8_500, rate: 0.044 },
      { over: 11_700, rate: 0.0515 },
      { over: 13_900, rate: 0.054 },
      { over: 80_650, rate: 0.059 },
      { over: 215_400, rate: 0.0685 },
      { over: 1_077_550, rate: 0.0965 },
      { over: 5_000_000, rate: 0.103 },
      { over: 25_000_000, rate: 0.109 },
    ],
    note: "New York cut its five lowest rates by 0.1 percentage point for 2026. New York's tax benefit recapture starts to apply once New York AGI is over $107,650, for every filing status. We don't calculate it, so above that income our figure is lower than the actual tax. The joint and head of household brackets are from New York Tax Law § 601(a) and (b), with standard deductions of $16,050 and $11,200. New York City and Yonkers residents pay local income tax on top of these rates.",
  },
  AZ: {
    // A.R.S. 43-1041 (HB 4168, 2026): $15,750 / $31,500 / $23,625, indexed like the federal standard deduction (subsection H),
    // so the 2026 federal amounts. ADOR hasn't published the 2026 forms yet (PENDING-UPDATES). Rate: 2.5% (ADOR 2026 Form 140ES).
    engine: {
      deduction: { kind: 'fixed', amount: 16_100, label: 'Standard deduction' },
      bracketsByStatus: { mfj: AZ_BRACKETS, hoh: AZ_BRACKETS },
      deductionByStatus: {
        mfj: { kind: 'fixed', amount: 32_200, label: 'Standard deduction' },
        hoh: { kind: 'fixed', amount: 24_150, label: 'Standard deduction' },
      },
    },
    year: 2026,
    source: 'https://www.azleg.gov/ars/43/01041.htm',
    brackets: AZ_BRACKETS,
    note: 'One 2.5% rate for every filing status, after the standard deduction: $16,100 single, $32,200 married filing jointly, $24,150 head of household.',
  },
  NC: {
    // NCDOR: "For Taxable Years after 2025, the North Carolina individual income tax rate is 3.99%"; standard deduction chart.
    engine: {
      deduction: { kind: 'fixed', amount: 12_750, label: 'Standard deduction' },
      bracketsByStatus: { mfj: NC_BRACKETS, hoh: NC_BRACKETS },
      deductionByStatus: {
        mfj: { kind: 'fixed', amount: 25_500, label: 'Standard deduction' },
        hoh: { kind: 'fixed', amount: 19_125, label: 'Standard deduction' },
      },
    },
    year: 2026,
    source: 'https://www.ncdor.gov/taxes-forms/individual-income-tax/north-carolina-standard-deduction-or-north-carolina-itemized-deductions',
    brackets: NC_BRACKETS,
    note: 'One 3.99% rate for every filing status, after the standard deduction: $12,750 single, $25,500 married filing jointly, $19,125 head of household.',
  },
  GA: {
    // HB 463, Section 2-3: $15,000 for single, head of household, and married filing separately; $30,000 joint (Section 5-1: from 2026).
    engine: {
      deduction: { kind: 'fixed', amount: 15_000, label: 'Standard deduction' },
      bracketsByStatus: { mfj: GA_BRACKETS, hoh: GA_BRACKETS },
      deductionByStatus: { mfj: { kind: 'fixed', amount: 30_000, label: 'Standard deduction' } },
    },
    year: 2026,
    source: 'https://gov.georgia.gov/document/2026-signed-legislation/hb-463/download',
    brackets: GA_BRACKETS,
    note: 'One 4.99% rate for every filing status, after the standard deduction: $15,000 single or head of household, $30,000 married filing jointly.',
  },
  MD: {
    // Comptroller, 2026 Payment Voucher Worksheet: Tax Rate Schedules I and II (Budget Reconciliation and Financing Act of 2025),
    // $3,350 / $6,700 standard deduction, and $3,200 per exemption reduced by federal AGI. The MW507 instructions say $3,400:
    // to confirm with the 2026 Form 502 instructions (PENDING-UPDATES). County income tax isn't included.
    engine: {
      deduction: {
        kind: 'tiers',
        // $3,350 + one exemption: $3,200 up to $100,000 of federal AGI, $1,600 to $125,000, $800 to $150,000, then $0.
        tiers: [
          { upTo: 100_000, amount: 6_550 },
          { upTo: 125_000, amount: 4_950 },
          { upTo: 150_000, amount: 4_150 },
          { upTo: Infinity, amount: 3_350 },
        ],
        label: 'Standard deduction and personal exemption',
      },
      bracketsByStatus: { mfj: MD_JOINT_BRACKETS, hoh: MD_JOINT_BRACKETS },
      deductionByStatus: {
        // $6,700 + $3,200 per exemption up to $150,000, $1,600 to $175,000, $800 to $200,000, then $0.
        mfj: {
          kind: 'tiers',
          tiers: [
            { upTo: 150_000, amount: 13_100 },
            { upTo: 175_000, amount: 9_900 },
            { upTo: 200_000, amount: 8_300 },
            { upTo: Infinity, amount: 6_700 },
          ],
          label: 'Standard deduction and personal exemptions (2)',
        },
        hoh: {
          kind: 'tiers',
          tiers: [
            { upTo: 150_000, amount: 9_900 },
            { upTo: 175_000, amount: 8_300 },
            { upTo: 200_000, amount: 7_500 },
            { upTo: Infinity, amount: 6_700 },
          ],
          label: 'Standard deduction and personal exemption',
        },
      },
    },
    year: 2026,
    source: 'https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/forms/worksheets/2026-pv-worksheet.pdf',
    brackets: [
      { over: 0, rate: 0.02 },
      { over: 1_000, rate: 0.03 },
      { over: 2_000, rate: 0.04 },
      { over: 3_000, rate: 0.0475 },
      { over: 100_000, rate: 0.05 },
      { over: 125_000, rate: 0.0525 },
      { over: 150_000, rate: 0.055 },
      { over: 250_000, rate: 0.0575 },
      { over: 500_000, rate: 0.0625 },
      { over: 1_000_000, rate: 0.065 },
    ],
    note: 'State tax only: every county and Baltimore City add their own income tax. The standard deduction is a flat $3,350 ($6,700 for joint and head of household returns), plus a $3,200 personal exemption per person that shrinks once federal AGI passes $100,000 ($150,000 for joint and head of household returns) and is gone above $150,000 ($200,000).',
  },
  OR: {
    // DOR Withholding Tax Formulas 2026 (150-206-436, rev. 12-31-25): brackets, $2,910 / $5,820 standard deduction, $263 exemption
    // credit, and the $8,750 federal tax subtraction with its phase-out. 2025 OR-40 instructions: head of household uses Chart J
    // (the joint brackets) and the joint phase-out; its $4,560 standard deduction is the 2025 figure (PENDING-UPDATES); the
    // exemption credit isn't allowed above $100,000 of federal AGI ($200,000 for joint and head of household returns).
    engine: {
      deduction: { kind: 'fixed', amount: 2_910, label: 'Standard deduction' },
      federalTaxSubtraction: { capByAgi: OR_SUBTRACTION_CAPS(125_000, 5_000) },
      personalCredits: { amount: 263, label: 'Exemption credit', incomeLimit: 100_000 },
      bracketsByStatus: { mfj: OR_JOINT_BRACKETS, hoh: OR_JOINT_BRACKETS },
      deductionByStatus: {
        mfj: { kind: 'fixed', amount: 5_820, label: 'Standard deduction' },
        hoh: { kind: 'fixed', amount: 4_560, label: 'Standard deduction' },
      },
      federalTaxSubtractionByStatus: {
        mfj: { capByAgi: OR_SUBTRACTION_CAPS(250_000, 10_000) },
        hoh: { capByAgi: OR_SUBTRACTION_CAPS(250_000, 10_000) },
      },
      personalCreditsByStatus: {
        mfj: { amount: 526, label: 'Exemption credits (2 × $263)', incomeLimit: 200_000 },
        hoh: { amount: 263, label: 'Exemption credit', incomeLimit: 200_000 },
      },
    },
    year: 2026,
    source: 'https://www.oregon.gov/dor/forms/FormsPubs/withholding-tax-formulas_206-436_2026.pdf',
    brackets: [
      { over: 0, rate: 0.0475 },
      { over: 4_550, rate: 0.0675 },
      { over: 11_400, rate: 0.0875 },
      { over: 125_000, rate: 0.099 },
    ],
    note: 'Joint and head of household returns use brackets twice as wide. You can subtract the federal income tax you paid, up to $8,750, less $1,750 for each $5,000 of federal AGI from $125,000 ($10,000 from $250,000 on joint and head of household returns), so nothing from $145,000 ($290,000). The $263 exemption credit ($526 on a joint return) isn’t allowed above $100,000 of federal AGI ($200,000 on joint and head of household returns).',
  },
};

/** Land borders (plus DC–MD/VA). Four Corners point contacts (AZ–CO, NM–UT) are not counted. */
const NEIGHBORS: Record<StateCode, StateCode[]> = {
  AL: ['FL', 'GA', 'MS', 'TN'],
  AK: [],
  AZ: ['CA', 'NV', 'UT', 'NM'],
  AR: ['LA', 'MO', 'MS', 'OK', 'TN', 'TX'],
  CA: ['OR', 'NV', 'AZ'],
  CO: ['KS', 'NE', 'NM', 'OK', 'UT', 'WY'],
  CT: ['MA', 'NY', 'RI'],
  DE: ['MD', 'NJ', 'PA'],
  DC: ['MD', 'VA'],
  FL: ['AL', 'GA'],
  GA: ['AL', 'FL', 'NC', 'SC', 'TN'],
  HI: [],
  ID: ['MT', 'NV', 'OR', 'UT', 'WA', 'WY'],
  IL: ['IA', 'IN', 'KY', 'MO', 'WI'],
  IN: ['IL', 'KY', 'MI', 'OH'],
  IA: ['IL', 'MN', 'MO', 'NE', 'SD', 'WI'],
  KS: ['CO', 'MO', 'NE', 'OK'],
  KY: ['IL', 'IN', 'MO', 'OH', 'TN', 'VA', 'WV'],
  LA: ['AR', 'MS', 'TX'],
  ME: ['NH'],
  MD: ['DC', 'DE', 'PA', 'VA', 'WV'],
  MA: ['CT', 'NH', 'NY', 'RI', 'VT'],
  MI: ['IN', 'OH', 'WI'],
  MN: ['IA', 'ND', 'SD', 'WI'],
  MS: ['AL', 'AR', 'LA', 'TN'],
  MO: ['AR', 'IA', 'IL', 'KS', 'KY', 'NE', 'OK', 'TN'],
  MT: ['ID', 'ND', 'SD', 'WY'],
  NE: ['CO', 'IA', 'KS', 'MO', 'SD', 'WY'],
  NV: ['AZ', 'CA', 'ID', 'OR', 'UT'],
  NH: ['MA', 'ME', 'VT'],
  NJ: ['DE', 'NY', 'PA'],
  NM: ['AZ', 'CO', 'OK', 'TX'],
  NY: ['CT', 'MA', 'NJ', 'PA', 'VT'],
  NC: ['GA', 'SC', 'TN', 'VA'],
  ND: ['MN', 'MT', 'SD'],
  OH: ['IN', 'KY', 'MI', 'PA', 'WV'],
  OK: ['AR', 'CO', 'KS', 'MO', 'NM', 'TX'],
  OR: ['CA', 'ID', 'NV', 'WA'],
  PA: ['DE', 'MD', 'NJ', 'NY', 'OH', 'WV'],
  RI: ['CT', 'MA'],
  SC: ['GA', 'NC'],
  SD: ['IA', 'MN', 'MT', 'ND', 'NE', 'WY'],
  TN: ['AL', 'AR', 'GA', 'KY', 'MO', 'MS', 'NC', 'VA'],
  TX: ['AR', 'LA', 'NM', 'OK'],
  UT: ['AZ', 'CO', 'ID', 'NV', 'WY'],
  VT: ['MA', 'NH', 'NY'],
  VA: ['DC', 'KY', 'MD', 'NC', 'TN', 'WV'],
  WA: ['ID', 'OR'],
  WV: ['KY', 'MD', 'OH', 'PA', 'VA'],
  WI: ['IA', 'IL', 'MI', 'MN'],
  WY: ['CO', 'ID', 'MT', 'NE', 'SD', 'UT'],
};

const slugify = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, '-');

export const STATES: readonly StateTaxInfo[] = ROWS.map((r) => ({
  ...r,
  slug: slugify(r.name),
  sourceUrl: SOURCE_URLS[r.code],
  localTaxLabel: r.localTaxNote ? (LOCAL_TAX_LABELS[r.code] ?? 'Some cities and counties') : 'None',
  tipsOvertime: TIPS_OVERTIME_RULES[r.code],
  rateSource: RATE_SOURCES[r.code],
  brackets: BRACKETS[r.code]?.brackets,
  bracketsYear: BRACKETS[r.code]?.year,
  bracketsSource: BRACKETS[r.code]?.source,
  bracketsNote: BRACKETS[r.code]?.note,
  bracketEngine: engineRules(BRACKETS[r.code]),
  surtax: SURTAXES[r.code],
  neighbors: NEIGHBORS[r.code],
})).sort((a, b) => a.name.localeCompare(b.name));

function engineRules(schedule: BracketSchedule | undefined): BracketEngineRules | undefined {
  return schedule?.engine && { ...schedule.engine, brackets: schedule.brackets };
}

/** States calculated bracket by bracket, in name order. */
export const BRACKET_ENGINE_STATES = STATES.filter((s) => s.bracketEngine);

/** Canonical page for a state, e.g. /state-taxes/new-york/. */
export const statePagePath = (s: Pick<StateTaxInfo, 'slug'>) => `/state-taxes/${s.slug}/`;

export const STATES_BY_CODE = Object.fromEntries(STATES.map((s) => [s.code, s])) as Record<StateCode, StateTaxInfo>;

/**
 * Up to `count` states to cross-link: neighbors first (same tax structure before others),
 * then same-structure states with the closest estimated tax at the reference wage.
 */
export function relatedStates(code: StateCode, count = 4): StateTaxInfo[] {
  const s = STATES_BY_CODE[code];
  const neighbors = s.neighbors
    .map((c) => STATES_BY_CODE[c])
    .sort((a, b) => Number(b.structure === s.structure) - Number(a.structure === s.structure));
  const taxAt = (x: StateTaxInfo) => calculateStateIncomeTax(GRADUATED_REFERENCE_WAGE, x.code);
  const peers = STATES.filter((x) => x.structure === s.structure && x.code !== code && !s.neighbors.includes(x.code)).sort(
    (a, b) => Math.abs(taxAt(a) - taxAt(s)) - Math.abs(taxAt(b) - taxAt(s)) || a.name.localeCompare(b.name),
  );
  return [...neighbors, ...peers].slice(0, count);
}

/** Accepts a state code ("tx") or slug ("texas"). */
export function findState(value: string | null | undefined): StateTaxInfo | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  return STATES.find((s) => s.code.toLowerCase() === v || s.slug === v);
}

/**
 * Estimated state income tax on wages (USD). States with a `bracketEngine` run it; the rest use the
 * simplified model at the top of this file. `filingStatus` only matters once a state has brackets for it.
 */
/**
 * What the bracket engine needs besides the state income: federal AGI (for income-based reductions; defaults to the
 * state income) and the federal income tax actually paid (Oregon's subtraction; defaults to federalTaxOnWages()).
 */
export interface StateTaxOptions {
  agi?: number;
  federalTax?: number;
}

/** Federal income tax on wages with the 2026 standard deduction and brackets, before credits. */
export function federalTaxOnWages(wages: number, filingStatus: FilingStatus): number {
  return computeFederalIncomeTax(Math.max(0, wages - STANDARD_DEDUCTION_2026[filingStatus]), filingStatus);
}

function engineInput(income: number, rules: BracketEngineRules, filingStatus: FilingStatus, options: StateTaxOptions) {
  const agi = options.agi ?? income;
  const needsFederal = Boolean(rules.federalTaxSubtraction || rules.federalTaxSubtractionByStatus);
  const federalTax = needsFederal ? (options.federalTax ?? federalTaxOnWages(agi, filingStatus)) : undefined;
  return { income, filingStatus, agi, federalTax };
}

export function calculateStateIncomeTax(
  taxableIncome: number,
  stateCode: StateCode,
  filingStatus: FilingStatus = 'single',
  options: StateTaxOptions = {},
): number {
  const s = STATES_BY_CODE[stateCode];
  if (s.bracketEngine) return computeBracketTax(s.bracketEngine, engineInput(taxableIncome, s.bracketEngine, filingStatus, options)).tax;
  const base = Math.max(0, taxableIncome - s.exemptAmount);
  return base * s.estimateRate + (s.surtax ? Math.max(0, base - s.surtax.over) * s.surtax.rate : 0);
}

/** Step-by-step bracket calculation for states that use the engine; undefined for the rest. */
export function stateTaxBreakdown(
  income: number,
  stateCode: StateCode,
  filingStatus: FilingStatus = 'single',
  options: StateTaxOptions = {},
): BracketEngineResult | undefined {
  const rules = STATES_BY_CODE[stateCode].bracketEngine;
  return rules && computeBracketTax(rules, engineInput(income, rules, filingStatus, options));
}

const pct = (r: number) => `${+(r * 100).toFixed(2)}%`;

/** "No state income tax" · "3.99% flat tax" · "1%–13.3% progressive" (sentence case, docs/DESIGN.md §3). */
export function formatStateRate(s: StateTaxInfo): string {
  if (s.structure === 'none') return 'No state income tax';
  if (s.structure === 'flat') return `${pct(s.estimateRate)} flat tax`;
  const [lo, hi] = s.bracketRange!;
  return `${pct(lo)}–${pct(hi)} progressive`;
}

export const STRUCTURE_LABELS: Record<TaxStructure, string> = {
  none: 'No income tax',
  flat: 'Flat rate',
  graduated: 'Progressive brackets',
};

/** What the calculator, breakdown chart and exports need about the chosen state. */
export interface StateTaxEstimate {
  code: StateCode;
  name: string;
  structure: TaxStructure;
  rateLabel: string;
  tax: number;
  /** Tips and overtime subtracted before the estimate (state-tips-overtime-subtraction.ts); 0 if none. */
  stateDeduction: number;
  /** True when the tax comes from the state's brackets (bracket engine), not the simplified estimate. */
  usesBrackets: boolean;
  /** stateTaxMethod(): how the tax was worked out, e.g. "brackets for your filing status". */
  method: string;
  /** SINGLE_RATES_WARNING when the filing status isn't single and the state has no rates of its own for it. */
  singleRatesWarning?: string;
  /** DEPENDENTS_NOTE for filing statuses other than single (dependentsNote()). */
  dependentsNote?: string;
}

/**
 * `stateDeduction`: the state's tips and overtime subtraction, taken off income before the estimate. `income` is also the
 * federal AGI for income-based reductions. `federalTax`: federal income tax actually paid (after the Schedule 1-A
 * deduction in the tips calculator), for Oregon's subtraction; defaults to federalTaxOnWages(income).
 */
export function estimateStateTax(
  income: number,
  stateCode: StateCode,
  stateDeduction = 0,
  filingStatus: FilingStatus = 'single',
  federalTax?: number,
): StateTaxEstimate {
  const s = STATES_BY_CODE[stateCode];
  const deduction = s.structure === 'none' ? 0 : Math.max(0, Math.min(stateDeduction, income));
  return {
    code: s.code,
    name: s.name,
    structure: s.structure,
    rateLabel: formatStateRate(s),
    tax: calculateStateIncomeTax(income - deduction, stateCode, filingStatus, { agi: income, federalTax }),
    stateDeduction: deduction,
    usesBrackets: Boolean(s.bracketEngine),
    method: stateTaxMethod(stateCode, filingStatus),
    singleRatesWarning: singleRatesWarning(stateCode, filingStatus),
    dependentsNote: dependentsNote(stateCode, filingStatus),
  };
}

/**
 * How a state's tax was worked out, for the calculators' detail lines: "brackets for your filing status" in the
 * bracket-engine states that have rules for it, else single-filer brackets or the simplified single-filer estimate.
 */
export function stateTaxMethod(stateCode: StateCode, filingStatus: FilingStatus): string {
  if (!STATES_BY_CODE[stateCode].bracketEngine) return 'simplified single-filer estimate';
  return singleRatesWarning(stateCode, filingStatus) ? 'single-filer brackets' : 'brackets for your filing status';
}

/** Assumption shown next to the state tax for joint and head of household filers, who often have dependents. */
export const DEPENDENTS_NOTE = 'Doesn’t include dependent credits or exemptions.';

/** DEPENDENTS_NOTE when the state taxes wages and the filing status isn't single. */
export function dependentsNote(stateCode: StateCode | null, filingStatus: FilingStatus): string | undefined {
  if (!stateCode || filingStatus === 'single' || STATES_BY_CODE[stateCode].structure === 'none') return undefined;
  return DEPENDENTS_NOTE;
}

/** Shown next to the state tax result whenever the filing status isn't single (see singleRatesWarning). */
export const SINGLE_RATES_WARNING = 'State tax uses single-filer rates for now, so it may be too high for married couples.';

/**
 * SINGLE_RATES_WARNING when a state that taxes wages has no brackets of its own for `filingStatus`: every
 * state on the simplified estimate, and married filing separately in the bracket-engine states.
 */
export function singleRatesWarning(stateCode: StateCode | null, filingStatus: FilingStatus): string | undefined {
  if (!stateCode || filingStatus === 'single') return undefined;
  const s = STATES_BY_CODE[stateCode];
  if (s.structure === 'none' || s.bracketEngine?.bracketsByStatus?.[filingStatus]) return undefined;
  return SINGLE_RATES_WARNING;
}
