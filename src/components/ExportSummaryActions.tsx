import { useEffect, useMemo, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import {
  buildDeductionSummary,
  SAVINGS_LINE_LABEL,
  SUMMARY_DISCLAIMER,
  SUMMARY_LEGAL_NOTICE,
  type DeductionSummary,
  type SummaryInput,
} from '../lib/deduction-summary';
import { formatUSD } from './CurrencyInput';
import ExportAdModal, { type ExportFormat, type ExportRequest } from './ExportAdModal';
import ExportToolbar from './ExportToolbar';
import { VoucherFigure, VoucherFooter, VoucherHeader } from './VoucherParts';

type Props = SummaryInput;

export default function ExportSummaryActions(props: Props) {
  const { result, tipsReported, overtimeReported, savings, stateTax } = props;
  const canExport = result.totalCombinedDeduction > 0;

  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const [mounted, setMounted] = useState(false);
  const [request, setRequest] = useState<ExportRequest | null>(null);

  const summary = useMemo(
    () => buildDeductionSummary({ result, tipsReported, overtimeReported, savings, stateTax }, generatedAt),
    [result, tipsReported, overtimeReported, savings, stateTax, generatedAt],
  );

  // The voucher is portaled to <body> after hydration so print CSS can hide every other body child.
  useEffect(() => setMounted(true), []);

  // Stamp the voucher at print time, including prints started from the browser menu / Ctrl+P.
  useEffect(() => {
    const stamp = () => flushSync(() => setGeneratedAt(new Date()));
    window.addEventListener('beforeprint', stamp);
    return () => window.removeEventListener('beforeprint', stamp);
  }, []);

  function handlePrint() {
    flushSync(() => setGeneratedAt(new Date()));
    window.print();
  }

  const fresh = () => buildDeductionSummary({ result, tipsReported, overtimeReported, savings, stateTax }, new Date());

  // Every format opens the same modal; files are built from fresh data at click time.
  function exportRequest(format: ExportFormat): ExportRequest {
    const titles: Record<ExportFormat, string> = {
      pdf: `Your ${result.taxYear} tips and overtime worksheet (PDF)`,
      docx: `Your ${result.taxYear} tips and overtime worksheet (Word)`,
      xlsx: `Your ${result.taxYear} tips and overtime worksheet (Excel)`,
    };
    const run: Record<ExportFormat, () => Promise<void> | void> = {
      pdf: handlePrint,
      docx: async () => (await import('../lib/deduction-summary-docx')).downloadSummaryDocx(fresh()),
      xlsx: async () => (await import('../lib/deduction-summary-xlsx')).downloadDeductionXlsx(fresh()),
    };
    return { format, title: titles[format], run: run[format] };
  }

  return (
    <div className="print:hidden">
      <ExportToolbar
        heading={`Save your ${result.taxYear} deduction worksheet`}
        canExport={canExport}
        disabledHint="Enter a qualifying tips or overtime amount to enable exports."
        onSelect={(format) => setRequest(exportRequest(format))}
      />

      <ExportAdModal request={request} onClose={() => setRequest(null)} />

      {mounted && canExport && createPortal(<PrintVoucher summary={summary} />, document.body)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Print-only voucher
// ---------------------------------------------------------------------------

export function PrintVoucher({ summary }: { summary: DeductionSummary }) {
  const totals = summary.worksheet.reduce(
    (t, r) => ({
      reported: t.reported + r.reported,
      afterCap: t.afterCap + r.afterCap,
      phaseout: t.phaseout + r.phaseoutReduction,
      allowed: t.allowed + r.allowed,
    }),
    { reported: 0, afterCap: 0, phaseout: 0, allowed: 0 },
  );
  const minus = (n: number) => (n > 0 ? `−${formatUSD(n)}` : formatUSD(0));

  return (
    <div className="print-voucher hidden min-h-[245mm] flex-col bg-page text-[13px] text-ink print:flex" aria-hidden="true">
      <VoucherHeader
        subtitle={`NetWageTax.com · ${summary.taxYear} tax estimate`}
        referenceLabel="Reference"
        referenceId={summary.referenceId}
        generatedAt={summary.generatedAt}
      />
      <h1 className="mt-4 text-2xl/[1.2] font-bold tracking-[-0.01em]">
        {summary.taxYear} tips and overtime deduction worksheet
      </h1>
      <p className="mt-1 text-ink-2">
        Federal deduction for qualified tips and overtime · Schedule 1-A method · {summary.filingStatus}
        {summary.stateTax ? ` · ${summary.stateTax.name}` : ''}
      </p>

      <section className="mt-5 grid grid-cols-3 gap-3 break-inside-avoid">
        <VoucherFigure label="Total income (MAGI)" value={formatUSD(summary.magi)} />
        <VoucherFigure label="Net deduction (Schedule 1-A)" value={formatUSD(summary.totalDeduction)} />
        <VoucherFigure label="Federal tax savings" value={formatUSD(summary.savings)} accent />
      </section>
      {summary.savingsNote && <p className="mt-2 text-xs text-ink-2">{summary.savingsNote}</p>}

      <section className="mt-6 break-inside-avoid">
        <h2 className="text-[15px] font-bold">Deduction worksheet</h2>
        <table className="mt-2 w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface text-xs">
              <th scope="col" className="px-3 py-2 font-semibold">Category</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Reported</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Statutory cap</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">After cap</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Phase-out</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Allowed</th>
            </tr>
          </thead>
          <tbody>
            {summary.worksheet.map((r) => (
              <tr key={r.code} className="border-b border-line">
                <th scope="row" className="px-3 py-2.5 font-semibold">
                  {r.label} <span className="text-[11px] font-normal text-ink-2">(Code {r.code})</span>
                  {r.note && <span className="block text-[11px] font-normal text-ink-2">{r.note}</span>}
                </th>
                <td className="px-3 py-2.5 text-right">{formatUSD(r.reported)}</td>
                <td className="px-3 py-2.5 text-right text-ink-2">{formatUSD(r.cap)}</td>
                <td className="px-3 py-2.5 text-right">{formatUSD(r.afterCap)}</td>
                <td className="px-3 py-2.5 text-right">{minus(r.phaseoutReduction)}</td>
                <td className="px-3 py-2.5 text-right font-semibold">{formatUSD(r.allowed)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-ink font-bold">
              <th scope="row" className="px-3 py-2.5">Total</th>
              <td className="px-3 py-2.5 text-right">{formatUSD(totals.reported)}</td>
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5 text-right">{formatUSD(totals.afterCap)}</td>
              <td className="px-3 py-2.5 text-right">{minus(totals.phaseout)}</td>
              <td className="px-3 py-2.5 text-right">{formatUSD(totals.allowed)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-6 break-inside-avoid">
        <h2 className="text-[15px] font-bold">Tax impact</h2>
        <table className="mt-2 w-full border-collapse border-t border-line text-left">
          <tbody>
            <ImpactRow
              label={SAVINGS_LINE_LABEL}
              detail={`${summary.taxYear} standard deduction and federal brackets`}
              value={formatUSD(summary.savings)}
            />
            <ImpactRow
              label="Estimated FICA still owed on tips and overtime"
              detail="Social Security and Medicare, employee share"
              value={formatUSD(summary.fica)}
            />
            {summary.stateTax && (
              <ImpactRow
                label={`Estimated state income tax: ${summary.stateTax.name}`}
                detail={
                  summary.stateTax.structure === 'none'
                    ? 'No state income tax on wages'
                    : `${summary.stateTax.rateLabel} · simplified single-filer estimate, excludes local taxes`
                }
                note={summary.stateTipsOvertimeNote}
                value={formatUSD(summary.stateTax.tax)}
              />
            )}
          </tbody>
        </table>
        <p className="mt-3 border-l-4 border-warning bg-warning-tint px-3 py-2 text-xs">
          <span className="font-semibold">Important: </span>
          {summary.ficaNotice}
        </p>
      </section>

      <VoucherFooter
        basis="Calculated under IRC §224 and §225 and FLSA §7 rules."
        generatedAt={summary.generatedAt}
        referenceId={summary.referenceId}
        headline={SUMMARY_DISCLAIMER}
        body={SUMMARY_LEGAL_NOTICE}
      />
    </div>
  );
}

function ImpactRow(props: { label: string; detail: string; note?: string; value: string }) {
  return (
    <tr className="border-b border-line">
      <th scope="row" className="px-3 py-2 font-semibold">
        {props.label}
        <span className="block text-[11px] font-normal text-ink-2">{props.detail}</span>
        {props.note && <span className="mt-0.5 block text-[11px] font-normal text-ink-2">{props.note}</span>}
      </th>
      <td className="px-3 py-2 text-right font-semibold">{props.value}</td>
    </tr>
  );
}
