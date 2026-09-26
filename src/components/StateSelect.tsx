import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { formatStateRate, STATES, STATES_BY_CODE, type StateCode } from '../lib/state-tax-data';

interface Props {
  id: string;
  value: StateCode | null;
  onChange: (code: StateCode | null) => void;
  placeholder?: string;
  describedBy?: string;
}

/** Searchable state picker (ARIA 1.2 combobox with a listbox popup). Type a name or postal code. */
export default function StateSelect({ id, value, onChange, placeholder = 'Search your state…', describedBy }: Props) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState<string | null>(null); // null = not editing, show the selected name
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const options = useMemo(() => {
    const q = (query ?? '').trim().toLowerCase();
    if (!q) return STATES;
    return STATES.filter((s) => s.code.toLowerCase() === q || s.name.toLowerCase().includes(q));
  }, [query]);

  // Keep the highlighted option in view while arrowing through the list.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function openList() {
    setOpen(true);
    const i = value ? options.findIndex((s) => s.code === value) : 0;
    setActive(Math.max(0, i));
  }

  function choose(code: StateCode) {
    onChange(code);
    setQuery(null);
    setOpen(false);
  }

  function close() {
    setQuery(null);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) openList();
        else setActive((i) => Math.min(options.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (open) setActive((i) => Math.max(0, i - 1));
        break;
      case 'Home':
      case 'End':
        if (open) {
          e.preventDefault();
          setActive(e.key === 'Home' ? 0 : options.length - 1);
        }
        break;
      case 'Enter':
        if (open && options[active]) {
          e.preventDefault();
          choose(options[active].code);
        }
        break;
      case 'Escape':
        if (open || query !== null) {
          e.preventDefault();
          close();
        }
        break;
    }
  }

  const selected = value ? STATES_BY_CODE[value] : null;
  const activeId = open && options[active] ? `${listId}-${options[active].code}` : undefined;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-describedby={describedBy}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={query ?? selected?.name ?? ''}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={(e) => e.target.select()}
        onClick={() => !open && openList()}
        onBlur={close}
        onKeyDown={onKeyDown}
        className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-3.5 pr-16 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
      <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-2">
        {value && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Clear state"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange(null);
              inputRef.current?.focus();
            }}
            className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="m6 6 8 8M14 6l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <svg viewBox="0 0 20 20" className="pointer-events-none h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label="States"
        hidden={!open}
        className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900"
      >
        {options.length === 0 && <li className="px-3 py-2 text-slate-500 dark:text-slate-400">No matching state</li>}
        {options.map((s, i) => (
          <li
            key={s.code}
            id={`${listId}-${s.code}`}
            data-index={i}
            role="option"
            aria-selected={s.code === value}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(s.code)}
            className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 ${
              i === active ? 'bg-slate-100 dark:bg-slate-800' : ''
            } ${s.code === value ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}
          >
            <span>
              <span className="mr-2 inline-block w-6 font-mono text-xs text-slate-400">{s.code}</span>
              {s.name}
            </span>
            <span
              className={`shrink-0 text-xs ${
                s.structure === 'none' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {s.structure === 'none' ? 'No tax' : s.structure === 'flat' ? formatStateRate(s).replace(' Flat Tax', ' flat') : 'Progressive'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
