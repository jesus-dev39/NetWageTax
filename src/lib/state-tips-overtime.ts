/**
 * state-tips-overtime.ts
 * How each state (50 + DC) treats the federal deduction for qualified tips and overtime
 * (Schedule 1-A, IRC §224 and §225) for tax year 2026, with the official sources it was checked
 * against. Read by the guide /guides/which-states-tax-tips-and-overtime/, the state pages, and
 * the tips and overtime calculator (state row and exports).
 *
 * Every treatment except 'unconfirmed' needs at least one official source. `inferred` marks the
 * states with no explicit official statement: they start from federal AGI (the deduction comes
 * after AGI) and no state deduction was enacted in 2026. Full review every January
 * (docs/PENDING-UPDATES.md).
 */
import type { StateCode } from './state-tax-data';

export type TipsOvertimeTreatment = 'no-wage-tax' | 'follows' | 'tips-only' | 'own' | 'does-not-follow' | 'unconfirmed';

export interface TipsOvertimeSource {
  label: string;
  url: string;
  /** Date of the document as shown on the page ("June 23, 2026", "Tax year 2025"); omitted when undated. */
  date?: string;
}

export interface TipsOvertimeRule {
  treatment: TipsOvertimeTreatment;
  /** What the state does, in one or two sentences. Shown in the guide's table and on the state page. */
  detail: string;
  /** No explicit official statement: shows INFERRED_NOTE next to the sources. */
  inferred?: boolean;
  sources: TipsOvertimeSource[];
  /** Date we last checked the rule (YYYY-MM-DD). */
  checked: string;
  /** 'own' states: the state's own yearly caps (for the calculator). */
  own?: { tipsCap?: number; overtimeCap?: number };
}

export const TREATMENT_LABEL: Record<TipsOvertimeTreatment, string> = {
  'no-wage-tax': 'No tax on wages',
  follows: 'Follows',
  'tips-only': 'Follows for tips only',
  own: 'Own state break',
  'does-not-follow': 'Does not follow',
  unconfirmed: 'Not yet confirmed',
};

/** Order for the guide's legend, table filter, and counts. */
export const TREATMENT_ORDER: TipsOvertimeTreatment[] = [
  'no-wage-tax',
  'follows',
  'tips-only',
  'own',
  'does-not-follow',
  'unconfirmed',
];

export const INFERRED_NOTE = 'Starts from federal AGI and no state deduction was enacted in 2026.';

export const TIPS_OVERTIME_GUIDE_PATH = '/guides/which-states-tax-tips-and-overtime/';

const C1004 = '2026-10-04';
const C1008 = '2026-10-08';

export const TIPS_OVERTIME_RULES: Record<StateCode, TipsOvertimeRule> = {
  AL: {
    treatment: 'own',
    detail:
      'Act 2026-604 lets you deduct the premium part of qualified overtime, up to $1,000 per taxpayer, for 2026 through 2028. Tips stay taxable.',
    own: { overtimeCap: 1_000 },
    sources: [
      { label: 'Alabama Department of Revenue: Overtime Premium Deduction, Act 2026-604', url: 'https://www.revenue.alabama.gov/individual-corporate/overtime-premium-deduction-act-2026-604/' },
      { label: 'HB 527 (2026), enrolled (PDF)', url: 'https://alison.legislature.state.al.us/files/pdf/SearchableInstruments/2026RS/HB527-enr.pdf' },
    ],
    checked: C1008,
  },
  AK: {
    treatment: 'no-wage-tax',
    detail: 'Alaska has no individual income tax.',
    sources: [{ label: 'Alaska Tax Facts', url: 'https://www.commerce.alaska.gov/web/dcra/officeofthestateassessor/alaskataxfacts.aspx' }],
    checked: C1004,
  },
  AZ: {
    treatment: 'follows',
    detail:
      'HB 4168 (2026) adds a state subtraction for qualified tips and the premium part of qualified overtime, matching the amounts you deduct on your federal return.',
    sources: [
      { label: 'Arizona Legislature: HB 4168 (2026) summary', url: 'https://www.azleg.gov/legtext/57leg/2R/summary/H.HB4168_061026_CAUCUSCOW.DOCX.htm', date: 'June 10, 2026' },
    ],
    checked: C1004,
  },
  AR: {
    treatment: 'does-not-follow',
    inferred: true,
    detail: 'Arkansas taxes wages, salaries, and tips with no subtraction for either deduction. HB 1822 (overtime) died in committee.',
    sources: [
      { label: 'Arkansas DFA: 2025 AR1000F and AR1000NR instructions (PDF)', url: 'https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000F_and_AR1000NR_Instructions.pdf', date: 'Tax year 2025' },
      { label: 'Arkansas Legislature: HB 1822', url: 'https://www.arkleg.state.ar.us/Bills/Detail?id=HB1822&ddBienniumSession=2025%2F2025R', date: 'May 5, 2025' },
    ],
    checked: C1004,
  },
  CA: {
    treatment: 'does-not-follow',
    detail:
      'California law has no deduction for qualified tips or overtime. AB 1550 (2026), which would have adopted both, didn’t pass.',
    sources: [
      { label: 'Franchise Tax Board: analysis of AB 1550 (PDF)', url: 'https://www.ftb.ca.gov/tax-pros/law/legislation/2025-2026/AB1550-010726.pdf', date: 'January 7, 2026' },
    ],
    checked: C1008,
  },
  CO: {
    treatment: 'tips-only',
    detail:
      'Colorado starts from federal taxable income, so the tips deduction carries over. The overtime deduction is added back from 2026 (HB25-1296). SB26-056, which would have limited that add-back to 2026, didn’t pass.',
    sources: [
      { label: 'Colorado Department of Revenue: Individual Income Tax Guide', url: 'https://tax.colorado.gov/individual-income-tax-guide', date: '2026' },
      { label: 'Colorado General Assembly: SB26-056', url: 'https://leg.colorado.gov/bills/SB26-056', date: '2026' },
    ],
    checked: C1004,
  },
  CT: {
    treatment: 'does-not-follow',
    inferred: true,
    detail: 'An amendment to SB 83 that would have adopted both deductions was rejected on February 4, 2026. Other bills didn’t leave committee.',
    sources: [
      { label: 'Connecticut General Assembly: SB 83 (2026) bill status', url: 'https://www.cga.ct.gov/asp/cgabillstatus/cgabillstatus.asp?selBillType=Bill&which_year=2026&bill_num=83', date: 'February 2026' },
      { label: 'Fiscal note on the SB 83 amendment (PDF)', url: 'https://cga.ct.gov/2026/fna/pdf/2026SB-00083-R00LCO00676-FNA.PDF', date: 'February 2026' },
    ],
    checked: C1004,
  },
  DE: {
    treatment: 'does-not-follow',
    detail: 'Delaware starts from federal AGI, and the Division of Revenue says the federal tips and overtime deductions “will not flow through.”',
    sources: [{ label: 'Delaware Division of Revenue: tax season updates', url: 'https://revenue.delaware.gov/tax-season-updates/', date: '2026 filing season' }],
    checked: C1004,
  },
  DC: {
    treatment: 'unconfirmed',
    detail: 'Congress overturned D.C.’s 2026 law that disallowed these deductions. We’re waiting for D.C.’s 2026 guidance.',
    sources: [
      { label: 'D.C. Law 26-89', url: 'https://code.dccouncil.gov/us/dc/council/laws/26-89', date: 'February 12, 2026' },
      { label: 'Public Law 119-78, disapproving D.C. Law 26-89 (PDF)', url: 'https://www.govinfo.gov/content/pkg/PLAW-119publ78/pdf/PLAW-119publ78.pdf', date: 'February 18, 2026' },
    ],
    checked: C1008,
  },
  FL: {
    treatment: 'no-wage-tax',
    detail: 'Florida has no personal income tax.',
    sources: [{ label: 'Florida Department of Revenue FAQ', url: 'https://floridarevenue.com/faq/pages/faqsearch.aspx?keywords=personal+income+tax&cat=4&subcat=0' }],
    checked: C1004,
  },
  GA: {
    treatment: 'own',
    detail:
      'HB 463 (2026) excludes up to $1,750 of qualified overtime for full-time hourly employees and up to $1,750 of tips, cash or charged, in a tipped occupation, for 2026 through 2028.',
    own: { tipsCap: 1_750, overtimeCap: 1_750 },
    sources: [{ label: 'HB 463 (2026), as passed (PDF)', url: 'https://gov.georgia.gov/document/2026-signed-legislation/hb-463/download' }],
    checked: C1008,
  },
  HI: {
    treatment: 'tips-only',
    detail: 'Act 35 (2026) adopts the federal tips deduction (§224) but not the overtime deduction (§225), from tax year 2026.',
    sources: [{ label: 'Hawaii Department of Taxation: Announcement 2026-06 (PDF)', url: 'https://files.hawaii.gov/tax/news/announce/ann26-06.pdf', date: 'July 31, 2026' }],
    checked: C1004,
  },
  ID: {
    treatment: 'follows',
    detail: 'HB 559 (2026) conforms Idaho to the Internal Revenue Code as of January 1, 2026, including both deductions.',
    sources: [
      { label: 'Idaho State Tax Commission: guidance on conformity deductions', url: 'https://tax.idaho.gov/pressrelease/more-guidance-on-conformity-deductions-and-filing-2025-idaho-income-taxes/', date: 'February 20, 2026' },
      { label: 'Idaho Legislature: HB 559 (2026) (PDF)', url: 'https://legislature.idaho.gov/wp-content/uploads/sessioninfo/2026/legislation/H0559.pdf', date: 'February 10, 2026' },
    ],
    checked: C1004,
  },
  IL: {
    treatment: 'does-not-follow',
    inferred: true,
    detail: 'HB 1750 (tips and overtime) has been in the Rules Committee since January 2025, and the 2026 tax changes don’t mention either deduction.',
    sources: [{ label: 'Illinois Department of Revenue: Bulletin FY 2027-01', url: 'https://tax.illinois.gov/research/publications/bulletins/fy-2027-01.html', date: 'July 2026' }],
    checked: C1004,
  },
  IN: {
    treatment: 'follows',
    detail: 'SB 243 (2026) allows state deductions equal to the federal ones, for tax year 2026 only.',
    sources: [{ label: 'Indiana Department of Revenue: deductions', url: 'https://www.in.gov/dor/i-am-a/individual/deductions/', date: '2026' }],
    checked: C1004,
  },
  IA: {
    treatment: 'follows',
    detail: 'Iowa starts from federal taxable income and conforms automatically: “Iowa will conform with … no tax on tips, no tax on overtime.”',
    sources: [{ label: 'Iowa Department of Revenue: impact of the One Big Beautiful Bill Act', url: 'https://revenue.iowa.gov/taxes/tax-guidance/withholding-tax/impact-one-big-beautiful-bill-act-employee-withholding' }],
    checked: C1004,
  },
  KS: {
    treatment: 'does-not-follow',
    inferred: true,
    detail: 'SB 311 (overtime) and SB 277 (tips) died in the 2026 session.',
    sources: [
      { label: 'Kansas Legislature: SB 311', url: 'https://kslegislature.gov/li/b2025_26/measures/sb311/', date: '2026 session' },
      { label: 'Kansas Legislature: SB 277', url: 'https://kslegislature.gov/li/b2025_26/measures/sb277/', date: '2026 session' },
    ],
    checked: C1004,
  },
  KY: {
    treatment: 'does-not-follow',
    detail: 'HB 757 (2026) updates Kentucky’s conformity to December 31, 2025, but excludes the tips and overtime deductions.',
    sources: [{ label: 'Kentucky DOR: TY2026 e-file handbook, Publication 1345 (PDF)', url: 'https://revenue.ky.gov/Software-Developer/Documents/TY2026%20E-File%20HandBook%20Publication%201345%20v1.0.pdf', date: 'July 20, 2026' }],
    checked: C1004,
  },
  LA: {
    treatment: 'does-not-follow',
    inferred: true,
    detail: 'Tips and overtime bills from 2025 (HB 194, 195, 414) and 2026 (HB 209, 253, 411, 898) stayed in committee.',
    sources: [{ label: 'Louisiana Legislature: HB 253 (2026)', url: 'https://legis.la.gov/Legis/BillInfo.aspx?s=26RS&b=HB253&sbi=y', date: '2026 session' }],
    checked: C1004,
  },
  ME: {
    treatment: 'does-not-follow',
    detail: 'The deductions come after AGI and, without a state law, “have no effect on Maine tax law.” The 2026 legislation adds none.',
    sources: [
      { label: 'Maine Revenue Services: Tax Alert, October 2025 (PDF)', url: 'https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/ta_october2025_vol35_iss14_0.pdf', date: 'October 2025' },
      { label: 'Maine Revenue Services: 2026 legislative changes (PDF)', url: 'https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/legischange26.pdf', date: 'July 2026' },
    ],
    checked: C1004,
  },
  MD: {
    treatment: 'does-not-follow',
    detail: 'The federal deduction “does not flow through to the Maryland income tax return.” HB 201 (tips) and HB 1035 (overtime) didn’t pass in 2026.',
    sources: [{ label: 'Maryland Department of Legislative Services: HB 201 fiscal note (PDF)', url: 'https://mgaleg.maryland.gov/2026RS/fnotes/bil_0001/hb0201.pdf', date: '2026 session' }],
    checked: C1004,
  },
  MA: {
    treatment: 'does-not-follow',
    detail: 'Massachusetts doesn’t adopt the federal tips deduction (Sec. 70201) or the overtime deduction (Sec. 70202).',
    sources: [
      { label: 'Massachusetts DOR: TIR 26-4', url: 'https://www.mass.gov/technical-information-release/tir-26-4-massachusetts-conformity-to-certain-provisions-in-public-law-no-119-21', date: 'June 23, 2026' },
    ],
    checked: C1004,
  },
  MI: {
    treatment: 'follows',
    detail:
      'Michigan has its own deductions for 2026 through 2028 that match the amounts you deduct on your federal return. Nonresidents can deduct only tips and overtime earned for work in Michigan.',
    sources: [
      { label: 'Michigan Treasury: notice on the new deductions for qualified overtime and tips', url: 'https://www.michigan.gov/treasury/reference/taxpayer-notices/notice-regarding-new-deductions-for-qualified-overtime-compensation-and-qualified-tips', date: '2026' },
    ],
    checked: C1004,
  },
  MN: {
    treatment: 'does-not-follow',
    detail: 'Tips and overtime are “taxable to Minnesota,” with no state adjustment. The 2026 tax law doesn’t add one.',
    sources: [
      { label: 'Minnesota DOR: 2026 tax pro webinar Q&A (PDF)', url: 'https://www.revenue.state.mn.us/sites/default/files/2026-02/2026-annual-tax-pro-webinar-qa-final.pdf', date: 'February 2026' },
      { label: 'Minnesota DOR: 2026 enacted tax law summary (PDF)', url: 'https://www.revenue.state.mn.us/sites/default/files/2026-05/hf2438sf2082-enacted-otb.pdf', date: 'May 26, 2026' },
    ],
    checked: C1004,
  },
  MS: {
    treatment: 'does-not-follow',
    detail: '“Tips and gratuity are considered taxable income to Mississippi,” and no 2026 law changed that.',
    sources: [{ label: 'Mississippi DOR: individual income tax FAQ', url: 'https://www.dor.ms.gov/individual/individual-income-tax-frequently-asked-questions' }],
    checked: C1004,
  },
  MO: {
    treatment: 'does-not-follow',
    detail: 'The deductions “cannot be claimed on the Missouri individual income tax return.” SB 1241 (tips) stayed in committee in 2026.',
    sources: [{ label: 'Missouri DOR: income tax year changes', url: 'https://dor.mo.gov/taxation/individual/tax-types/income/year-changes/', date: 'Tax year 2025' }],
    checked: C1004,
  },
  MT: {
    treatment: 'follows',
    detail: 'Montana starts from federal taxable income, so the Schedule 1-A deductions “are included in the calculation of Montana taxable income.”',
    sources: [
      { label: 'Montana DOR: 2025 Form 2 instructions (PDF)', url: 'https://revenue.mt.gov/files/forms/Montana-Individual-Income-Tax-Return-Form-2-Instructions/2025_Montana_Individual_Income_Tax_Return_Form_2_Instructions.pdf', date: 'Tax year 2025' },
    ],
    checked: C1004,
  },
  NE: {
    treatment: 'does-not-follow',
    detail: 'The deductions come after federal AGI and have “no automatic impact” in Nebraska. LB 932 (tips and overtime) was indefinitely postponed on April 17, 2026.',
    sources: [
      { label: 'Nebraska DOR: report on the federal law changes (PDF)', url: 'https://nebraskalegislature.gov/FloorDocs/109/PDF/Agencies/Revenue__Department_of/883_20250902-103816.pdf', date: 'September 2, 2025' },
    ],
    checked: C1004,
  },
  NV: {
    treatment: 'no-wage-tax',
    detail: 'Nevada has no personal income tax.',
    sources: [{ label: 'Nevada Department of Taxation: income tax in Nevada', url: 'https://tax.nv.gov/about-nevada-department-of-taxation/income-tax-in-nevada/' }],
    checked: C1004,
  },
  NH: {
    treatment: 'no-wage-tax',
    detail: 'New Hampshire doesn’t tax wages, and its tax on interest and dividends was repealed in 2025.',
    sources: [
      { label: 'New Hampshire DRA: 2026 tax tips and filing guidance', url: 'https://www.revenue.nh.gov/news-and-media/nh-department-revenue-administration-shares-2026-tax-tips-and-filing-guidance', date: '2026' },
    ],
    checked: C1004,
  },
  NJ: {
    treatment: 'does-not-follow',
    detail: 'New Jersey’s income tax doesn’t start from federal AGI, and the federal tips and overtime deductions don’t affect the New Jersey return for 2025 through 2028.',
    sources: [{ label: 'New Jersey Division of Taxation: the federal One Big Beautiful Bill Act', url: 'https://www.nj.gov/treasury/taxation/individuals/obbba.shtml', date: 'December 1, 2025' }],
    checked: C1004,
  },
  NM: {
    treatment: 'does-not-follow',
    detail: 'The state’s analysis of HB 264 says New Mexico doesn’t conform, and the 2026 tax package (SB 151) adds neither deduction.',
    sources: [
      { label: 'New Mexico Legislature: agency analysis of HB 264 (PDF)', url: 'https://www.nmlegis.gov/Sessions/26%20Regular/AgencyAnalysis/HB0264_333.pdf', date: 'February 13, 2026' },
      { label: 'Office of the Governor: tax package signed', url: 'https://www.governor.state.nm.us/2026/03/11/governor-signs-state-budget-capital-outlay-bills-and-tax-package/', date: 'March 11, 2026' },
    ],
    checked: C1004,
  },
  NY: {
    treatment: 'tips-only',
    detail: 'The FY 2027 budget exempts up to $25,000 of tips from state income tax from 2026, consistent with the federal deduction. Overtime stays taxable.',
    sources: [{ label: 'New York Division of the Budget: FY 2027 enacted budget', url: 'https://www.budget.ny.gov/pubs/press/2026/fy27-enacted-signed.html', date: 'May 28, 2026' }],
    checked: C1004,
  },
  NC: {
    treatment: 'does-not-follow',
    detail: 'The deductions “do not affect North Carolina taxable income.” The July 2026 laws (S.L. 2026-31 and 2026-41) don’t add them.',
    sources: [
      {
        label: 'NCDOR: questions and answers on the impact of federal law',
        url: 'https://www.ncdor.gov/taxes-forms/information-tax-professionals/tax-bulletins-directives-and-other-important-notices/important-notices-and-frequently-asked-questions-personal-taxes/questions-and-answers-about-impact-federal-law-nc-individual-and-corporate-income-tax-returns',
      },
      {
        label: 'NCDOR: impact of recently enacted laws',
        url: 'https://www.ncdor.gov/taxes-forms/information-tax-professionals/tax-bulletins-directives-and-other-important-notices/important-notices-and-frequently-asked-questions-personal-taxes/important-notice-impact-recently-enacted-laws-north-carolina-individual-and-corporate-income',
        date: 'July 2026',
      },
    ],
    checked: C1004,
  },
  ND: {
    treatment: 'follows',
    detail: 'North Dakota starts from federal taxable income and conforms “for all years,” including the tip income and overtime pay exclusions.',
    sources: [
      { label: 'North Dakota Tax: 2025 individual income tax booklet (PDF)', url: 'https://www.tax.nd.gov/sites/www/files/documents/forms/individual/2025-iit/2025-individual-income-tax-booklet.pdf', date: 'Tax year 2025' },
    ],
    checked: C1004,
  },
  OH: {
    treatment: 'does-not-follow',
    inferred: true,
    detail: 'The Ohio return starts from federal AGI. HB 39 (overtime) is still pending.',
    sources: [
      { label: 'Ohio Department of Taxation: 2025 IT 1040 instructions (PDF)', url: 'https://tax.ohio.gov/static/forms/ohio_individual/individual/2025/it1040-booklet.pdf', date: 'Tax year 2025' },
    ],
    checked: C1008,
  },
  OK: {
    treatment: 'does-not-follow',
    inferred: true,
    detail: 'Form 511 starts from federal AGI, and Schedule 511-A has no subtraction for tips or overtime. The 2026 tax law only changes the brackets.',
    sources: [
      { label: 'Oklahoma Tax Commission: Form 511 packet (PDF)', url: 'https://oklahoma.gov/content/dam/ok/en/tax/documents/forms/individuals/current/511-Pkt.pdf', date: 'Tax year 2025' },
    ],
    checked: C1004,
  },
  OR: {
    treatment: 'follows',
    detail:
      'Oregon allows the same tips and overtime deductions you claim on your federal return; nonresidents have limits. SB 1507 (2026) disconnects from the car loan interest deduction, not from these.',
    sources: [
      { label: 'Oregon DOR: Publication OR-17 (PDF)', url: 'https://www.oregon.gov/dor/forms/FormsPubs/publication-or-17_101-431_2025.pdf', date: 'January 29, 2026' },
      { label: 'Oregon DOR: 2026 summary of legislation', url: 'https://www.oregon.gov/dor/pages/2026-summary-of-legislation.aspx', date: '2026' },
    ],
    checked: C1004,
  },
  PA: {
    treatment: 'does-not-follow',
    detail: 'Tips are taxable compensation in Pennsylvania, and federal deductions aren’t allowed in Pennsylvania taxable income.',
    sources: [{ label: 'Pennsylvania DOR: PA Personal Income Tax Guide, gross compensation', url: 'https://www.pa.gov/agencies/revenue/forms-and-publications/pa-personal-income-tax-guide/gross-compensation' }],
    checked: C1004,
  },
  RI: {
    treatment: 'does-not-follow',
    detail: 'The deductions come after AGI, so the Division of Taxation lists them as having no Rhode Island impact.',
    sources: [
      { label: 'Rhode Island Division of Taxation: RIBBA analysis (PDF)', url: 'https://tax.ri.gov/sites/g/files/xkgbur541/files/2026-03/RIBBA%20030526.pdf', date: 'March 2026' },
      { label: 'Rhode Island Division of Taxation: H.R. 1 (Public Law 119-21) guidance', url: 'https://tax.ri.gov/guidance/hr-1-public-laws-no-119-21', date: 'March 2026' },
    ],
    checked: C1008,
  },
  SC: {
    treatment: 'does-not-follow',
    detail:
      'The Department of Revenue says to adjust the South Carolina return for tips and overtime, and H.4216 (Act 110 of 2026) doesn’t adopt IRC §63(b)–(g). H.3368 (overtime) stalled in the Senate.',
    sources: [
      { label: 'SCDOR: Internal Revenue Code conformity update', url: 'https://dor.sc.gov/income-tax-south-carolina-internal-revenue-code-conformity-update', date: 'January 30, 2026' },
      { label: 'South Carolina Legislature: H.4216', url: 'https://www.scstatehouse.gov/sess126_2025-2026/bills/4216.htm', date: '2026' },
    ],
    checked: C1004,
  },
  SD: {
    treatment: 'no-wage-tax',
    detail: 'South Dakota has no personal income tax.',
    sources: [{ label: 'South Dakota DOR: taxes for individuals', url: 'https://dor.sd.gov/individuals/taxes/' }],
    checked: C1004,
  },
  TN: {
    treatment: 'no-wage-tax',
    detail: 'Tennessee doesn’t tax wages; the Hall income tax on investment income was repealed in 2021.',
    sources: [
      { label: 'Tennessee DOR: HIT-3, Hall income tax repealed', url: 'https://revenue.support.tn.gov/hc/en-us/articles/360057828631-HIT-3-Hall-Income-Tax-Repealed-Beginning-January-1-2021' },
    ],
    checked: C1004,
  },
  TX: {
    treatment: 'no-wage-tax',
    detail: 'Texas has no personal income tax.',
    sources: [{ label: 'Texas Comptroller: small business information', url: 'https://comptroller.texas.gov/economy/fiscal-notes/industry/2025/small-biz-info/', date: '2025' }],
    checked: C1004,
  },
  UT: {
    treatment: 'does-not-follow',
    inferred: true,
    detail: 'Utah’s list of subtractions from income (§59-10-114) has none for tips or overtime, and HB 587 (2026) didn’t pass.',
    sources: [
      { label: 'Utah Code §59-10-114 (PDF)', url: 'https://le.utah.gov/xcode/Title59/Chapter10/C59-10-S114_2025101420251206.pdf', date: 'October 14, 2025' },
    ],
    checked: C1008,
  },
  VT: {
    treatment: 'does-not-follow',
    detail: 'The deductions come out of federal taxable income and, according to the Joint Fiscal Office, don’t flow through to Vermont.',
    sources: [
      {
        label: 'Vermont Joint Fiscal Office: federal tax changes and impacts (PDF)',
        url: 'https://legislature.vermont.gov/Documents/2026/Workgroups/House%20Ways%20and%20Means/2026%20Federal%20Tax%20Impacts/W~Kirby%20Keeton~Federal%20Tax%20Changes%20and%20Impacts~1-6-2026.pdf',
        date: 'January 6, 2026',
      },
    ],
    checked: C1004,
  },
  VA: {
    treatment: 'does-not-follow',
    detail: 'Virginia’s 2026 conformity covers only changes to federal AGI and itemized deductions, and the 2026 legislation adds neither deduction.',
    sources: [
      { label: 'Virginia Tax: Tax Bulletin 26-1 (PDF)', url: 'https://www.tax.virginia.gov/sites/default/files/inline-files/tb-26-1-date-of-irc-conformity-advanced.pdf', date: 'February 20, 2026' },
      { label: 'Virginia Tax: 2026 legislative summary (PDF)', url: 'https://www.tax.virginia.gov/sites/default/files/inline-files/2026-legislative-summary.pdf', date: 'July 6, 2026' },
    ],
    checked: C1004,
  },
  WA: {
    treatment: 'no-wage-tax',
    detail: 'Washington doesn’t tax wages; it taxes only certain capital gains.',
    sources: [{ label: 'Washington DOR: capital gains excise tax', url: 'https://dor.wa.gov/about/news-releases/2023/capital-gains-excise-tax-ruled-constitutional' }],
    checked: C1004,
  },
  WV: {
    treatment: 'does-not-follow',
    inferred: true,
    detail: 'SB 460 (tips and overtime) and HB 4347 stayed in committee in the 2026 session.',
    sources: [
      { label: 'West Virginia Legislature: SB 460 (2026)', url: 'https://www.wvlegislature.gov/Bill_Status/Bills_history.cfm?input=460&year=2026&sessiontype=RS&btype=bill', date: 'January 2026' },
    ],
    checked: C1004,
  },
  WI: {
    treatment: 'does-not-follow',
    inferred: true,
    detail: 'The governor vetoed AB 38 (tips) and AB 461 (overtime). The May 2026 special session that proposed a deduction ended without a law.',
    sources: [{ label: 'Office of the Governor: Executive Order 292 (PDF)', url: 'https://evers.wi.gov/Documents/EO/EO292-SpecialSession_unsigned.pdf', date: 'May 2026' }],
    checked: C1004,
  },
  WY: {
    treatment: 'no-wage-tax',
    detail: 'Wyoming has no personal income tax.',
    sources: [{ label: 'Wyoming Secretary of State FAQ', url: 'https://sos.wyo.gov/faqs.aspx?root=BUS' }],
    checked: C1004,
  },
};

/** Most recent `checked` date across all states (YYYY-MM-DD), for the guide's "last checked" line. */
export const TIPS_OVERTIME_LAST_CHECKED = Object.values(TIPS_OVERTIME_RULES)
  .map((r) => r.checked)
  .sort()
  .at(-1)!;
