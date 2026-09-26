import { useState } from 'react';

type Format = 'docx' | 'xlsx';

interface Props {
  heading: string;
  canExport: boolean;
  /** Shown when exports are disabled. */
  disabledHint: string;
  /** Opens the print / save-as-PDF flow. */
  onPrint: () => void;
  /** Builds and downloads each file; loaded on demand by the caller. */
  onExport: Record<Format, () => Promise<void>>;
}

const LABEL: Record<Format, string> = { docx: 'Export Word (.docx)', xlsx: 'Export Excel (.xlsx)' };
const NAME: Record<Format, string> = { docx: 'Word', xlsx: 'Excel' };

/**
 * Shared "save your results" panel: PDF/Print (full width) above Word and Excel
 * side by side; all three stack on phones.
 */
export default function ExportToolbar({ heading, canExport, disabledHint, onPrint, onExport }: Props) {
  const [busy, setBusy] = useState<Format | null>(null);
  const [failed, setFailed] = useState<Format | null>(null);

  async function run(format: Format) {
    setBusy(format);
    setFailed(null);
    try {
      await onExport[format]();
    } catch (err) {
      console.error(`${NAME[format]} export failed`, err);
      setFailed(format);
    } finally {
      setBusy(null);
    }
  }

  const base =
    'inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 disabled:cursor-not-allowed';
  const outline =
    'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-500';

  const headingId = `export-${heading.replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <>
      <p id={headingId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {heading}
      </p>
      <div role="group" aria-labelledby={headingId} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onPrint}
          disabled={!canExport}
          className={`${base} btn-primary sm:col-span-2 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:from-slate-800 dark:disabled:to-slate-800 dark:disabled:text-slate-500`}
        >
          <Icon d="M5.5 7V3.5h9V7M5.5 14.5h-2v-6a1.5 1.5 0 0 1 1.5-1.5h10a1.5 1.5 0 0 1 1.5 1.5v6h-2 M5.5 11.5h9v5h-9z" />
          Download PDF / Print Summary
        </button>
        {(['docx', 'xlsx'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => run(f)}
            disabled={!canExport || busy !== null}
            aria-busy={busy === f}
            className={`${base} ${outline}`}
          >
            <Icon
              d={
                f === 'docx'
                  ? 'M11.5 2.5H5.5a1.5 1.5 0 0 0-1.5 1.5v12a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 16 16V7l-4.5-4.5Z M11.5 2.5V7H16 M7 11h6 M7 14h4'
                  : 'M4 3.5h12a.5.5 0 0 1 .5.5v12a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z M3.5 8h13 M3.5 12h13 M8 8v8.5'
              }
            />
            {busy === f ? 'Preparing…' : LABEL[f]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
        {failed
          ? `The ${NAME[failed]} file could not be created. Please try again, or use Print / PDF instead.`
          : canExport
            ? 'Generated on your device. Choose “Save as PDF” in the print dialog for a PDF copy.'
            : disabledHint}
      </p>
    </>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d={d} />
    </svg>
  );
}
