import React, { useState } from 'react';

interface Props {
  bibtex: string;
  title: string;
}

export default function BibtexButton({ bibtex, title }: Props) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(bibtex.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        type="button"
        className="text-xs font-mono text-zinc-500 hover:text-zinc-200 transition-colors underline-offset-4 cursor-pointer"
        title="View & copy BibTeX citation"
      >
        [bibtex]
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl p-5 rounded-lg border border-border/70 bg-card text-left shadow-2xl flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <span className="font-mono text-xs text-zinc-300">BibTeX Citation</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2.5 py-1 rounded text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition cursor-pointer"
                >
                  {copied ? 'copied!' : 'copy to clipboard'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-2 py-1 rounded text-xs font-mono text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                >
                  &times;
                </button>
              </div>
            </div>

            <pre className="p-3 rounded bg-zinc-950/80 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto select-all leading-relaxed whitespace-pre-wrap">
              {bibtex.trim()}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
