import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';

import { BIBTEX } from '../components/about/AboutContent';
import { EmptyState, NoResultsIcon } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { Skeleton } from '../components/ui/Skeleton';
import { useDatasets, type Dataset } from '../hooks/useDatasets';
import type { CohortSummary } from '../hooks/useCohortSummary';
import { apiPaths } from '../api/paths';
import { bundleSizesUrl, bundleUrl, fullBundleUrl } from '../lib/bundleUrls';
import { COHORT_FULL_NAMES } from '../data/cohortNames';
import { ORGAN_SYSTEMS, ORGAN_BY_ID, CANCER_TYPES, typeKey, type OrganId } from '../data/organSystems';

const sentenceCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

interface CohortRow extends CohortSummary {
  dataset: string;
  source: string;
  code: string;
  title: string;
  isPan: boolean;
  types: string[];
  organs: OrganId[];
  version: string;
  /** Size of the downloadable results bundle; 0 until known. */
  bundleBytes: number;
}

type SortOption = 'slides' | 'name' | 'type' | 'source' | 'updated';

const SORT_LABELS: Record<SortOption, string> = {
  slides: 'Most slides',
  name: 'Name (A–Z)',
  type: 'Cancer type',
  source: 'Source',
  updated: 'Recently updated',
};

const COMPARATORS: Record<SortOption, (a: CohortRow, b: CohortRow) => number> = {
  slides: (a, b) => b.slideCount - a.slideCount,
  name: (a, b) => a.code.localeCompare(b.code),
  // Pan-cancer cohorts first, then alphabetical by cancer type.
  type: (a, b) =>
    Number(b.isPan) - Number(a.isPan) || a.title.localeCompare(b.title) || a.source.localeCompare(b.source),
  source: (a, b) => a.source.localeCompare(b.source) || b.slideCount - a.slideCount,
  updated: (a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || b.slideCount - a.slideCount,
};

const formatSize = (bytes: number) =>
  bytes === 0 ? '…' : `${(bytes / 1e6).toFixed(bytes < 1e7 ? 1 : 0)} MB`;

const formatDate = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

function dataVersion(c: CohortSummary): string {
  const fingerprint = `${c.slideCount}:${c.featureCount}:${c.clusterCount}`;
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    hash = ((hash << 5) - hash + fingerprint.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).padStart(7, '0').slice(0, 7);
}

function toRows(datasets: Dataset[], summaries: (CohortSummary[] | undefined)[]): CohortRow[] {
  return datasets.flatMap((ds, i) => {
    const cohorts = summaries[i] ?? [];
    const datasetTypes = cohorts.filter((c) => c.id !== 'PANCAN').map((c) => typeKey(c.id));
    return cohorts.map((c) => {
      const isPan = c.id === 'PANCAN';
      const types = isPan ? datasetTypes : [typeKey(c.id)];
      const organs = [...new Set(types.flatMap((t) => CANCER_TYPES[t]?.organ ?? []))];
      return {
        ...c,
        dataset: ds.id,
        source: ds.displayName,
        code: `${ds.displayName}-${c.id}`,
        title: isPan ? 'Pan-cancer' : sentenceCase(COHORT_FULL_NAMES[c.id] ?? c.name),
        isPan,
        types,
        organs,
        version: dataVersion(c),
        bundleBytes: 0,
      };
    });
  });
}

/** Merge cohort summaries from every dataset into a flat list of rows. */
function useAllCohorts(datasets: Dataset[] | undefined) {
  // `combine` gives a structurally-stable result so downstream memos don't re-fire every render.
  return useQueries({
    queries: (datasets ?? []).map((ds) => ({
      queryKey: ['cohorts', ds.id, 'summary'] as const,
      queryFn: async () => {
        const res = await fetch(apiPaths.cohortSummary(ds.id));
        if (!res.ok) throw new Error(`Failed to load cohort summaries for ${ds.id}`);
        return res.json() as Promise<CohortSummary[]>;
      },
      staleTime: Infinity,
      gcTime: Infinity,
    })),
    combine: (results) => ({
      data: datasets ? toRows(datasets, results.map((q) => q.data)) : [],
      isLoading: !datasets || results.some((q) => q.isLoading),
      error: results.find((q) => q.error)?.error ?? null,
    }),
  });
}

function toggleIn(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(id)) next.add(id);
  return next;
}

function OrganDot({ organ }: { organ: OrganId }) {
  return <span className={`w-2 h-2 rounded-full shrink-0 ${ORGAN_BY_ID[organ].dot}`} />;
}

function CopyBibtexButton({ className }: { className: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        navigator.clipboard.writeText(BIBTEX).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
    >
      <Icon name={copied ? 'check' : 'clipboard'} size={13} />
      {copied ? 'Copied' : 'Copy BibTeX'}
    </button>
  );
}

function FilterCheckbox({
  label,
  sub,
  count,
  checked,
  onChange,
}: {
  label: string;
  sub: string;
  count: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="grid grid-cols-[15px_minmax(0,1fr)_auto] gap-2.5 items-start px-2 py-2 md:py-1.5 -mx-2 rounded-md cursor-pointer hover:bg-zinc-100">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 w-[15px] h-[15px] accent-blue-600" />
      <span className="min-w-0">
        <span className="block text-zinc-900">{label}</span>
        <span className="block text-[11.5px] text-zinc-500">{sub}</span>
      </span>
      <span className="tabular-nums text-zinc-600 text-xs">{count.toLocaleString()}</span>
    </label>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-4 border-l border-zinc-200">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-zinc-900">{value.toLocaleString()}</dd>
    </div>
  );
}

function CohortRowLink({ row }: { row: CohortRow }) {
  const organLabel = row.isPan ? `${row.organs.length} organ systems` : ORGAN_BY_ID[row.organs[0]]?.label;
  return (
    <a
      href={`/${row.dataset}/${row.id}/atlas/`}
      aria-label={`${row.code}, ${row.title}, ${row.slideCount.toLocaleString()} slides`}
      className="flex-1 min-w-0 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_84px_108px] gap-x-5 items-center min-h-[58px] pl-4 pr-4 md:pr-5 py-2.5 focus-ring"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <span className="flex md:hidden">
            {row.isPan ? <span className="block w-2 h-2 rounded-full bg-zinc-500" /> : <OrganDot organ={row.organs[0]} />}
          </span>
          <span className="truncate">{row.title}</span>
        </div>
        <div className="text-xs text-zinc-600 truncate">
          <span className="text-zinc-700 font-medium">{row.code}</span>
          {row.isPan && ` · ${row.types.length} cancer types`}
          {` · ${row.patientCount.toLocaleString()} patients`}
          <span className="hidden md:inline"> · {row.clusterCount} clusters</span>
          <span className="md:hidden"> · {formatSize(row.bundleBytes)}</span>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-2 min-w-0">
        <span className="flex gap-0.5 shrink-0">
          {row.organs.map((o) => <OrganDot key={o} organ={o} />)}
        </span>
        <span className="text-xs text-zinc-600 truncate">{organLabel}</span>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold tabular-nums text-zinc-900">{row.slideCount.toLocaleString()}</div>
        <div className="text-[11.5px] text-zinc-500">slides</div>
      </div>
      <div
        className="hidden md:block text-right"
        title={`Results data · version v${row.version} · updated ${formatDate(row.updatedAt)}`}
      >
        <div className="tabular-nums text-zinc-700">{formatSize(row.bundleBytes)}</div>
        <div className="text-[11.5px] text-zinc-500 tabular-nums">{formatDate(row.updatedAt)}</div>
      </div>
    </a>
  );
}

function DownloadButton({ row }: { row: CohortRow }) {
  const size = formatSize(row.bundleBytes);
  return (
    <div className="relative hidden md:flex items-center pr-4">
      <a
        href={bundleUrl(row.dataset, row.id)}
        download={`histoatlas_${row.dataset}_${row.id}.zip`}
        aria-label={`Download ${row.code} results, ${size}`}
        onClick={() => window.posthog?.capture('bundle_downloaded', { dataset: row.dataset, cohort: row.id })}
        className="peer w-8 h-8 flex items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 cursor-pointer hover:text-zinc-900 hover:border-zinc-500 focus-ring"
      >
        <Icon name="download" size={15} />
      </a>
      <span
        role="tooltip"
        className="hidden peer-hover:block peer-focus-visible:block absolute right-14 top-1/2 -translate-y-1/2 z-10 bg-zinc-900 text-zinc-50 text-xs px-2.5 py-1.5 rounded-md whitespace-nowrap pointer-events-none"
      >
        Results bundle · {size}
      </span>
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between min-h-[58px] px-4 border-b border-zinc-100 last:border-b-0">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

export function CohortListing() {
  const { data: datasets } = useDatasets();
  const { data: cohortRows, isLoading, error } = useAllCohorts(datasets);
  const { data: sizes } = useQuery<Record<string, number>>({
    queryKey: ['bundle-sizes'],
    queryFn: () => fetch(bundleSizesUrl).then((res) => res.json()),
    staleTime: Infinity,
  });
  const rows = useMemo(
    () => cohortRows.map((r) => ({ ...r, bundleBytes: sizes?.[`${r.dataset}/${r.id}`] ?? 0 })),
    [cohortRows, sizes],
  );
  const [sort, setSort] = useState<SortOption>('slides');
  const [selectedDatasets, setSelectedDatasets] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [typeQuery, setTypeQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);

  // Lock body scroll and close on Escape while the mobile filter sheet is open
  useEffect(() => {
    if (!sheetOpen) return;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKey);
    };
  }, [sheetOpen]);

  // Per cancer type: total slides and the cohort codes that carry it
  const typeStats = useMemo(() => {
    const stats = new Map<string, { slides: number; codes: string[] }>();
    for (const r of rows) {
      if (r.isPan) continue;
      const s = stats.get(r.types[0]) ?? { slides: 0, codes: [] };
      s.slides += r.slideCount;
      s.codes.push(`${r.source} ${r.id}`);
      stats.set(r.types[0], s);
    }
    return stats;
  }, [rows]);

  const visibleRows = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            (selectedDatasets.size === 0 || selectedDatasets.has(r.dataset)) &&
            (selectedTypes.size === 0 || r.types.some((t) => selectedTypes.has(t))),
        )
        .sort(COMPARATORS[sort]),
    [rows, selectedDatasets, selectedTypes, sort],
  );

  const query = typeQuery.trim().toLowerCase();
  const groups = ORGAN_SYSTEMS.map((organ) => {
    const all = [...typeStats.keys()].filter((t) => CANCER_TYPES[t]?.organ === organ.id);
    const items = all
      .filter(
        (t) =>
          !query ||
          [t, CANCER_TYPES[t].label, COHORT_FULL_NAMES[t], organ.label, ...typeStats.get(t)!.codes]
            .join(' ')
            .toLowerCase()
            .includes(query),
      )
      .sort((a, b) => CANCER_TYPES[a].label.localeCompare(CANCER_TYPES[b].label));
    return {
      ...organ,
      items,
      slides: all.reduce((sum, t) => sum + typeStats.get(t)!.slides, 0),
      selected: items.filter((t) => selectedTypes.has(t)).length,
      // Searching expands every group that has a match
      expanded: query !== '' || openGroups.has(organ.id),
    };
  }).filter((g) => g.items.length > 0);

  const totalSlides = datasets?.reduce((sum, d) => sum + d.slideCount, 0) ?? 0;
  const activeFilterCount = selectedDatasets.size + selectedTypes.size;
  const clearAll = () => {
    setSelectedDatasets(new Set());
    setSelectedTypes(new Set());
  };

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="text-red-600 text-lg font-medium mb-2">Failed to load cohorts</div>
          <div className="text-zinc-500 text-sm mb-4">{(error as Error).message}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const chips = [
    ...(datasets ?? [])
      .filter((d) => selectedDatasets.has(d.id))
      .map((d) => ({
        key: `d:${d.id}`,
        label: d.displayName,
        organ: undefined as OrganId | undefined,
        remove: () => setSelectedDatasets((s) => toggleIn(s, d.id)),
      })),
    ...[...selectedTypes].map((t) => ({
      key: `t:${t}`,
      label: CANCER_TYPES[t].label,
      organ: CANCER_TYPES[t].organ as OrganId | undefined,
      remove: () => setSelectedTypes((s) => toggleIn(s, t)),
    })),
  ];

  const chipList = chips.length > 0 && (
    <div className="flex gap-1.5 flex-wrap">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.remove}
          aria-label={`Remove filter ${c.label}`}
          className="flex items-center gap-1.5 h-6 pl-2 pr-1.5 rounded-full border border-zinc-200 bg-white text-zinc-700 text-xs cursor-pointer hover:border-zinc-500"
        >
          {c.organ && <OrganDot organ={c.organ} />}
          {c.label}
          <Icon name="x" size={12} className="text-zinc-600" />
        </button>
      ))}
    </div>
  );

  const filters = (
    <div className="flex flex-col gap-4 text-[13px]">
      <fieldset className="flex flex-col gap-0.5">
        <legend className="mb-1.5 text-[11px] font-semibold tracking-wide uppercase text-zinc-500">Source</legend>
        {(datasets ?? []).map((d) => (
          <FilterCheckbox
            key={d.id}
            label={d.displayName}
            sub={d.description}
            count={d.slideCount}
            checked={selectedDatasets.has(d.id)}
            onChange={() => setSelectedDatasets((s) => toggleIn(s, d.id))}
          />
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-0.5">
        <legend className="mb-2 text-[11px] font-semibold tracking-wide uppercase text-zinc-500">
          Cancer type · by organ system
        </legend>
        <label className="relative flex items-center mb-1.5 text-zinc-500">
          <span className="absolute left-2.5 flex"><Icon name="search" size={13} /></span>
          <input
            type="search"
            aria-label="Search cancer types"
            placeholder={`Search ${typeStats.size} cancer types`}
            value={typeQuery}
            onChange={(e) => setTypeQuery(e.target.value)}
            className="w-full h-9 md:h-8 border border-zinc-200 rounded-md bg-white text-zinc-900 pl-7 pr-2 text-xs placeholder:text-zinc-500"
          />
        </label>
        {groups.map((g) => (
          <div key={g.id}>
            <button
              type="button"
              onClick={() => setOpenGroups((s) => toggleIn(s, g.id))}
              aria-expanded={g.expanded}
              className="w-[calc(100%+16px)] -mx-2 grid grid-cols-[14px_8px_minmax(0,1fr)_auto_auto] gap-2 items-center px-2 py-2.5 md:py-1.5 rounded-md text-zinc-900 text-left cursor-pointer hover:bg-zinc-100"
            >
              <Icon name={g.expanded ? 'chevron-down' : 'chevron-right'} size={14} className="text-zinc-600" />
              <OrganDot organ={g.id} />
              <span className="font-medium">{g.label}</span>
              <span className="text-[11.5px] text-blue-700">{g.selected > 0 && `${g.selected} selected`}</span>
              <span className="tabular-nums text-zinc-600 text-xs">{g.slides.toLocaleString()}</span>
            </button>
            {g.expanded && (
              <div className="pt-0.5 pb-1.5 pl-[22px]">
                {g.items.map((t) => (
                  <FilterCheckbox
                    key={t}
                    label={CANCER_TYPES[t].label}
                    sub={typeStats.get(t)!.codes.join(' · ')}
                    count={typeStats.get(t)!.slides}
                    checked={selectedTypes.has(t)}
                    onChange={() => setSelectedTypes((s) => toggleIn(s, t))}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        {!isLoading && groups.length === 0 && (
          <div className="text-xs text-zinc-500 py-1.5">No cancer type matches.</div>
        )}
      </fieldset>
    </div>
  );

  const sortSelect = (
    <select
      aria-label="Sort cohorts"
      value={sort}
      onChange={(e) => setSort(e.target.value as SortOption)}
      className="h-9 md:h-8 border border-zinc-200 rounded-md bg-white text-zinc-900 text-[13px] px-1.5 cursor-pointer"
    >
      {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([value, label]) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );

  const resultLabel = isLoading
    ? ''
    : activeFilterCount > 0
      ? `${visibleRows.length} of ${rows.length} cohorts`
      : `${rows.length} cohorts`;

  return (
    <div className="min-h-screen bg-zinc-50 text-[13px] text-zinc-900">
      {/* Intro band */}
      <section aria-label="About HistoAtlas" className="border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-5 grid lg:grid-cols-[minmax(0,1fr)_auto] gap-x-12 gap-y-4 items-start">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-lg md:text-[22px] leading-snug font-semibold">
              {isLoading ? (
                <Skeleton className="h-7 w-96 max-w-full" />
              ) : (
                `${totalSlides.toLocaleString()} H&E whole-slide images, organised into ${rows.length} cohorts`
              )}
            </h2>
            <p className="text-sm leading-relaxed text-zinc-600 max-w-[700px] text-pretty">
              Every cohort comes with slide-level morphology clusters, survival associations and molecular
              correlations, ready to explore or cite.
            </p>
            <div className="flex gap-4 mt-1">
              <a href="/methods/" className="text-blue-700 hover:underline">How the atlas is built →</a>
              <details className="relative">
                <summary className="list-none [&::-webkit-details-marker]:hidden text-blue-700 cursor-pointer hover:underline">
                  Cite the atlas
                </summary>
                <div className="absolute top-7 left-0 md:left-0 -translate-x-1/2 md:translate-x-0 z-20 w-[min(440px,calc(100vw-32px))] bg-white border border-zinc-200 rounded-lg shadow-lg p-3.5 flex flex-col gap-2.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Cite this work</span>
                    <span className="text-[11.5px] text-zinc-500">BibTeX</span>
                  </div>
                  <pre className="p-2.5 bg-zinc-100 border border-zinc-100 rounded-md font-mono text-[11.5px] leading-normal text-zinc-700 whitespace-pre-wrap break-words">
                    {BIBTEX}
                  </pre>
                  <div className="flex justify-end">
                    <CopyBibtexButton className="flex items-center gap-1.5 h-[30px] px-3 rounded-md bg-blue-600 text-white text-xs font-medium cursor-pointer hover:bg-blue-700" />
                  </div>
                </div>
              </details>
            </div>
          </div>
          {!isLoading && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <dl className="hidden sm:flex">
                <StatItem label="Slides" value={totalSlides} />
                <StatItem label="Cohorts" value={rows.length} />
                <StatItem label="Cancer types" value={typeStats.size} />
                <StatItem label="Sources" value={datasets?.length ?? 0} />
              </dl>
              <a
                href={fullBundleUrl}
                download="histoatlas.zip"
                onClick={() => window.posthog?.capture('bundle_downloaded', { dataset: 'all', cohort: 'all' })}
                className="flex items-center gap-2 h-[38px] px-4 rounded-md bg-blue-600 text-white font-medium text-[13.5px] hover:bg-blue-700 focus-ring"
              >
                <Icon name="download" size={15} />
                Download full atlas
                <span className="opacity-85 tabular-nums">{formatSize(sizes?.all ?? 0)}</span>
              </a>
            </div>
          )}
        </div>
      </section>

      <div className="max-w-7xl mx-auto md:px-6 md:grid md:grid-cols-[256px_minmax(0,1fr)] md:gap-7">
        <aside aria-label="Filters" className="hidden md:flex flex-col gap-4 pt-4 pb-8">
          <div className="flex items-center justify-between h-6">
            <h2 className="text-sm font-semibold">Filters</h2>
            {activeFilterCount > 0 && (
              <button type="button" onClick={clearAll} className="text-blue-700 text-xs cursor-pointer hover:underline">
                Clear all
              </button>
            )}
          </div>
          {filters}
        </aside>

        <div className="md:pt-4 pb-8 min-w-0 flex flex-col md:gap-2.5">
          {/* Toolbar: sticky filter bar on mobile */}
          <div className="sticky top-0 z-10 md:static flex items-center gap-2 md:gap-3 min-h-8 flex-wrap bg-zinc-50 border-b border-zinc-200 md:border-0 px-4 py-2 md:p-0">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="md:hidden flex items-center gap-1.5 h-9 px-3 rounded-md border border-zinc-200 bg-white text-[13px] font-medium cursor-pointer"
            >
              <Icon name="filter" size={14} />
              {activeFilterCount > 0 ? `Filters · ${activeFilterCount}` : 'Filters'}
            </button>
            <h2 className="flex-1 md:flex-none text-xs md:text-sm font-normal md:font-semibold text-zinc-600 md:text-zinc-900 tabular-nums">
              {resultLabel}
              {!isLoading && activeFilterCount === 0 && (
                <span className="hidden md:inline"> · {totalSlides.toLocaleString()} slides</span>
              )}
            </h2>
            <div className="hidden md:block">{chipList}</div>
            <div className="hidden md:block flex-1" />
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              <span className="hidden md:inline">Sort by</span>
              {sortSelect}
            </label>
          </div>

          {isLoading ? (
            <RowsSkeleton />
          ) : visibleRows.length === 0 ? (
            <EmptyState
              icon={<NoResultsIcon />}
              title="No cohorts match your filters"
              action={{ label: 'Clear filters', onClick: clearAll }}
            />
          ) : (
            <ul aria-label="Cohorts" className="bg-white md:border border-zinc-200 md:rounded-lg">
              {visibleRows.map((r) => (
                <li key={r.code} className="flex items-center border-b border-zinc-100 last:border-b-0 hover:bg-zinc-100">
                  <CohortRowLink row={r} />
                  <DownloadButton row={r} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Mobile filter bottom sheet */}
      {sheetOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-zinc-950/50 md:hidden" onClick={() => setSheetOpen(false)} />
          <div
            role="dialog"
            aria-label="Filters"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[84%] bg-white rounded-t-[14px] flex flex-col shadow-lg md:hidden"
          >
            <div className="flex justify-center pt-2 pb-0.5">
              <span className="w-9 h-1 rounded-sm bg-zinc-200" />
            </div>
            <div className="flex items-center pl-4 pr-2 pb-2 pt-1 border-b border-zinc-100">
              <h2 className="flex-1 text-base font-semibold">Filters</h2>
              <button type="button" onClick={clearAll} className="h-11 px-2.5 text-blue-700 text-[13px] cursor-pointer">
                Clear all
              </button>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close filters"
                className="w-11 h-11 flex items-center justify-center text-zinc-700 cursor-pointer"
              >
                <Icon name="x" size={20} />
              </button>
            </div>
            {chipList && <div className="px-4 pt-2.5">{chipList}</div>}
            <div className="flex-1 overflow-auto px-4 py-3">{filters}</div>
            <div className="px-4 pt-2.5 pb-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="w-full h-[46px] rounded-lg bg-blue-600 text-white font-semibold text-sm cursor-pointer"
              >
                Show {visibleRows.length} cohort{visibleRows.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
