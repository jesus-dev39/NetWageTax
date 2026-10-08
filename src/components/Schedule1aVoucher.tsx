import { SUMMARY_DISCLAIMER, SUMMARY_LEGAL_NOTICE } from '../lib/deduction-summary';
import { worksheetValue, type Schedule1aSummary } from '../lib/schedule-1a-summary';
import { formatUSD } from './CurrencyInput';
import { VoucherFigure, VoucherFooter, VoucherHeader } from './VoucherParts';

/**
 * Print-only worksheet (PDF) for the senior deduction and car loan interest calculators: same
 * layout as the tips and overtime voucher. One page on A4 or Letter.
 */
export default function Schedule1aVoucher({ summary: s }: { summary: Schedule1aSummary }) {
  const label = s.deductionLabel.charAt(0).toUpperCase() + s.deductionLabel.slice(1);
  return (
    <div className="print-voucher hidden min-h-[245mm] flex-col bg-page text-[13px] text-ink print:flex" aria-hidden="true">
      <VoucherHeader
        subtitle={`NetWageTax.com · ${s.taxYear} tax estimate`}
        referenceLabel="Reference"
        referenceId={s.referenceId}
        generatedAt={s.generatedAt}
      />
      <h1 className="mt-4 text-2xl/[1.2] font-bold tracking-[-0.01em]">{s.title}</h1>
      <p className="mt-1 text-ink-2">{s.context}</p>

      <section className="mt-5 grid grid-cols-3 gap-3 break-inside-avoid">
        <VoucherFigure label="Total income (MAGI)" value={formatUSD(s.magi)} />
        <VoucherFigure label={`${label} (Schedule 1-A)`} value={formatUSD(s.deduction)} />
        <VoucherFigure
          label="Federal tax savings"
          value={formatUSD(s.savings)}
          detail={`Income tax ${formatUSD(s.federal.before)} → ${formatUSD(s.federal.after)}`}
          accent
        />
      </section>
      {s.savingsNote && <p className="mt-2 text-xs text-ink-2">{s.savingsNote}</p>}
      {s.zeroReason && (
        <p className="mt-3 border-l-4 border-warning bg-warning-tint px-3 py-2 text-xs">
          <span className="font-semibold">Why the deduction is $0: </span>
          {s.zeroReason}
        </p>
      )}

      <section className="mt-4 break-inside-avoid">
        <h2 className="text-[15px] font-bold">{s.tableTitle}</h2>
        <table className="mt-2 w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface text-xs">
              {s.columns.map((c, i) => (
                <th key={c} scope="col" className={`px-3 py-2 font-semibold ${i > 0 ? 'text-right' : ''}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.rows.map((r) => (
              <tr key={r.label} className={r.total ? 'border-t-2 border-ink font-bold' : 'border-b border-line'}>
                <th scope="row" className={`px-3 py-1.5 ${r.total ? '' : 'font-semibold'}`}>
                  {r.label}
                  {r.detail && <span className="ml-2 text-[11px] font-normal text-ink-2">{r.detail}</span>}
                </th>
                {r.values.map((v, i) => (
                  <td key={i} className="px-3 py-1.5 text-right align-top">
                    {worksheetValue(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {s.tableNote && <p className="mt-2 text-xs text-ink-2">{s.tableNote}</p>}
      </section>

      {s.checklist && (
        <section className="mt-4 break-inside-avoid">
          <h2 className="text-[15px] font-bold">{s.checklist.title}</h2>
          <p className="mt-0.5 text-xs text-ink-2">{s.checklist.intro}</p>
          <ul className="mt-1.5 grid list-disc grid-cols-2 gap-x-6 gap-y-0.5 pl-5 text-xs">
            {s.checklist.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4 break-inside-avoid border-l-4 border-warning bg-warning-tint px-3 py-2">
        <h2 className="text-xs font-semibold">Before you file</h2>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
          {s.notices.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      <VoucherFooter basis={s.basis} generatedAt={s.generatedAt} referenceId={s.referenceId} headline={SUMMARY_DISCLAIMER} body={SUMMARY_LEGAL_NOTICE} />
    </div>
  );
}
