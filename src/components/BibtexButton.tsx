import { useId, useRef, useState } from 'react';

interface Props {
  bibtex: string;
  title: string;
}

export default function BibtexButton({ bibtex, title }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [message, setMessage] = useState('');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bibtex.trim());
      setMessage('copied to clipboard');
    } catch {
      setMessage('select the citation below to copy it');
    }
  };

  return (
    <>
      <button type='button' className='ink-bleed-link font-mono text-xs py-2' onClick={() => {
        setMessage('');
        dialogRef.current?.showModal();
      }}>[bibtex]</button>
      <dialog ref={dialogRef} className='citation-dialog' aria-labelledby={headingId} onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialogRef.current?.close();
      }}>
        <div className='flex items-start justify-between gap-6'>
          <h2 id={headingId} className='font-medium text-base'>BibTeX citation</h2>
          <button type='button' className='ink-bleed-link font-mono text-xs p-2' aria-label='Close citation' onClick={() => dialogRef.current?.close()}>close ×</button>
        </div>
        <p className='text-sm text-muted-foreground mt-3'>{title}</p>
        <pre className='mt-5 p-4 bg-muted border border-border text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-words select-all'>{bibtex.trim()}</pre>
        <div className='flex flex-wrap items-center gap-4 mt-5'>
          <button type='button' onClick={handleCopy} className='ink-bleed-link font-mono text-xs py-2'>copy citation ↗</button>
          <span role='status' className='text-xs text-muted-foreground'>{message}</span>
        </div>
      </dialog>
    </>
  );
}
