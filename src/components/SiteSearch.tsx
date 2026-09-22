import { useEffect, useMemo, useRef, useState } from 'react';
import type { SearchEntry } from '../lib/search';

interface Props {
  entries: SearchEntry[];
}

const MAX_RESULTS = 12;

function rank(entry: SearchEntry, q: string): number {
  if (!q) return 0;
  const title = entry.title.toLowerCase();
  const blurb = entry.blurb.toLowerCase();
  const tags = entry.tags.join(' ').toLowerCase();
  const meta = entry.meta.toLowerCase();
  if (title.startsWith(q)) return 5;
  if (title.includes(q)) return 4;
  if (tags.includes(q)) return 3;
  if (blurb.includes(q)) return 2;
  if (meta.includes(q)) return 1;
  return 0;
}

export default function SiteSearch({ entries }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as SearchEntry[];
    return entries
      .map((e) => ({ e, s: rank(e, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.e.title.localeCompare(b.e.title))
      .slice(0, MAX_RESULTS)
      .map((x) => x.e);
  }, [entries, query]);

  // global shortcuts: ⌘k/ctrl+k toggles, '/' opens, escape closes anywhere
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      } else if (e.key === '/' && !typing && !(e.metaKey || e.ctrlKey || e.altKey)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // focus the input only when opening; return focus to the button only after a
  // real open→close cycle (never on mount, so navigation can't flash a ring)
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      document.body.style.overflow = '';
      if (wasOpen.current) {
        wasOpen.current = false;
        buttonRef.current?.focus();
      }
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(results.length - 1, 0)));
  }, [results]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-row="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  // clicking or tabbing outside the panel (or into non-focusable space) closes
  function onPanelBlur(e: React.FocusEvent<HTMLDivElement>) {
    const next = e.relatedTarget as Node | null;
    if (next && panelRef.current?.contains(next)) return;
    setOpen(false);
  }

  function go(entry: SearchEntry) {
    setOpen(false);
    if (entry.external) window.open(entry.url, '_blank', 'noreferrer');
    else window.location.assign(entry.url);
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[active];
      if (hit) go(hit);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type='button'
        onClick={() => setOpen(true)}
        aria-label='Search the site'
        aria-haspopup='dialog'
        aria-expanded={open}
        title='Search (⌘K or Ctrl+K)'
        className='flex items-center justify-center gap-1.5 h-9 rounded-full border transition-colors duration-200 bg-[#e2ded7] border-[#d4ceca] text-[#111111] dark:bg-[#18181b] dark:border-[#27272a] dark:text-[#fafafa] px-3'
      >
        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
          <circle cx='11' cy='11' r='7' />
          <line x1='21' y1='21' x2='16.65' y2='16.65' />
        </svg>
        <kbd className='hidden md:inline font-mono text-[10px] opacity-60' aria-hidden='true'>⌘K</kbd>
      </button>

      {open && (
        <div className='search-overlay' role='dialog' aria-modal='true' aria-label='Site search'>
          <div className='search-backdrop' onClick={() => setOpen(false)} />
          <div ref={panelRef} className='search-panel' onBlur={onPanelBlur}>
            <div className='search-bar'>
              <svg className='w-6 h-6 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
                <circle cx='11' cy='11' r='7' />
                <line x1='21' y1='21' x2='16.65' y2='16.65' />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder='search research, projects, thoughts…'
                aria-label='Search query'
                className='search-input'
                spellCheck={false}
                autoComplete='off'
              />
              <button type='button' onClick={() => setOpen(false)} className='search-kbd shrink-0' aria-label='Close search'>
                esc
              </button>
            </div>

            <div ref={listRef} className='search-results'>
              {results.length === 0 ? (
                <div className='search-empty'>
                  {query.trim() ? `no matches for “${query.trim()}”` : 'type to search everything on the site'}
                </div>
              ) : (
                results.map((r, i) => (
                  <button
                    key={`${r.type}-${r.title}-${i}`}
                    type='button'
                    data-row={i}
                    data-active={active === i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r)}
                    className='search-row'
                  >
                    <span className='search-type'>{r.type}</span>
                    <span className='min-w-0'>
                      <span className='search-row-title'>{r.title}</span>
                      <span className='search-row-blurb'>{r.blurb}</span>
                    </span>
                    <span className='search-row-meta'>{r.meta}</span>
                  </button>
                ))
              )}
            </div>

            <div className='search-footer'>
              <span>↑↓ navigate · ↵ open · esc close</span>
              <span>{results.length} results</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}