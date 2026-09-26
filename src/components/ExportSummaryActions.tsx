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
import ExportPrepModal from './ExportPrepModal';
import ExportToolbar from './ExportToolbar';
import Logo from './Logo';

type Props = SummaryInput;

export default function ExportSummaryActions(props: Props) {
  const { result, tipsReported, overtimeReported, savings, stateTax } = props;
  const canExport = result.totalCombinedDeduction > 0;

  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const [mounted, setMounted] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);

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

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 print:hidden dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-xl">
      <ExportToolbar
        heading={`Save your ${result.taxYear} deduction summary`}
        canExport={canExport}
        disabledHint="Enter a qualifying tips or overtime amount to enable exports."
        onPrint={() => setPrepOpen(true)}
        onExport={{
          docx: async () => (await import('../lib/deduction-summary-docx')).downloadSummaryDocx(fresh()),
          xlsx: async () => (await import('../lib/deduction-summary-xlsx')).downloadDeductionXlsx(fresh()),
        }}
      />

      <ExportPrepModal
        open={prepOpen}
        taxYear={result.taxYear}
        onPrint={handlePrint}
        onClose={() => setPrepOpen(false)}
      />

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
    <div className="print-voucher hidden min-h-[245mm] flex-col bg-white text-[13px] text-slate-900 print:flex" aria-hidden="true">
      {/* Header banner */}
      <header className="rounded-xl bg-slate-900 px-6 py-5 text-white">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Logo tone="dark" />
            <p className="mt-1 text-xs text-slate-400">NetWageTax.com · {summary.taxYear} Tax Estimate</p>
          </div>
          <div className="text-right text-xs">
            <p className="uppercase tracking-wider text-slate-400">Reference</p>
            <p className="font-mono text-sm font-semibold text-emerald-400">{summary.referenceId}</p>
            <p className="mt-1 text-slate-400">{summary.generatedAt}</p>
          </div>
        </div>
        <div className="mt-5 border-t border-white/10 pt-4">
          <h1 className="text-2xl font-bold tracking-tight">{summary.taxYear} Tax Deduction Worksheet</h1>
          <p className="mt-0.5 text-slate-300">
            Federal Tips &amp; Overtime Deduction · Schedule 1-A method · {summary.filingStatus}
            {summary.stateTax ? ` · ${summary.stateTax.name}` : ''}
          </p>
        </div>
      </header>

      {/* Highlight cards */}
      <section className="mt-5 grid grid-cols-3 gap-3 break-inside-avoid">
        <HighlightCard label="Total income (MAGI)" value={formatUSD(summary.magi)} />
        <HighlightCard label="Net deduction (Schedule 1-A)" value={formatUSD(summary.totalDeduction)} />
        <HighlightCard label="Net tax savings" value={`${summary.savings > 0 ? '+' : ''}${formatUSD(summary.savings)}`} accent />
      </section>
      {summary.savingsNote && <p className="mt-2 text-xs text-emerald-800">✓ {summary.savingsNote}</p>}

      {/* Worksheet */}
      <section className="mt-6 break-inside-avoid">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Deduction worksheet</h2>
        <table className="mt-2 w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
              <th scope="col" className="px-3 py-2 font-semibold">Category</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Reported</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Statutory cap</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">After cap</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Phase-out</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Allowed</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {summary.worksheet.map((r, i) => (
              <tr key={r.code} className={i % 2 ? 'bg-slate-50' : ''}>
                <th scope="row" className="px-3 py-2.5 font-medium">
                  {r.label} <span className="font-mono text-[11px] text-slate-500">({r.code})</span>
                  {r.note && <span className="block text-[11px] font-normal text-slate-500">{r.note}</span>}
                </th>
                <td className="px-3 py-2.5 text-right">{formatUSD(r.reported)}</td>
                <td className="px-3 py-2.5 text-right text-slate-500">{formatUSD(r.cap)}</td>
                <td className="px-3 py-2.5 text-right">{formatUSD(r.afterCap)}</td>
                <td className="px-3 py-2.5 text-right">{minus(r.phaseoutReduction)}</td>
                <td className="px-3 py-2.5 text-right font-semibold">{formatUSD(r.allowed)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-900 bg-emerald-50 font-semibold">
              <th scope="row" className="px-3 py-2.5">Total</th>
              <td className="px-3 py-2.5 text-right">{formatUSD(totals.reported)}</td>
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5 text-right">{formatUSD(totals.afterCap)}</td>
              <td className="px-3 py-2.5 text-right">{minus(totals.phaseout)}</td>
              <td className="px-3 py-2.5 text-right text-emerald-700">{formatUSD(totals.allowed)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Tax impact */}
      <section className="mt-6 break-inside-avoid">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tax impact</h2>
        <table className="mt-2 w-full border-collapse text-left">
          <tbody className="tabular-nums">
            <ImpactRow
              label={SAVINGS_LINE_LABEL}
              detail={`${summary.taxYear} standard deduction and federal brackets`}
              value={formatUSD(summary.savings)}
              good
            />
            <ImpactRow
              label="Estimated FICA still owed on tips & overtime"
              detail="Social Security & Medicare, employee share"
              value={formatUSD(summary.fica)}
              striped
            />
            {summary.stateTax && (
              <ImpactRow
                label={`Estimated state income tax: ${summary.stateTax.name}`}
                detail={
                  summary.stateTax.structure === 'none'
                    ? 'No state income tax on wages'
                    : `${summary.stateTax.rateLabel} · single-filer estimate, excludes local taxes`
                }
                value={formatUSD(summary.stateTax.tax)}
              />
            )}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-amber-800">
          <span className="font-semibold">Important: </span>
          {summary.ficaNotice}
        </p>
      </section>

      {/* Compliance & disclaimer, pinned to the bottom of the page */}
      <footer className="mt-auto break-inside-avoid rounded-lg border border-slate-300 p-4 pt-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
            <span aria-hidden="true">✓</span> Calculated under IRC §224 / §225 &amp; FLSA §7 rules
          </span>
          <span className="text-[11px] text-slate-500">
            Generated {summary.generatedAt} · {summary.referenceId}
          </span>
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-900">{SUMMARY_DISCLAIMER}</p>
        <p className="mt-1 text-[10.5px] leading-relaxed text-slate-600">{SUMMARY_LEGAL_NOTICE}</p>
      </footer>
    </div>
  );
}

function HighlightCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg px-4 py-3 ${accent ? 'border-2 border-emerald-600 bg-emerald-50' : 'border border-slate-200 bg-slate-50'}`}>
      <p className={`text-[10.5px] font-semibold uppercase leading-tight tracking-wide ${accent ? 'text-emerald-800' : 'text-slate-500'}`}>
        {label}
      </p>
      <p className={`mt-1 font-bold tabular-nums ${accent ? 'text-3xl text-emerald-700' : 'text-2xl text-slate-900'}`}>{value}</p>
    </div>
  );
}

function ImpactRow(props: { label: string; detail: string; value: string; good?: boolean; striped?: boolean }) {
  return (
    <tr className={props.striped ? 'bg-slate-50' : ''}>
      <th scope="row" className="px-3 py-2 font-medium">
        {props.label}
        <span className="block text-[11px] font-normal text-slate-500">{props.detail}</span>
      </th>
      <td className={`px-3 py-2 text-right font-semibold ${props.good ? 'text-emerald-700' : ''}`}>{props.value}</td>
    </tr>
  );
}
