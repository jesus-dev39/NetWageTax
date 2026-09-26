/**
 * xlsx-sheet.ts
 * Pequeño constructor de hojas para los exports .xlsx (SheetJS). Mantiene los
 * importes como números reales (con formato de moneda/porcentaje) para que el
 * usuario pueda sumar y filtrar en Excel, y admite fórmulas para los totales.
 * Se importa solo desde los builders cargados de forma dinámica.
 */

import type { WorkSheet } from 'xlsx';
import { utils } from 'xlsx';

export const FMT_USD = '"$"#,##0.00;[Red]-"$"#,##0.00';
export const FMT_PCT = '0.0%';

export type Cell =
  | string
  | number
  | null
  | { v: number; z?: string; f?: string }
  | { v: string; merge?: number };

/** Currency cell. */
export const usd = (v: number, f?: string): Cell => ({ v: Math.round(v * 100) / 100, z: FMT_USD, f });
/** Percentage cell (0–1). */
export const pctCell = (v: number): Cell => ({ v, z: FMT_PCT });
/** Text spanning `merge` columns (title rows, notes). */
export const wide = (v: string, merge: number): Cell => ({ v, merge });

/** Rows → worksheet with number formats, formulas, merges, and column widths. */
export function buildSheet(rows: Cell[][], colWidths: number[]): WorkSheet {
  const ws = utils.aoa_to_sheet(rows.map((r) => r.map((c) => (c && typeof c === 'object' ? c.v : c))));
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

  rows.forEach((row, r) =>
    row.forEach((c, col) => {
      if (!c || typeof c !== 'object') return;
      const ref = utils.encode_cell({ r, c: col });
      if ('z' in c && c.z) ws[ref].z = c.z;
      if ('f' in c && c.f) ws[ref].f = c.f;
      if ('merge' in c && c.merge && c.merge > 1) merges.push({ s: { r, c: col }, e: { r, c: col + c.merge - 1 } });
    }),
  );

  ws['!merges'] = merges;
  ws['!cols'] = colWidths.map((wch) => ({ wch }));
  return ws;
}

/** Excel address helper: col 0, row 0 → "A1". */
export const addr = (r: number, c: number) => utils.encode_cell({ r, c });
