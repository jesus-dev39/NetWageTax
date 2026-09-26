/**
 * save-blob.ts
 * Descarga un Blob generado en el navegador con un único mecanismo para Word y Excel.
 *
 * El <a download> se inserta dentro del <dialog> abierto (si lo hay): con un modal
 * abierto el resto del documento es `inert`, y un enlace inerte no se activa. Usar un
 * solo camino evita además que SheetJS y FileSaver compitan por `window.saveAs`.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  const host = document.querySelector('dialog[open]') ?? document.body;
  host.appendChild(a);
  a.click();
  a.remove();
  // Give the browser time to start reading the blob before releasing it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
