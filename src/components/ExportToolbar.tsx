import type { ExportFormat } from './ExportAdModal';

interface Props {
  heading: string;
  canExport: boolean;
  /** Shown when exports are disabled. */
  disabledHint: string;
  /** Every format goes through the ExportAdModal; the caller opens it. */
  onSelect: (format: ExportFormat) => void;
}

const BUTTONS: { format: ExportFormat; label: string; icon: string }[] = [
  {
    format: 'pdf',
    label: 'Download PDF / Print Summary',
    icon: 'M5.5 7V3.5h9V7M5.5 14.5h-2v-6a1.5 1.5 0 0 1 1.5-1.5h10a1.5 1.5 0 0 1 1.5 1.5v6h-2 M5.5 11.5h9v5h-9z',
  },
  {
    format: 'docx',
    label: 'Export Word (.docx)',
    icon: 'M11.5 2.5H5.5a1.5 1.5 0 0 0-1.5 1.5v12a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 16 16V7l-4.5-4.5Z M11.5 2.5V7H16 M7 11h6 M7 14h4',
  },
  {
    format: 'xlsx',
    label: 'Export Excel (.xlsx)',
    icon: 'M4 3.5h12a.5.5 0 0 1 .5.5v12a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Z M3.5 8h13 M3.5 12h13 M8 8v8.5',
  },
];

/**
 * Shared "save your results" panel: PDF/Print (full width) above Word and Excel
 * side by side; all three stack on phones.
 */
export default function ExportToolbar({ heading, canExport, disabledHint, onSelect }: Props) {
  const base =
    'inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 disabled:cursor-not-allowed';
  const primary =
    'btn-primary sm:col-span-2 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:from-slate-800 dark:disabled:to-slate-800 dark:disabled:text-slate-500';
  const outline =
    'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-500';
  const headingId = `export-${heading.replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <>
      <p id={headingId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {heading}
      </p>
      <div role="group" aria-labelledby={headingId} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {BUTTONS.map(({ format, label, icon }) => (
          <button
            key={format}
            type="button"
            onClick={() => onSelect(format)}
            disabled={!canExport}
            className={`${base} ${format === 'pdf' ? primary : outline}`}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
              <path d={icon} />
            </svg>
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {canExport ? 'Generated on your device. Nothing is uploaded.' : disabledHint}
      </p>
    </>
  );
}
