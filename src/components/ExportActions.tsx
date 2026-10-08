import { useEffect, useState, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
import ExportAdModal, { type ExportFormat, type ExportRequest } from './ExportAdModal';
import ExportToolbar from './ExportToolbar';

interface Props<S> {
  /** Toolbar heading, e.g. "Save your 2026 deduction worksheet". */
  heading: string;
  canExport: boolean;
  /** Shown when exports are disabled. */
  disabledHint: string;
  /** Modal title without the format, e.g. "Your 2026 tips and overtime worksheet". */
  title: string;
  /** Builds the summary for a timestamp; every format reads the same summary. */
  build: (generatedAt: Date) => S;
  /** Print-only voucher (PDF). Rendered with the `print-voucher` class. */
  voucher: (summary: S) => ReactNode;
  /** Word and Excel builders, imported dynamically by the caller so their libraries load on click. */
  docx: (summary: S) => Promise<void>;
  xlsx: (summary: S) => Promise<void>;
}

const FORMAT_LABEL: Record<ExportFormat, string> = { pdf: 'PDF', docx: 'Word', xlsx: 'Excel' };

/**
 * Export buttons, the download modal, and the print voucher for every calculator. The page decides
 * where this block goes; it must never sit next to an ad (AdSlot rules).
 */
export default function ExportActions<S>({ heading, canExport, disabledHint, title, build, voucher, docx, xlsx }: Props<S>) {
  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const [mounted, setMounted] = useState(false);
  const [request, setRequest] = useState<ExportRequest | null>(null);

  const summary = build(generatedAt);

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

  // Every format opens the same modal; files are built from fresh data at click time.
  function exportRequest(format: ExportFormat): ExportRequest {
    const run: Record<ExportFormat, () => Promise<void> | void> = {
      pdf: handlePrint,
      docx: () => docx(build(new Date())),
      xlsx: () => xlsx(build(new Date())),
    };
    return { format, title: `${title} (${FORMAT_LABEL[format]})`, run: run[format] };
  }

  return (
    <div className="print:hidden">
      <ExportToolbar heading={heading} canExport={canExport} disabledHint={disabledHint} onSelect={(format) => setRequest(exportRequest(format))} />

      <ExportAdModal request={request} onClose={() => setRequest(null)} />

      {mounted && canExport && createPortal(voucher(summary), document.body)}
    </div>
  );
}
