import { useEffect, useMemo, useState } from 'react';

interface ThoughtItem {
  id: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  url: string;
}

interface Props {
  posts: ThoughtItem[];
}

type SortOrder = 'newest' | 'oldest';

export default function ThoughtsArchive({ posts }: Props) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [order, setOrder] = useState<SortOrder>('newest');

  useEffect(() => {
    const preselect = new URLSearchParams(window.location.search).get('tag');
    if (preselect) setTag(preselect);
  }, []);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) {
      for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [posts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = posts;
    if (tag) list = list.filter((p) => p.tags.includes(tag));
    if (q) {
      list = list.filter((p) =>
        [p.title, p.summary, ...p.tags].join(' ').toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) =>
      order === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date),
    );
  }, [posts, query, tag, order]);

  return (
    <div className='space-y-10'>
      <div className='space-y-4'>
        <div className='flex flex-wrap items-center gap-4'>
          <input
            type='search'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='search thoughts, tags, topics…'
            aria-label='Search thoughts'
            className='thought-search'
            spellCheck={false}
          />
          <button
            type='button'
            onClick={() => setOrder(order === 'newest' ? 'oldest' : 'newest')}
            className='ink-bleed-link font-mono text-xs shrink-0'
            aria-label='Toggle sort order'
          >
            {order === 'newest' ? 'newest first ↓' : 'oldest first ↑'}
          </button>
        </div>

        <div className='flex flex-wrap gap-2' aria-label='Filter by tag'>
          <button
            type='button'
            aria-pressed={tag === null}
            onClick={() => setTag(null)}
            className='project-tag'
          >
            all ({posts.length})
          </button>
          {allTags.map(([t, count]) => (
            <button
              key={t}
              type='button'
              aria-pressed={tag === t}
              onClick={() => setTag(tag === t ? null : t)}
              className='project-tag'
            >
              {t} ({count})
            </button>
          ))}
        </div>

        <p className='font-mono text-xs text-muted-foreground' aria-live='polite'>
          {filtered.length} of {posts.length}
        </p>
      </div>

      <div className='space-y-8'>
        {filtered.length === 0 ? (
          <p className='text-sm text-muted-foreground font-mono'>
            no matches for “{query.trim()}”
            {tag ? ` in #${tag}` : ''}
          </p>
        ) : (
          filtered.map((post) => (
            <article key={post.id} className='space-y-2 border-b border-border/40 pb-6 last:border-0'>
              <div className='flex flex-wrap items-baseline justify-between gap-4'>
                <h2 className='text-xl font-medium text-foreground'>
                  <a href={post.url} className='ink-bleed-link'>
                    {post.title}
                  </a>
                </h2>
                <span className='font-mono text-xs text-muted-foreground whitespace-nowrap'>
                  {post.date}
                </span>
              </div>

              <p className='text-sm text-muted-foreground leading-relaxed'>{post.summary}</p>

              <div className='flex flex-wrap gap-5 items-center justify-between pt-3'>
                <div className='flex flex-wrap items-center gap-2'>
                  {post.tags.map((t) => (
                    <button
                      key={t}
                      type='button'
                      aria-pressed={tag === t}
                      onClick={() => setTag(tag === t ? null : t)}
                      className='project-tag'
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <a href={post.url} className='ink-bleed-link text-xs font-mono'>
                  read note &rarr;
                </a>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}