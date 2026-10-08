import { describe, it, expect } from 'vitest';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { read, utils } from 'xlsx';
import { calculateCarLoanInterestDeduction } from './car-loan-interest';
import { agedAdditionalStandardDeduction, compareFederalTax, isCoveredByStandardDeduction } from './marginal-rate';
import type { FilingStatus } from './obbba-params';
import { buildSchedule1aDocument } from './schedule-1a-docx';
import { buildCarLoanSummary, buildSeniorSummary, CAR_LOAN_REQUIREMENTS, worksheetValue, type Schedule1aSummary } from './schedule-1a-summary';
import { schedule1aWorkbookBytes } from './schedule-1a-xlsx';
import { calculateSeniorDeduction } from './senior-deduction';
import { SCHEDULE_1A_DRAFT_NOTICE } from './site';
import { FMT_USD } from './xlsx-sheet';

const at = new Date('2026-10-08T12:00:00');

/** Same inputs and federal comparison as SeniorDeductionApp. */
function senior(filingStatus: FilingStatus, magi: number, taxpayerIs65: boolean, spouseIs65 = false) {
  const result = calculateSeniorDeduction({ filingStatus, magi, taxYear: 2026, taxpayerIs65, spouseIs65 });
  const people65 = Number(taxpayerIs65) + Number(filingStatus === 'mfj' && spouseIs65);
  const extra = agedAdditionalStandardDeduction(filingStatus, people65);
  return buildSeniorSummary(
    {
      result,
      federal: compareFederalTax(magi, result.deductionFinal, filingStatus, extra),
      coveredByStandardDeduction: isCoveredByStandardDeduction(magi, filingStatus, extra),
      taxpayerIs65,
      spouseIs65: filingStatus === 'mfj' && spouseIs65,
    },
    at,
  );
}

/** Same inputs and federal comparison as CarLoanInterestApp. */
function carLoan(filingStatus: FilingStatus, magi: number, interestPaid: number, isNewVehicle = true, isUsAssembled = true) {
  const result = calculateCarLoanInterestDeduction({ filingStatus, magi, taxYear: 2026, interestPaid, isNewVehicle, isUsAssembled });
  return buildCarLoanSummary(
    { result, federal: compareFederalTax(magi, result.deductionFinal, filingStatus), coveredByStandardDeduction: isCoveredByStandardDeduction(magi, filingStatus) },
    at,
  );
}

const shown = (s: Schedule1aSummary) => s.rows.map((r) => [r.label, ...r.values.map(worksheetValue)]);

async function docxText(s: Schedule1aSummary): Promise<string> {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(buildSchedule1aDocument(s)));
  const xml = await zip.file('word/document.xml')!.async('string');
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
}

function sheetRows(s: Schedule1aSummary) {
  const wb = read(schedule1aWorkbookBytes(s), { cellNF: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return { ws, rows: utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, blankrows: true, defval: null }) };
}

describe('senior deduction worksheet', () => {
  it('reference case: married filing jointly, both 65, $200,000 → $6,000 deduction, $1,320 saved', () => {
    const s = senior('mfj', 200_000, true, true);
    expect(s.deduction).toBe(6_000);
    expect(s.savings).toBe(1_320);
    expect(s.columns).toEqual(['Person', 'Base amount', 'Phase-out reduction', 'Deduction']);
    expect(shown(s)).toEqual([
      ['You', '$6,000', '−$3,000', '$3,000'],
      ['Your spouse', '$6,000', '−$3,000', '$3,000'],
      ['Senior deduction', '$12,000', '−$6,000', '$6,000'],
    ]);
    expect(s.tableNote).toBe(
      'Phase-out: 6% of MAGI over $150,000 ($50,000) is $3,000, taken from each qualifying person’s $6,000, down to $0.',
    );
    expect(s.zeroReason).toBeUndefined();
    expect(s.referenceId).toMatch(/^NWT-2026-[0-9A-Z]{6}$/);
    expect(s.fileBase).toBe('NetWageTax_2026_Senior_Deduction');
  });

  it('lists the Social Security, draft form, and estimate notices', () => {
    const { notices } = senior('single', 60_000, true);
    expect(notices.some((n) => n.includes('doesn’t eliminate the tax on Social Security benefits'))).toBe(true);
    expect(notices).toContain(SCHEDULE_1A_DRAFT_NOTICE);
    expect(notices.some((n) => n.startsWith('This is an estimate'))).toBe(true);
  });

  it('gives one row per spouse on a joint return, with $0 for a spouse who isn’t 65', () => {
    const s = senior('mfj', 100_000, true, false);
    expect(shown(s)[1]).toEqual(['Your spouse', '$0', '$0', '$0']);
    expect(s.rows[1].detail).toBe('Not born before January 2, 1962: doesn’t qualify');
    expect(s.deduction).toBe(6_000);
  });

  it('explains a $0 deduction: married filing separately, nobody 65, or fully phased out', () => {
    expect(senior('mfs', 60_000, true).zeroReason).toBe(
      'Married filing separately can’t claim the senior deduction: married couples must file jointly.',
    );
    expect(senior('single', 60_000, false).zeroReason).toBe('You need to be born before January 2, 1962 to qualify for 2026.');
    expect(senior('mfj', 60_000, false, false).zeroReason).toBe('Neither of you was born before January 2, 1962, so neither qualifies for 2026.');
    expect(senior('single', 200_000, true).zeroReason).toBe('Fully phased out: the deduction reaches $0 at $175,000 of MAGI.');
  });

  it('exports the same figures to Excel as numbers and to Word as text', async () => {
    const s = senior('mfj', 200_000, true, true);
    const { ws, rows } = sheetRows(s);
    const savings = rows.findIndex((r) => r[0] === 'Estimated federal tax savings');
    expect(rows[savings][1]).toBe(1_320);
    expect(ws[utils.encode_cell({ r: savings, c: 1 })].z).toBe(FMT_USD);
    expect(rows.find((r) => r[0] === 'Senior deduction')).toEqual([`Senior deduction`, 12_000, -6_000, 6_000]);
    const text = await docxText(s);
    for (const t of ['2026 senior deduction worksheet', '−$3,000', '$1,320', 'Social Security benefits', s.referenceId]) expect(text).toContain(t);
  });
});

describe('car loan interest worksheet', () => {
  it('reference case: single, $125,000, $8,000 of interest → $3,000 deduction, $720 saved', () => {
    const s = carLoan('single', 125_000, 8_000);
    expect(s.deduction).toBe(3_000);
    expect(s.savings).toBe(720);
    expect(shown(s)).toEqual([
      ['Interest you entered', '$8,000'],
      ['After the $10,000 cap', '$8,000'],
      ['MAGI over $100,000', '$25,000'],
      ['Phase-out reduction', '−$5,000'],
      ['Car loan interest deduction', '$3,000'],
    ]);
    expect(s.rows[2].detail).toBe('25 steps of $1,000, part steps rounded up');
    expect(s.fileBase).toBe('NetWageTax_2026_Car_Loan_Interest_Deduction');
  });

  it('lists the requirements as reminders, plus the VIN, Oregon, and draft form notices', () => {
    const s = carLoan('single', 60_000, 3_000);
    expect(s.checklist?.items).toEqual(CAR_LOAN_REQUIREMENTS);
    expect(s.checklist?.intro).toContain('doesn’t check them');
    expect(s.notices.some((n) => n.includes('VIN'))).toBe(true);
    expect(s.notices.some((n) => n.includes('Oregon'))).toBe(true);
    expect(s.notices).toContain(SCHEDULE_1A_DRAFT_NOTICE);
  });

  it('caps the interest at $10,000 and says so', () => {
    const s = carLoan('mfj', 120_000, 14_000);
    expect(s.rows[1]).toMatchObject({ detail: 'Limited from $14,000', values: [10_000] });
    expect(s.deduction).toBe(10_000);
  });

  it('explains a $0 deduction: used vehicle, assembled abroad, or fully phased out', () => {
    expect(carLoan('single', 60_000, 5_000, false).zeroReason).toBe('Used vehicles don’t qualify: the vehicle’s original use has to start with you.');
    expect(carLoan('single', 60_000, 5_000, true, false).zeroReason).toBe('Only vehicles with final assembly in the United States qualify.');
    expect(carLoan('single', 60_000, 5_000, false).rows[1].detail).toBe('Vehicle doesn’t qualify: nothing counts');
    expect(carLoan('single', 150_000, 5_000).zeroReason).toBe(
      'Fully phased out: the $10,000 reduction at your MAGI is at least the $5,000 of interest after the cap.',
    );
  });

  it('exports the same figures to Excel and Word', async () => {
    const s = carLoan('single', 125_000, 8_000);
    const { rows } = sheetRows(s);
    expect(rows.find((r) => r[0] === 'Car loan interest deduction')?.[1]).toBe(3_000);
    expect(rows.find((r) => String(r[0]).startsWith('Phase-out reduction'))?.[1]).toBe(-5_000);
    expect(rows.find((r) => r[0] === 'Estimated federal tax savings')?.[1]).toBe(720);
    const text = await docxText(s);
    for (const t of ['2026 car loan interest deduction worksheet', '$720', 'Oregon', 'VIN', 'Vehicle and loan requirements']) expect(text).toContain(t);
  });
});
