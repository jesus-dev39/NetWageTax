import { useEffect, useRef, useState } from 'react';

export type ExportFormat = 'pdf' | 'docx' | 'xlsx';

export interface ExportRequest {
  format: ExportFormat;
  /** e.g. "Preparing your 2026 Paycheck Excel Worksheet" */
  title: string;
  /** Builds and saves the file (docx/xlsx) or opens the print dialog (pdf). */
  run: () => Promise<void> | void;
}

interface Props {
  request: ExportRequest | null;
  onClose: () => void;
}

type Status = 'working' | 'done' | 'ready' | 'error';

/**
 * Download-preparation modal shared by every export (PDF, Word, Excel).
 *
 * Policy-safe by design (Better Ads Standards / AdSense):
 * - No forced wait or countdown: Word/Excel files are generated immediately and download
 *   as soon as they're ready; PDF's print button is usable the moment the modal opens.
 * - No ads of any kind: ads never go in dialogs or next to download buttons.
 * - The ✕ button, Esc, and the "click to close" CTA all dismiss it at any time.
 *
 * Files start from the user's click (the browser's transient activation still applies),
 * so the download isn't blocked; "Download again" covers browsers that block it anyway.
 */
export default function ExportAdModal({ request, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState<Status>('working');
  const [progress, setProgress] = useState(0);
  const runId = useRef(0);

  async function start(req: ExportRequest) {
    const id = ++runId.current;
    setStatus('working');
    setProgress(0);
    // Two frames so the bar paints at 0% before animating.
    // Only advance from 0: fast exports can finish (100%) before these frames run.
    requestAnimationFrame(() => requestAnimationFrame(() => runId.current === id && setProgress((p) => (p === 0 ? 85 : p))));

    if (req.format === 'pdf') {
      // Printing needs the user's click; the button below is active right away.
      window.setTimeout(() => {
        if (runId.current !== id) return;
        setProgress(100);
        setStatus('ready');
      }, 450);
      return;
    }

    try {
      await req.run();
      if (runId.current !== id) return;
      setProgress(100);
      setStatus('done');
    } catch (err) {
      console.error(`Export (${req.format}) failed`, err);
      if (runId.current === id) setStatus('error');
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!request) {
      runId.current++;
      if (dialog.open) dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
    void start(request);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  useEffect(() => {
    if (status !== 'working') actionRef.current?.focus();
  }, [status]);

  function printNow() {
    if (!request) return;
    dialogRef.current?.close();
    void request.run();
  }

  const fileLabel = request?.format === 'docx' ? 'Word (.docx)' : request?.format === 'xlsx' ? 'Excel (.xlsx)' : 'PDF';
  const message: Record<Status, string> = {
    working: `Building your ${fileLabel} file on this device…`,
    ready: 'Ready. Choose “Save as PDF” as the destination in the print dialog.',
    done: `Download started. Check your Downloads folder for the ${fileLabel} file.`,
    error: `The ${fileLabel} file could not be created. Please try again.`,
  };

  const primary = 'inline-flex h-11 w-full items-center justify-center gap-2 rounded-control px-5 font-semibold';

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="export-modal-title"
      aria-describedby="export-modal-status"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-panel border border-line bg-page p-0 text-ink shadow-[0_8px_24px_rgb(26_31_36/0.12)] backdrop:bg-[rgb(17_20_23/0.6)]"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="export-modal-title" className="text-xl/[1.3] font-bold">
            {request?.title}
            {status === 'working' ? '…' : ''}
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="-mr-2 -mt-1 rounded-control p-1.5 text-ink transition-colors hover:bg-surface"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
              <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <p
          id="export-modal-status"
          aria-live="polite"
          className={`mt-4 ${status === 'error' ? 'text-error' : 'text-ink-2'}`}
        >
          {message[status]}
        </p>
        <div
          role="progressbar"
          aria-label="Export progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="mt-3 h-2 overflow-hidden bg-line"
        >
          <div
            className={`h-full bg-green transition-[width] ease-out motion-reduce:transition-none ${
              progress === 100 ? 'duration-200' : 'duration-700'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {status === 'ready' && (
            <button ref={actionRef} type="button" onClick={printNow} className={`${primary} btn-primary`}>
              Open Print / Save as PDF
            </button>
          )}
          {status === 'done' && (
            <>
              <button
                ref={actionRef}
                type="button"
                onClick={() => dialogRef.current?.close()}
                className={`${primary} btn-primary`}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => request && void start(request)}
                className="py-2 text-link underline underline-offset-[3px] hover:decoration-2"
              >
                Didn’t start? Download again
              </button>
            </>
          )}
          {status === 'error' && (
            <button ref={actionRef} type="button" onClick={() => request && void start(request)} className={`${primary} btn-primary`}>
              Try again
            </button>
          )}
          {status === 'working' && (
            <button type="button" disabled className={`${primary} cursor-wait border-2 border-line text-muted`}>
              Preparing…
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
