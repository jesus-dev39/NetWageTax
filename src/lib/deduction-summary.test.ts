import { describe, it, expect } from 'vitest';
import { Packer } from 'docx';
import { calculateObbbaDeduction } from './obbba-calculator';
import { buildDeductionSummary } from './deduction-summary';
import { buildSummaryDocument } from './deduction-summary-docx';

const at = new Date('2026-09-26T15:30:00');

function summaryFor(magi: number, tips: number, overtime: number) {
  const result = calculateObbbaDeduction({
    filingStatus: 'single',
    magi,
    taxYear: 2026,
    hasQualifyingTips: tips > 0,
    tipsAmount: tips,
    tipsOccupationConfirmed: true,
    hasQualifyingOvertime: overtime > 0,
    overtimePremiumAmount: overtime,
    isFLSANonExempt: true,
  });
  return buildDeductionSummary({ result, tipsReported: tips, overtimeReported: overtime, savings: 1_234 }, at);
}

const value = (s: ReturnType<typeof summaryFor>, label: string) => s.lines.find((l) => l.label === label)?.value;

describe('buildDeductionSummary', () => {
  it('lists caps, phase-out and the net deduction', () => {
    const s = summaryFor(160_000, 30_000, 0);
    expect(s.filingStatus).toBe('Single');
    expect(value(s, 'Base deduction (after caps)')).toBe('$25,000');
    expect(value(s, 'MAGI phase-out reduction')).toBe('−$1,000');
    expect(value(s, 'Net federal tax deduction')).toBe('$24,000');
    expect(s.lines.find((l) => l.label === 'Tips cap applied')?.detail).toBe('Limited from $30,000');
    expect(s.lines.filter((l) => l.total)).toHaveLength(1);
  });

  it('estimates FICA on tips and overtime at 7.65% below the wage base', () => {
    const s = summaryFor(60_000, 10_000, 2_000);
    expect(value(s, 'Estimated FICA still owed on tips & overtime')).toBe('$918');
  });

  it('explains $0 savings when the standard deduction covers all income', () => {
    expect(summaryFor(15_000, 3_000, 0).savingsNote).toMatch(/Standard deduction already covers 100%/);
    expect(summaryFor(60_000, 3_000, 0).savingsNote).toBeUndefined();
  });

  it('produces a valid .docx package', async () => {
    const buffer = await Packer.toBuffer(buildSummaryDocument(summaryFor(60_000, 10_000, 0)));
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
  });
});
