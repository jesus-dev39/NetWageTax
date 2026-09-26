import { useEffect, useRef, useState } from 'react';
import AdSlot from './AdSlot';

const PREP_DURATION_MS = 2500;

interface Props {
  open: boolean;
  taxYear: number;
  /** Opens the browser print dialog. Called after this modal has closed itself. */
  onPrint: () => void;
  onClose: () => void;
}

/**
 * "Preparing document" interstitial shown before printing the voucher.
 * The user can skip at any time; printing is always a direct click (never
 * automatic), so the browser print dialog is tied to a user gesture.
 */
export default function ExportPrepModal({ open, taxYear, onPrint, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const printRef = useRef<HTMLButtonElement>(null);
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }

    setStarted(false);
    setReady(false);
    dialog.showModal();
    // Two frames so the bar renders at 0% before transitioning to 100%.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setStarted(true));
    });
    const timer = window.setTimeout(() => setReady(true), PREP_DURATION_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (ready) printRef.current?.focus();
  }, [ready]);

  function printNow() {
    dialogRef.current?.close();
    onPrint();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="export-prep-title"
      aria-describedby="export-prep-status"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="export-prep-title" className="text-lg font-semibold tracking-tight">
            Preparing Your {taxYear} Tax Estimate Voucher
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Cancel"
            className="-mr-2 -mt-1 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
              <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <p id="export-prep-status" aria-live="polite" className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          {ready ? 'Your voucher is ready.' : 'Formatting deduction data…'}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] ease-linear motion-reduce:transition-none"
            style={{ width: started ? '100%' : '0%', transitionDuration: `${PREP_DURATION_MS}ms` }}
          />
        </div>

        {/* Ad placement 3: export interstitial. See the AdSense policy note in AdSlot.tsx before going live. */}
        <AdSlot format="rectangle" placement="export-interstitial" className="mt-6" />

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {ready ? (
            <button
              ref={printRef}
              type="button"
              onClick={printNow}
              className="inline-flex items-center justify-center rounded-lg btn-primary px-5 py-2.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
            >
              Print / Save PDF
            </button>
          ) : (
            <button
              type="button"
              onClick={printNow}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Skip / Open Now
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
