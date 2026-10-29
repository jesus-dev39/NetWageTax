/**
 * Fixes from the external review of October 2026: the single-rates warning for married couples,
 * the 2026 Massachusetts surtax, Georgia's 2026 standard deduction, and the hourly field checks.
 */
import { describe, it, expect } from 'vitest';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { read, utils } from 'xlsx';
import { buildDeductionSummary } from './deduction-summary';
import { buildSummaryDocument } from './deduction-summary-docx';
import { deductionWorkbookBytes } from './deduction-summary-xlsx';
import { calculateObbbaDeduction } from './obbba-calculator';
import type { FilingStatus } from './obbba-params';
import { calculatePaycheck, hasErrors, validateHourlyFields, type PaycheckInput } from './paycheck';
import { buildPaycheckSummary } from './paycheck-summary';
import { buildPaycheckDocument } from './paycheck-summary-docx';
import { paycheckWorkbookBytes } from './paycheck-summary-xlsx';
import { directoryFaqs, faqPlainText } from './state-directory-content';
import {
  calculateStateIncomeTax,
  estimateStateTax,
  MA_SURTAX_THRESHOLD,
  SINGLE_RATES_WARNING,
  singleRatesWarning,
  STATES,
  STATES_BY_CODE,
} from './state-tax-data';

const at = new Date('2026-10-29T12:00:00');
const rowsOf = (bytes: Uint8Array) => {
  const wb = read(bytes);
  return utils.sheet_to_json<(string | number | null)[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: true, defval: null });
};
const docxText = async (doc: Parameters<typeof Packer.toBuffer>[0]) =>
  (await (await JSZip.loadAsync(await Packer.toBuffer(doc))).file('word/document.xml')!.async('string')).replace(/<[^>]+>/g, '');

describe('single-rates warning for married couples', () => {
  it('has the agreed wording', () => {
    expect(SINGLE_RATES_WARNING).toBe('State tax uses single-filer rates for now, so it may be too high for married couples.');
  });

  it('applies to every state that taxes wages without rules of its own for the filing status', () => {
    const own = ['CA', 'NY', 'SC', 'WV'];
    for (const status of ['mfj', 'hoh'] as FilingStatus[]) {
      for (const s of STATES.filter((x) => x.structure !== 'none')) {
        expect(singleRatesWarning(s.code, status)).toBe(own.includes(s.code) ? undefined : SINGLE_RATES_WARNING);
      }
    }
    // Married filing separately still uses single rules everywhere.
    for (const s of STATES.filter((x) => x.structure !== 'none')) expect(singleRatesWarning(s.code, 'mfs')).toBe(SINGLE_RATES_WARNING);
  });

  it('is off for single filers, states without a wage tax, and no state', () => {
    expect(singleRatesWarning('CA', 'single')).toBeUndefined();
    expect(singleRatesWarning('TX', 'mfj')).toBeUndefined();
    expect(singleRatesWarning(null, 'mfj')).toBeUndefined();
  });

  it('travels with the state estimate', () => {
    expect(estimateStateTax(65_000, 'GA', 0, 'mfj').singleRatesWarning).toBe(SINGLE_RATES_WARNING);
    expect(estimateStateTax(65_000, 'GA', 0, 'single').singleRatesWarning).toBeUndefined();
    expect(estimateStateTax(65_000, 'NY', 0, 'mfj').singleRatesWarning).toBeUndefined();
  });

  describe('paycheck calculator and its exports', () => {
    const input: PaycheckInput = {
      mode: 'salary', hourlyRate: 0, hoursPerWeek: 40, overtimeHoursPerWeek: 0, annualSalary: 90_000,
      frequency: 'biweekly', filingStatus: 'mfj', stateCode: 'GA',
    };
    const married = buildPaycheckSummary(input, calculatePaycheck(input), at);
    const single = buildPaycheckSummary({ ...input, filingStatus: 'single' }, calculatePaycheck({ ...input, filingStatus: 'single' }), at);
    const stateRow = (s: typeof married) => s.rows.find((r) => r.label === 'State income tax (GA)')!;

    it('marks the state row (on screen and in the print estimate)', () => {
      expect(stateRow(married).warning).toBe(SINGLE_RATES_WARNING);
      expect(stateRow(single).warning).toBeUndefined();
      expect(married.rows.filter((r) => r.warning)).toHaveLength(1);
    });

    it('puts it right under the state row in the .xlsx', () => {
      const rows = rowsOf(paycheckWorkbookBytes(married));
      const i = rows.findIndex((r) => r[0] === 'State income tax (GA)');
      expect(String(rows[i + 1][0]).trim()).toBe(SINGLE_RATES_WARNING);
      expect(rowsOf(paycheckWorkbookBytes(single)).some((r) => String(r[0]).includes('single-filer rates'))).toBe(false);
    });

    it('includes it in the .docx', async () => {
      expect(await docxText(buildPaycheckDocument(married))).toContain(SINGLE_RATES_WARNING);
      expect(await docxText(buildPaycheckDocument(single))).not.toContain(SINGLE_RATES_WARNING);
    });
  });

  describe('tips calculator exports', () => {
    const summaryFor = (filingStatus: FilingStatus) => {
      const result = calculateObbbaDeduction({
        filingStatus, magi: 52_000, taxYear: 2026,
        hasQualifyingTips: true, tipsAmount: 8_000, tipsOccupationConfirmed: true,
        hasQualifyingOvertime: false, overtimePremiumAmount: 0, isFLSANonExempt: true,
      });
      return buildDeductionSummary(
        { result, tipsReported: 8_000, overtimeReported: 0, savings: 960, stateTax: estimateStateTax(52_000, 'GA', 1_750, filingStatus) },
        at,
      );
    };
    const stateLine = (s: ReturnType<typeof summaryFor>) => s.lines.find((l) => l.label === 'Estimated state income tax (GA)')!;

    it('marks the state line for married filers only', () => {
      expect(stateLine(summaryFor('mfj')).warning).toBe(SINGLE_RATES_WARNING);
      expect(stateLine(summaryFor('hoh')).warning).toBe(SINGLE_RATES_WARNING);
      expect(stateLine(summaryFor('single')).warning).toBeUndefined();
    });

    it('adds it under the state row in the .xlsx and in the .docx', async () => {
      const rows = rowsOf(deductionWorkbookBytes(summaryFor('mfj')));
      expect(rows.some((r) => r[0] === SINGLE_RATES_WARNING)).toBe(true);
      expect(rowsOf(deductionWorkbookBytes(summaryFor('single'))).some((r) => r[0] === SINGLE_RATES_WARNING)).toBe(false);
      expect(await docxText(buildSummaryDocument(summaryFor('mfj')))).toContain(SINGLE_RATES_WARNING);
    });
  });
});

describe('Massachusetts 4% surtax (2026)', () => {
  it('starts at $1,107,750 of taxable income', () => {
    expect(MA_SURTAX_THRESHOLD).toBe(1_107_750);
    expect(STATES_BY_CODE.MA.surtax).toEqual({ over: 1_107_750, rate: 0.04, label: 'Millionaires surtax' });
  });

  it('leaves typical wages unchanged: 5% above the $4,400 exemption', () => {
    expect(calculateStateIncomeTax(65_000, 'MA')).toBeCloseTo(3_030);
    // Taxable income exactly at the threshold: no surtax yet.
    expect(calculateStateIncomeTax(1_107_750 + 4_400, 'MA')).toBeCloseTo(1_107_750 * 0.05);
  });

  it('adds 4% on taxable income above the threshold', () => {
    // $2,000,000 − $4,400 = $1,995,600 → 5% = $99,780, plus 4% × $887,850 = $35,514.
    expect(calculateStateIncomeTax(2_000_000, 'MA')).toBeCloseTo(135_294);
  });

  it('shows the 2026 threshold on the state page and in the directory FAQ, not the old "$1.08 million"', () => {
    expect(STATES_BY_CODE.MA.note).toContain('$1,107,750');
    const flat = directoryFaqs().find((f) => f.question === 'Which states have a flat income tax?')!;
    const text = flat.answer.map(faqPlainText).join(' ');
    expect(text).toContain('4% surtax on taxable income above $1,107,750 for 2026');
    expect(text).not.toContain('1.08');
  });
});

describe('Georgia 2026 standard deduction (HB 463, Sections 2-3 and 5-1)', () => {
  it('is $15,000 for a single filer, so $65,000 of wages owes $2,495', () => {
    expect(STATES_BY_CODE.GA.exemptAmount).toBe(15_000);
    expect(calculateStateIncomeTax(65_000, 'GA')).toBeCloseTo(2_495);
  });
});

describe('hourly field checks', () => {
  it('accepts a positive rate, 0–168 regular hours, and overtime up to 168 minus them', () => {
    expect(validateHourlyFields(25, '40', '0')).toEqual({});
    expect(validateHourlyFields(25, '0', '168')).toEqual({});
    expect(validateHourlyFields(25, '168', '0')).toEqual({});
    expect(validateHourlyFields(25, '100', '68')).toEqual({});
    expect(validateHourlyFields(25, '37.5', '130.5')).toEqual({});
  });

  it('does not flag a rate that has not been entered yet', () => {
    expect(validateHourlyFields(null, '40', '0')).toEqual({});
  });

  it('rejects a $0 rate', () => {
    expect(validateHourlyFields(0, '40', '0')).toEqual({ hourlyRate: 'Enter an hourly rate greater than $0.' });
  });

  it('rejects regular hours above 168 or left empty', () => {
    expect(validateHourlyFields(25, '169', '0').hoursPerWeek).toBe('Enter regular hours from 0 to 168 a week.');
    expect(validateHourlyFields(25, '', '0').hoursPerWeek).toBeDefined();
    expect(validateHourlyFields(25, '.', '0').hoursPerWeek).toBeDefined();
  });

  it('rejects overtime above 168 minus the regular hours', () => {
    expect(validateHourlyFields(25, '100', '69')).toEqual({
      overtimeHours: 'Enter overtime from 0 to 68 hours a week (168 minus your regular hours).',
    });
    expect(validateHourlyFields(25, '40', '').overtimeHours).toBeDefined();
    // With invalid regular hours, overtime is only checked against 168.
    expect(validateHourlyFields(25, '200', '10')).toEqual({ hoursPerWeek: 'Enter regular hours from 0 to 168 a week.' });
    expect(validateHourlyFields(25, '200', '169').overtimeHours).toBe('Enter overtime from 0 to 168 hours a week.');
  });

  it('reports whether any field failed', () => {
    expect(hasErrors({})).toBe(false);
    expect(hasErrors(validateHourlyFields(0, '40', '0'))).toBe(true);
  });
});

describe('reference case 1 of docs/MAINTENANCE.md (home page estimate)', () => {
  it('still takes home $2,092.60 per biweekly paycheck on a $65,000 single salary with no state', () => {
    const r = calculatePaycheck({
      mode: 'salary', hourlyRate: 0, hoursPerWeek: 40, overtimeHoursPerWeek: 0, annualSalary: 65_000,
      frequency: 'biweekly', filingStatus: 'single', stateCode: null,
    });
    expect(r.netPerPeriod.toFixed(2)).toBe('2092.60');
  });
});
