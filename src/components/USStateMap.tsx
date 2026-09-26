import { useRef, useState, type PointerEvent } from 'react';
import { formatStateRate, STATES, STATES_BY_CODE, type StateCode, type TaxStructure } from '../lib/state-tax-data';
import { US_MAP_VIEWBOX, US_STATE_PATHS } from '../lib/us-state-paths';

interface Props {
  selected: StateCode | null;
  onSelect: (code: StateCode) => void;
  /** Externally highlighted state (e.g. hovering a directory card). */
  highlighted?: StateCode | null;
  /** Dims every state whose structure differs. */
  filter?: TaxStructure | null;
}

/** Small eastern states get labelled chips to the right of the map so they are easy to hit. */
const CALLOUTS: StateCode[] = ['VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD', 'DC'];
const CHIP = { x: 992, y0: 70, step: 34, w: 60, h: 27 };
const VIEW_WIDTH = CHIP.x + CHIP.w + 8;

const FILL: Record<TaxStructure, string> = {
  none: 'fill-emerald-200 dark:fill-emerald-900',
  flat: 'fill-sky-200 dark:fill-sky-900',
  graduated: 'fill-slate-200 dark:fill-slate-700',
};
const FILL_HOVER: Record<TaxStructure, string> = {
  none: 'fill-emerald-300 dark:fill-emerald-800',
  flat: 'fill-sky-300 dark:fill-sky-800',
  graduated: 'fill-slate-300 dark:fill-slate-600',
};
const FILL_SELECTED = 'fill-emerald-600 dark:fill-emerald-500';

export const MAP_LEGEND: { structure: TaxStructure; label: string; swatch: string }[] = [
  { structure: 'none', label: 'No income tax', swatch: 'bg-emerald-200 dark:bg-emerald-900' },
  { structure: 'flat', label: 'Flat tax', swatch: 'bg-sky-200 dark:bg-sky-900' },
  { structure: 'graduated', label: 'Progressive', swatch: 'bg-slate-200 dark:bg-slate-700' },
];

export default function USStateMap({ selected, onSelect, highlighted = null, filter = null }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ code: StateCode; x: number; y: number } | null>(null);

  function track(code: StateCode, e: PointerEvent) {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    setHover({ code, x: e.clientX - box.left, y: e.clientY - box.top });
  }

  const hot = hover?.code ?? highlighted;

  function fillFor(code: StateCode) {
    const { structure } = STATES_BY_CODE[code];
    if (code === selected) return FILL_SELECTED;
    const dim = filter && structure !== filter && code !== hot ? ' opacity-25' : '';
    return (code === hot ? FILL_HOVER[structure] : FILL[structure]) + dim;
  }

  const handlers = (code: StateCode) => ({
    onPointerEnter: (e: PointerEvent) => track(code, e),
    onPointerMove: (e: PointerEvent) => track(code, e),
    onPointerLeave: () => setHover((h) => (h?.code === code ? null : h)),
    onClick: () => onSelect(code),
  });

  const tip = hover ? STATES_BY_CODE[hover.code] : null;
  // Keep the centred tooltip inside the map horizontally.
  const width = wrapRef.current?.clientWidth ?? 0;
  const tipLeft = hover ? Math.min(Math.max(hover.x, 110), Math.max(110, width - 110)) : 0;

  return (
    <div ref={wrapRef} className="relative select-none">
      {/* Mouse/touch convenience only; keyboard and screen reader users pick a state with the StateSelect combobox. */}
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${US_MAP_VIEWBOX.height}`}
        className="h-auto w-full"
        aria-hidden="true"
        focusable="false"
      >
        <g className="stroke-white dark:stroke-slate-950" strokeWidth={0.8} strokeLinejoin="round">
          {STATES.map(({ code }) => (
            <path
              key={code}
              d={US_STATE_PATHS[code].d}
              className={`cursor-pointer transition-[fill,opacity] duration-150 ${fillFor(code)}`}
              {...handlers(code)}
            />
          ))}
        </g>

        {CALLOUTS.map((code, i) => {
          const y = CHIP.y0 + i * CHIP.step;
          const { cx, cy } = US_STATE_PATHS[code];
          const isSelected = code === selected;
          return (
            <g key={code} className="cursor-pointer" {...handlers(code)}>
              <line
                x1={cx}
                y1={cy}
                x2={CHIP.x}
                y2={y + CHIP.h / 2}
                className="stroke-slate-300 dark:stroke-slate-600"
                strokeWidth={0.8}
              />
              <rect
                x={CHIP.x}
                y={y}
                width={CHIP.w}
                height={CHIP.h}
                rx={4}
                className={`transition-[fill,opacity] duration-150 ${fillFor(code)} ${
                  isSelected ? 'stroke-emerald-700 dark:stroke-emerald-300' : 'stroke-white dark:stroke-slate-950'
                }`}
              />
              <text
                x={CHIP.x + CHIP.w / 2}
                y={y + CHIP.h / 2}
                dominantBaseline="central"
                textAnchor="middle"
                className={`pointer-events-none font-mono text-[15px] font-semibold ${
                  isSelected ? 'fill-white dark:fill-slate-950' : 'fill-slate-700 dark:fill-slate-200'
                }`}
              >
                {code}
              </text>
            </g>
          );
        })}
      </svg>

      {tip && hover && (
        <div
          role="presentation"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-white dark:text-slate-900"
          style={{ left: tipLeft, top: hover.y - 10 }}
        >
          {tip.name}: {formatStateRate(tip)}
        </div>
      )}
    </div>
  );
}
