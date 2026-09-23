import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync.js';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { listWorkshops } from '../../services/workshopService.js';
import { EmptyState, ErrorState, Eyebrow, Skeleton } from '../../components/ui.jsx';
import { WorkshopCard } from '../../components/workshop.jsx';
import Icon from '../../components/Icon.jsx';

const MODES = [
  { value: '', label: 'All formats' },
  { value: 'OFFLINE', label: 'In person' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'HYBRID', label: 'Hybrid' },
];
const STATUSES = [
  { value: 'PUBLISHED', label: 'Open' },
  { value: 'CLOSED', label: 'Past & closed' },
  { value: '', label: 'All' },
];

function Pills({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`btn min-h-11 px-5 ${value === option.value ? 'btn-primary' : 'btn-secondary border-ink/20'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function WorkshopsPage() {
  useDocumentTitle('Workshops');
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') || '';
  const status = params.has('status') ? params.get('status') : 'PUBLISHED';
  const search = params.get('q') || '';
  const [query, setQuery] = useState(search);

  const setParam = (key, value) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.set(key, value);
        if (!value && key !== 'status') next.delete(key);
        return next;
      },
      { replace: true },
    );

  // Debounce typing into the URL (and therefore the request).
  useEffect(() => {
    const id = setTimeout(() => query !== search && setParam('q', query.trim()), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const { data, error, loading, reload } = useAsync(
    () => listWorkshops({ search, mode, status }),
    [search, mode, status],
  );

  return (
    <div className="relative overflow-hidden">
      <p className="ghost-text absolute -right-6 top-10 hidden md:block" aria-hidden="true">
        Catalogue
      </p>
      <div className="relative mx-auto max-w-[1280px] px-4 pt-12 md:px-8 md:pt-28">
        <Eyebrow>Workshops</Eyebrow>
        <h1 className="page-title mt-5 max-w-3xl">Find your next workshop</h1>
        <p className="mt-4 max-w-2xl text-[18px] text-charcoal">
          Hands-on sessions run by CICT. Register, attend at least 90% of sessions, and earn a verifiable certificate.
        </p>

        <div className="mt-12 space-y-5">
          <div className="relative max-w-xl">
            <label htmlFor="workshop-search" className="sr-only">
              Search workshops
            </label>
            <Icon name="search" className="absolute left-5 top-1/2 -translate-y-1/2 text-slate" />
            <input
              id="workshop-search"
              type="search"
              className="input !rounded-full pl-13"
              placeholder="Search by title or topic"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
            <Pills label="Format" options={MODES} value={mode} onChange={(v) => setParam('mode', v)} />
            <Pills label="Status" options={STATUSES} value={status} onChange={(v) => setParam('status', v)} />
          </div>
        </div>

        <div className="mt-12" aria-live="polite" aria-busy={loading}>
          {loading && (
            <div className="space-y-6" role="status">
              <span className="sr-only">Loading workshops…</span>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-8 border-t rule py-8">
                  <Skeleton className="h-24 w-24 !rounded-full" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-7 w-3/5" />
                    <Skeleton className="h-4 w-2/5" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && <ErrorState error={error} onRetry={reload} />}
          {data && data.length === 0 && (
            <EmptyState title="No workshops found" icon="search">
              {search || mode ? 'Try a different search or format.' : 'No workshops available yet. Check back soon.'}
            </EmptyState>
          )}
          {data && data.length > 0 && (
            <>
              <p className="mb-2 text-[15px] text-slate">
                {data.length} workshop{data.length === 1 ? '' : 's'}
              </p>
              <div className="border-b rule">
                {data.map((w) => (
                  <WorkshopCard key={w.id} workshop={w} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
