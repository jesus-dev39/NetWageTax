import type { ExportFormat } from './ExportAdModal';

interface Props {
  heading: string;
  canExport: boolean;
  /** Shown when exports are disabled. */
  disabledHint: string;
  /** Every format goes through the ExportAdModal; the caller opens it. */
  onSelect: (format: ExportFormat) => void;
}

const BUTTONS: { format: ExportFormat; label: string }[] = [
  { format: 'pdf', label: 'Print or save as PDF' },
  { format: 'docx', label: 'Download Word (.docx)' },
  { format: 'xlsx', label: 'Download Excel (.xlsx)' },
];

/**
 * Shared "save your results" block. Exports aren't the page's main action, so all three are
 * secondary buttons (docs/DESIGN.md §6): white, 2px ink border, no icons.
 */
export default function ExportToolbar({ heading, canExport, disabledHint, onSelect }: Props) {
  const headingId = `export-${heading.replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <>
      <h3 id={headingId} className="font-semibold text-ink">
        {heading}
      </h3>
      <div role="group" aria-labelledby={headingId} className="mt-3 flex flex-col gap-2">
        {BUTTONS.map(({ format, label }) => (
          <button
            key={format}
            type="button"
            onClick={() => onSelect(format)}
            disabled={!canExport}
            className="inline-flex h-11 w-full items-center justify-center rounded-control border-2 border-ink bg-page px-4 font-semibold text-ink transition-colors duration-150 hover:bg-surface disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:hover:bg-page"
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-ink-2">{canExport ? 'Files are generated on your device.' : disabledHint}</p>
    </>
  );
}
