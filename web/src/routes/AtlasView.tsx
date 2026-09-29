import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAtlasStore } from '../stores/atlasStore';
import { useAtlasData } from '../hooks/useAtlasData';
import { useAtlasURLSync } from '../hooks/useAtlasURLSync';
import { useCohorts } from '../hooks/useCohorts';
import { filterSlides, sortSlides, paginateSlides } from '../lib/filtering';
import { COHORT_FULL_NAMES } from '../data/cohortNames';
import { organOf } from '../data/organSystems';
import { UmapPanel } from '../components/atlas/UmapPanel';
import { SlideDrawer } from '../components/atlas/SlideDrawer';
import { Dropdown, FilterBar } from '../components/atlas/FilterBar';
import {
  EYEBROW,
  clusterVar,
  formatCount,
  formatValue,
  groupFeatures,
  parseSlideId,
  useIsCompact,
  type AtlasFeature,
} from '../components/atlas/shared';
import { DownloadDialog } from '../components/table/DownloadDialog';
import { CopyButton, Thumb } from '../components/atlas/parts';
import { Icon } from '../components/ui/Icon';
import { MiniHistogram } from '../components/ui/MiniHistogram';
import { Skeleton } from '../components/ui/Skeleton';
import type { Slide } from '../types';

const DATASET_INFO: Record<string, { source: string; url: string; label: string }> = {
  tcga: {
    source: 'TCGA solid-tumor projects',
    url: 'https://portal.gdc.cancer.gov/',
    label: 'Source data on the GDC portal',
  },
  cptac: {
    source: 'CPTAC studies',
    url: 'https://gdc.cancer.gov/about-gdc/contributed-genomic-data-cancer-research/clinical-proteomic-tumor-analysis-consortium-cptac',
    label: 'Source data on the GDC (CPTAC)',
  },
};

const VIRIDIS_SWATCH = 'linear-gradient(90deg,#440154,#3b528b,#21918c,#5ec962,#fde725)';
const SECONDARY_BUTTON =
  'flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-zinc-200 bg-white text-zinc-900 text-[13px] whitespace-nowrap cursor-pointer hover:bg-zinc-100';
const TABS = [
  { id: 'slides', label: 'Slides', icon: 'layers' },
  { id: 'histomics', label: 'Histomics', icon: 'fingerprint' },
  { id: 'clusters', label: 'Clusters', icon: 'waypoints' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Renders into a placeholder of the server-rendered page header. */
function Slot({ id, children }: { id: string; children: ReactNode }) {
  const el = document.getElementById(id);
  return el ? createPortal(children, el) : null;
}

interface AtlasViewProps {
  dataset?: string;
  cohort?: string;
  /** Feature names promoted as "key features" in the header. */
  keyFeatures?: string[];
}

export function AtlasView({ dataset = 'tcga', cohort = 'PANCAN', keyFeatures: keyFeatureNames = [] }: AtlasViewProps) {
  useAtlasURLSync();
  const compact = useIsCompact();
  const { data, isLoading, error } = useAtlasData(dataset, cohort);
  const { data: cohorts } = useCohorts(dataset);
  const store = useAtlasStore();
  const { colorBy, hoveredId, sort, pagination, setColorBy, setHoveredId, toggleSort, setPagination, setCancerTypes } = store;
  const { cancerTypes, clusterIds, immuneSubtypes, stages, grades, featureRanges, globalSearch } = store;

  const [tab, setTab] = useState<TabId>('slides');
  const [about, setAbout] = useState(false);
  const [isolate, setIsolate] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string> | null>(null);
  const [pinId, setPinId] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[] | null>(null);
  const [columnQuery, setColumnQuery] = useState('');
  const [download, setDownload] = useState<Slide[] | null>(null);

  const slides = data?.slides;
  const clusters = useMemo(() => data?.clusters ?? [], [data?.clusters]);
  const families = useMemo(() => groupFeatures(data?.featureMetadata ?? []), [data?.featureMetadata]);
  const features = useMemo(() => families.flatMap((f) => f.feats), [families]);
  const keyFeatures = useMemo(() => {
    const picked = keyFeatureNames
      .map((name) => features.find((f) => f.name === name))
      .filter((f): f is AtlasFeature => !!f);
    return picked.length ? picked : features.slice(0, 4);
  }, [keyFeatureNames, features]);
  const slideById = useMemo(() => new Map((slides ?? []).map((s) => [s.id, s])), [slides]);
  const clusterIndex = useMemo(() => new Map(clusters.map((c, i) => [c.id, i])), [clusters]);
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of slides ?? []) counts.set(s.cancerType, (counts.get(s.cancerType) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [slides]);
  const isMultiCancerType = typeCounts.length > 1;

  const list = useMemo(() => {
    if (!slides) return [];
    const filtered = filterSlides(slides, { cancerTypes, clusterIds, immuneSubtypes, stages, grades, featureRanges, globalSearch });
    return selection ? filtered.filter((s) => selection.has(s.id)) : filtered;
  }, [slides, cancerTypes, clusterIds, immuneSubtypes, stages, grades, featureRanges, globalSearch, selection]);
  const sorted = useMemo(() => sortSlides(list, sort), [list, sort]);
  const activeIds = useMemo(
    () => (slides && list.length === slides.length ? null : new Set(list.map((s) => s.id))),
    [slides, list],
  );
  const topTypes = useMemo(() => {
    const byCluster = new Map<string, Map<string, number>>();
    for (const s of slides ?? []) {
      if (s.clusterId == null) continue;
      if (!byCluster.has(s.clusterId)) byCluster.set(s.clusterId, new Map());
      const m = byCluster.get(s.clusterId)!;
      m.set(s.cancerType, (m.get(s.cancerType) ?? 0) + 1);
    }
    return byCluster;
  }, [slides]);

  // "Cancer type" colouring is meaningless inside a single-cancer cohort
  useEffect(() => {
    if (slides && !isMultiCancerType && colorBy === 'cancerType') setColorBy('clusterId');
  }, [slides, isMultiCancerType, colorBy, setColorBy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerId(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-3 md:px-6 py-4 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:h-[calc(100vh-52px)] lg:max-h-[860px]">
        <Skeleton className="h-[360px] lg:h-full rounded-lg" />
        <Skeleton className="h-[480px] lg:h-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-24 text-center">
        <div className="text-red-600 text-lg font-medium mb-2">Failed to load atlas data</div>
        <div className="text-zinc-500 text-sm mb-4">{error.message}</div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data || !slides || slides.length === 0) {
    return <div className="py-24 text-center text-zinc-500">No slide data available</div>;
  }

  const info = DATASET_INFO[dataset] ?? DATASET_INFO.tcga;
  const shownColumns = (columns ?? [...new Set([...keyFeatures, ...features].map((f) => f.name))].slice(0, 6))
    .map((name) => features.find((f) => f.name === name))
    .filter((f): f is AtlasFeature => !!f);
  const pages = Math.max(1, Math.ceil(sorted.length / pagination.pageSize));
  const page = Math.min(pagination.pageIndex, pages - 1);
  const rows = paginateSlides(sorted, page, pagination.pageSize);
  const drawerSlide = drawerId ? slideById.get(drawerId) : undefined;
  const swatch = (clusterId?: string) => ({ background: `var(${clusterVar(clusterIndex.get(clusterId ?? '') ?? 8)})` });
  const clusterName = (clusterId?: string) => clusters.find((c) => c.id === clusterId)?.name;

  const colorMap = (value: string) => {
    window.posthog?.capture('color_by_changed', { color_by: value, dataset, cohort });
    setColorBy(value);
  };
  const toggleColor = (name: string) => colorMap(colorBy === name ? 'clusterId' : name);
  const openSlide = (slideId: string) => {
    const slide = slideById.get(slideId);
    window.posthog?.capture('slide_clicked', { slide_id: slideId, cancer_type: slide?.cancerType, dataset, cohort });
    setDrawerId(slideId);
    setPinId(null);
  };
  const setShownColumns = (names: string[]) =>
    setColumns(features.filter((f) => names.includes(f.name)).map((f) => f.name));
  const sortDirection = (column: string) => (sort?.column === column ? sort.direction : null);
  const ariaSort = (column: string) => {
    const dir = sortDirection(column);
    return dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none';
  };
  const sortButton = (column: string, label: ReactNode, className = '') => (
    <button type="button" onClick={() => toggleSort(column)} className={`cursor-pointer font-medium leading-tight ${className}`}>
      {label}
      {sortDirection(column) === 'asc' ? ' ↑' : sortDirection(column) === 'desc' ? ' ↓' : ''}
    </button>
  );
  const rowKey = (slideId: string) => (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openSlide(slideId);
    }
  };

  const stats: Array<[number, string]> = [
    [slides.length, 'slides'],
    ...(isMultiCancerType ? [[typeCounts.length, 'cancer types'] as [number, string]] : []),
    [features.length, 'histomic features'],
    [clusters.length, 'clusters'],
  ];
  const q = columnQuery.trim().toLowerCase();

  return (
    <div className="flex flex-col text-zinc-900 text-[13px] leading-snug lg:h-[calc(100vh-52px)] lg:min-h-[640px] lg:max-h-[860px]">
      <Slot id="cohort-selector-slot">
        <Dropdown
          label="Switch cohort"
          panelClassName="left-0 w-[330px] max-w-[calc(100vw-32px)] max-h-[380px] overflow-auto p-1.5"
          trigger={(open, toggle) => (
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={open}
              aria-label="Switch cohort"
              title="Switch cohort"
              onClick={toggle}
              className="flex items-center justify-center w-8 h-8 rounded-md border border-transparent text-zinc-900 cursor-pointer hover:border-zinc-200 hover:bg-zinc-100"
            >
              <Icon name="chevron-down" size={18} />
            </button>
          )}
        >
          <div className={`px-2 pt-1.5 pb-1 ${EYEBROW}`}>Switch {dataset.toUpperCase()} cohort</div>
          {(cohorts ?? []).map((c) => (
            <a
              key={c.id}
              href={`/${dataset}/${c.id}/atlas/`}
              aria-current={c.id === cohort ? 'page' : undefined}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-center px-2 py-1.5 rounded-md text-[13px] text-zinc-900 hover:bg-zinc-100"
            >
              <span>
                {COHORT_FULL_NAMES[c.id] ?? c.name}
                <span className="block text-[11.5px] text-zinc-500">{c.id} · {formatCount(c.slideCount)} slides</span>
              </span>
              {c.id === cohort && <span className="text-blue-700">✓</span>}
            </a>
          ))}
        </Dropdown>
      </Slot>

      <Slot id="atlas-actions-slot">
        <button type="button" onClick={() => setAbout((v) => !v)} aria-expanded={about} className={SECONDARY_BUTTON}>
          <Icon name="info" size={14} />
          {about ? 'Hide cohort info' : 'Cohort info'}
        </button>
        <button
          type="button"
          onClick={() => setDownload(slides)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-blue-600 text-white text-[13px] font-medium whitespace-nowrap cursor-pointer"
        >
          <Icon name="download" size={14} />
          Download cohort
        </button>
      </Slot>

      <Slot id="atlas-stats-slot">
        <div className="flex items-center gap-x-5 gap-y-2 flex-wrap">
          <dl className="w-full md:w-auto grid grid-cols-4 gap-1.5 md:flex md:gap-[18px] text-zinc-500 md:text-zinc-600">
            {stats.map(([value, label]) => (
              <div key={label} className="flex flex-col-reverse md:flex-row-reverse md:gap-1.5">
                <dt className="text-[11px] md:text-[13px]">
                  <span className="max-md:hidden">{label}</span>
                  <span className="md:hidden">{label.replace('histomic ', '')}</span>
                </dt>
                <dd className="text-base md:text-[13px] font-semibold text-zinc-900 tabular-nums">{formatCount(value)}</dd>
              </div>
            ))}
          </dl>
          <span className="hidden md:block w-px h-[18px] bg-zinc-200" />
          <span className={`hidden md:inline ${EYEBROW}`}>Key features</span>
          <div className="flex gap-1.5 md:flex-wrap max-md:w-[calc(100%+2rem)] max-md:-mx-4 max-md:px-4 max-md:overflow-x-auto scrollbar-hide">
            {keyFeatures.map((f) => {
              const active = colorBy === f.name;
              return (
                <span key={f.name} className={`flex flex-none items-stretch h-[34px] md:h-7 rounded-md border overflow-hidden ${active ? 'border-blue-600 bg-blue-50' : 'border-zinc-200 bg-white'}`}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleColor(f.name)}
                    title={`${f.description ?? f.displayName} (${f.unit}). Click to color the map.`}
                    className="flex items-center gap-1.5 px-2.5 md:px-2 text-zinc-900 text-[12.5px] whitespace-nowrap cursor-pointer"
                  >
                    <span aria-hidden="true" className="w-3.5 h-2 rounded-sm" style={{ background: VIRIDIS_SWATCH }} />
                    {f.displayName}
                  </button>
                  <a
                    href={`/${dataset}/${cohort}/histomics/${encodeURIComponent(f.name)}/`}
                    aria-label={`Open ${f.displayName} feature page`}
                    title="Open feature page"
                    className="hidden md:flex items-center px-1.5 border-l border-zinc-200 text-zinc-600"
                  >
                    <Icon name="arrow-right" size={13} />
                  </a>
                </span>
              );
            })}
          </div>
          <span className="hidden xl:inline text-[11.5px] text-zinc-500">Click to color the map · → opens the feature page</span>
        </div>
      </Slot>

      {about && (
        <Slot id="atlas-about-slot">
          <section aria-label="About this cohort" className="bg-white border-b border-zinc-200">
            <div className="max-w-7xl mx-auto px-4 md:px-6 pt-3.5 pb-4 grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] text-[13px]">
            <div className="flex flex-col gap-2 leading-relaxed text-zinc-700">
              <h2 className="text-[13.5px] font-semibold text-zinc-900">About this cohort</h2>
              <p>
                {formatCount(slides.length)} diagnostic H&amp;E slides from{' '}
                {isMultiCancerType ? `${typeCounts.length} ${info.source}` : `the ${dataset.toUpperCase()} ${cohort} cohort`}. Each slide is
                summarised by {features.length} histomic features computed from cell segmentation and tissue maps. The slides are then
                embedded with UMAP and grouped into {clusters.length} morphology clusters.
              </p>
              <a href={info.url} target="_blank" rel="noopener noreferrer" className="text-[12.5px] text-blue-700 hover:underline">
                {info.label} ↗
              </a>
            </div>
            {isMultiCancerType && (
              <div>
                <div className="flex justify-between mb-1.5">
                  <h2 className="text-[13.5px] font-semibold text-zinc-900">Cancer types</h2>
                  <span className="text-[11.5px] text-zinc-500">slides per type · click to filter</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-x-7 gap-y-0.5">
                  {typeCounts.map(([type, n]) => {
                    const checked = cancerTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={checked}
                        title={COHORT_FULL_NAMES[type]}
                        onClick={() => setCancerTypes(checked ? cancerTypes.filter((t) => t !== type) : [...cancerTypes, type])}
                        className="grid grid-cols-[8px_42px_minmax(0,1fr)_44px] gap-2 items-center h-5 px-1 rounded text-xs text-zinc-900 cursor-pointer hover:bg-zinc-100"
                      >
                        <span className={`w-2 h-2 rounded-full ${organOf(type)?.dot ?? 'bg-zinc-400'}`} />
                        <span className="text-left font-medium">{type}</span>
                        <span className="h-2 rounded-sm bg-zinc-100">
                          <span
                            className={`block h-full rounded-sm ${checked ? 'bg-blue-600' : 'bg-zinc-300'}`}
                            style={{ width: `${(100 * n) / typeCounts[0][1]}%` }}
                          />
                        </span>
                        <span className="text-right tabular-nums text-zinc-600">{formatCount(n)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
          </section>
        </Slot>
      )}

      <FilterBar
        slides={slides}
        clusters={clusters}
        families={families}
        keyFeatures={keyFeatures}
        showCancerType={isMultiCancerType}
        resultCount={list.length}
        selCount={selection?.size ?? 0}
        onClearSel={() => setSelection(null)}
        onColorBy={colorMap}
      />

      <div className="flex-1 min-h-0 w-full max-w-7xl mx-auto px-3 md:px-6 pb-4 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="h-[360px] lg:h-auto min-h-0">
          <UmapPanel
            slides={slides}
            clusters={clusters}
            families={families}
            showCancerType={isMultiCancerType}
            colorBy={colorBy}
            onColorBy={colorMap}
            isolate={isolate}
            onIsolate={setIsolate}
            activeIds={activeIds}
            highlightId={hoveredId}
            pinId={pinId}
            onHover={setHoveredId}
            onSelect={(ids) => { setSelection(new Set(ids)); setPagination({ pageIndex: 0 }); }}
            onPointClick={openSlide}
            selCount={selection?.size ?? 0}
            onClearSel={() => setSelection(null)}
            dataVersion={data.dataVersion}
            dataUpdatedAt={data.dataUpdatedAt}
            compact={compact}
          />
        </div>

        <div className="min-w-0 min-h-0 flex flex-col bg-white border border-zinc-200 rounded-lg">
          <div role="tablist" aria-label="Cohort views" className="flex items-stretch sm:gap-1 px-1 sm:px-3 border-b border-zinc-200 min-h-11">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 md:flex-none items-center justify-center gap-1.5 px-2 text-[13px] font-medium cursor-pointer ${tab === t.id ? 'text-zinc-900 shadow-[inset_0_-2px_0_var(--color-blue-600)]' : 'text-zinc-600'}`}
              >
                <span className="hidden sm:flex"><Icon name={t.icon} size={14} /></span>
                {t.label}
                <span className="text-[11.5px] text-zinc-600 bg-zinc-100 rounded-full px-[7px] tabular-nums">
                  {formatCount(t.id === 'slides' ? slides.length : t.id === 'histomics' ? features.length : clusters.length)}
                </span>
              </button>
            ))}
            <div className="hidden xl:block flex-1" />
            <span className="hidden xl:block self-center text-[11.5px] text-zinc-500">Map is shared · filters apply to every tab</span>
          </div>

          {tab === 'slides' && (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="relative z-[6] flex items-center gap-2.5 px-3 py-[7px] border-b border-zinc-100">
                <span className="text-[12.5px] text-zinc-600 tabular-nums">
                  {sorted.length ? `${formatCount(sorted.length)} slides · page ${page + 1}` : 'No slides match these filters'}
                </span>
                <div className="flex-1" />
                <span className="hidden xl:inline text-xs text-zinc-500">
                  {shownColumns.length < features.length ? `${features.length - shownColumns.length} more in Columns · scroll →` : 'Scroll →'}
                </span>
                <div className="hidden md:block">
                  <Dropdown
                    label="Choose feature columns"
                    panelClassName="right-0 w-[520px] px-3 py-2.5 flex flex-col gap-2"
                    trigger={(open, toggle) => (
                      <button type="button" aria-expanded={open} onClick={toggle} className={`${SECONDARY_BUTTON} !h-[30px] !text-[12.5px]`}>
                        <Icon name="table" size={14} />
                        Columns · {shownColumns.length} of {features.length}
                      </button>
                    )}
                  >
                    <div className="flex gap-2 items-center">
                      <input
                        type="search"
                        aria-label="Search columns"
                        placeholder={`Search ${features.length} features`}
                        value={columnQuery}
                        onChange={(e) => setColumnQuery(e.target.value)}
                        className="flex-1 h-[30px] border border-zinc-200 rounded-md bg-white text-zinc-900 px-2.5 text-[12.5px]"
                      />
                      <button type="button" onClick={() => setShownColumns(keyFeatures.map((f) => f.name))} className="h-[30px] px-2 text-blue-700 text-xs cursor-pointer">Key only</button>
                      <button type="button" onClick={() => setShownColumns(features.map((f) => f.name))} className="h-[30px] px-2 text-blue-700 text-xs cursor-pointer">All {features.length}</button>
                    </div>
                    <div className="max-h-[340px] overflow-auto grid grid-cols-2 gap-x-5 gap-y-2">
                      {families.map((fam) => {
                        const feats = fam.feats.filter((f) => !q || f.displayName.toLowerCase().includes(q));
                        return feats.length === 0 ? null : (
                          <fieldset key={fam.label} className="min-w-0">
                            <legend className={`mb-0.5 ${EYEBROW}`}>{fam.label}</legend>
                            {feats.map((f) => {
                              const names = shownColumns.map((c) => c.name);
                              return (
                                <label key={f.name} className="grid grid-cols-[15px_minmax(0,1fr)] gap-2 items-start py-0.5 text-[12.5px] cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={names.includes(f.name)}
                                    onChange={() => setShownColumns(names.includes(f.name) ? names.filter((n) => n !== f.name) : [...names, f.name])}
                                    className="w-[15px] h-[15px] mt-0.5 accent-blue-600"
                                  />
                                  <span>{f.displayName} <span className="text-zinc-500">{f.unit}</span></span>
                                </label>
                              );
                            })}
                          </fieldset>
                        );
                      })}
                    </div>
                  </Dropdown>
                </div>
                <button type="button" onClick={() => setDownload(sorted)} className={`${SECONDARY_BUTTON} !h-[30px] !text-[12.5px]`}>
                  <Icon name="download" size={14} />
                  Export CSV · {formatCount(sorted.length)}
                </button>
              </div>

              {/* Desktop and tablet: table with a sticky slide column */}
              <div className="hidden md:block relative lg:flex-1 lg:min-h-0">
                <div className="overflow-auto max-lg:max-h-[70vh] lg:absolute lg:inset-0">
                  <table aria-label="Slides" className="border-separate border-spacing-0 min-w-max text-[12.5px]">
                    <thead>
                      <tr className="text-xs text-zinc-600 text-left">
                        <th
                          scope="col"
                          aria-sort={sort?.column === 'cancerType' ? ariaSort('cancerType') : ariaSort('id')}
                          className="sticky top-0 left-0 z-[4] w-[310px] h-12 px-3 bg-zinc-100 border-b border-zinc-200 shadow-[1px_0_0_var(--color-zinc-200)]"
                        >
                          <span className="flex items-center gap-2">
                            {sortButton('id', dataset === 'tcga' ? 'Slide (TCGA barcode)' : 'Slide', 'pl-[38px]')}
                            <span className="flex-1" />
                            {sortButton('cancerType', 'Cancer', 'w-[62px] text-left')}
                          </span>
                        </th>
                        <th scope="col" aria-sort={ariaSort('clusterId')} className="sticky top-0 z-[3] w-[200px] px-3 bg-zinc-100 border-b border-zinc-200">
                          {sortButton('clusterId', 'Cluster')}
                        </th>
                        <th
                          scope="col"
                          aria-sort={ariaSort('immuneSubtype')}
                          title="Thorsson et al. 2018 immune subtypes: C1 Wound healing · C2 IFN-γ dominant · C3 Inflammatory · C4 Lymphocyte depleted · C5 Immunologically quiet · C6 TGF-β dominant"
                          className="sticky top-0 z-[3] w-[120px] px-3 bg-zinc-100 border-b border-zinc-200"
                        >
                          {sortButton('immuneSubtype', <>Immune subtype<span className="block font-normal text-zinc-500">Thorsson</span></>, 'text-left')}
                        </th>
                        {shownColumns.map((f) => (
                          <th
                            key={f.name}
                            scope="col"
                            aria-sort={ariaSort(f.name)}
                            title={`${f.displayName} (${f.unit})`}
                            className="sticky top-0 z-[3] w-[132px] min-w-[132px] max-w-[132px] px-3 py-1 bg-zinc-100 border-b border-zinc-200 text-right whitespace-normal"
                          >
                            {sortButton(f.name, <>{f.displayName}<span className="block font-normal text-zinc-500">{f.unit}</span></>, 'text-right')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s) => {
                        const highlighted = hoveredId === s.id;
                        const { barcode, uuid } = parseSlideId(s.id);
                        return (
                          <tr
                            key={s.id}
                            tabIndex={0}
                            aria-label={`${barcode}, ${s.cancerType}, cluster ${s.clusterId ?? 'none'}`}
                            onMouseEnter={() => setHoveredId(s.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            onFocus={() => setHoveredId(s.id)}
                            onClick={() => openSlide(s.id)}
                            onKeyDown={rowKey(s.id)}
                            className={`h-[38px] cursor-pointer [&>td]:border-b [&>td]:border-zinc-100 ${highlighted ? 'bg-blue-50' : ''}`}
                          >
                            <td
                              className="sticky left-0 z-[2] px-3 shadow-[1px_0_0_var(--color-zinc-100)]"
                              style={{
                                // Opaque in both themes, so scrolled cells never show through
                                background: highlighted
                                  ? 'linear-gradient(var(--color-blue-50), var(--color-blue-50)), var(--color-white)'
                                  : 'var(--color-white)',
                              }}
                            >
                              <span className="flex items-center gap-2">
                                <Thumb slideId={s.id} className="w-7 h-7 rounded-[3px]" />
                                <span title={uuid ? `Slide UUID ${uuid}` : undefined} className="font-mono text-[11.5px] font-medium whitespace-nowrap">{barcode}</span>
                                <CopyButton text={barcode} label="Copy barcode" />
                                <span className="flex-1" />
                                <span title={COHORT_FULL_NAMES[s.cancerType]} className="w-[62px] flex items-center gap-1.5">
                                  <span className={`w-[7px] h-[7px] rounded-full flex-none ${organOf(s.cancerType)?.dot ?? 'bg-zinc-400'}`} />
                                  {s.cancerType}
                                </span>
                              </span>
                            </td>
                            <td title={s.clusterId != null ? `Cluster ${s.clusterId}: ${clusterName(s.clusterId)}` : undefined} className="px-3 max-w-[200px]">
                              {s.clusterId != null && (
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <span className="w-[9px] h-[9px] rounded-sm flex-none" style={swatch(s.clusterId)} />
                                  <span className="font-semibold tabular-nums">{s.clusterId}</span>
                                  <span className="text-zinc-700 truncate">{clusterName(s.clusterId)}</span>
                                </span>
                              )}
                            </td>
                            <td className="px-3">{s.immuneSubtype ?? <NotAvailable title="Not reported" />}</td>
                            {shownColumns.map((f) => (
                              <td key={f.name} className="px-3 text-right tabular-nums">
                                {formatValue(s.features[f.name]) ?? <NotAvailable title="Not measured on this slide" />}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div aria-hidden="true" className="absolute top-0 right-0 bottom-0 w-8 pointer-events-none bg-gradient-to-r from-transparent to-white" />
              </div>

              {/* Mobile: one card per slide */}
              <ul aria-label="Slides" className="md:hidden p-3 flex flex-col gap-2">
                {rows.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => openSlide(s.id)}
                      className="w-full grid grid-cols-[48px_minmax(0,1fr)] gap-3 p-3 border border-zinc-200 rounded-lg bg-white text-left cursor-pointer"
                    >
                      <Thumb slideId={s.id} className="w-12 h-12 rounded" />
                      <span className="min-w-0 flex flex-col gap-1">
                        <span className="font-mono text-xs font-semibold truncate">{parseSlideId(s.id).barcode}</span>
                        <span className="flex items-center gap-3 text-[12.5px] min-w-0">
                          <span className="flex items-center gap-1.5 flex-none">
                            <span className={`w-[7px] h-[7px] rounded-full ${organOf(s.cancerType)?.dot ?? 'bg-zinc-400'}`} />
                            {s.cancerType}
                          </span>
                          {s.clusterId != null && (
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className="w-[9px] h-[9px] rounded-sm flex-none" style={swatch(s.clusterId)} />
                              <strong className="font-semibold">{s.clusterId}</strong>
                              <span className="truncate text-zinc-700">{clusterName(s.clusterId)}</span>
                            </span>
                          )}
                        </span>
                        <span className="grid grid-cols-2 gap-2 mt-0.5 pt-1.5 border-t border-zinc-100 text-xs">
                          {shownColumns.slice(0, 2).map((f) => (
                            <span key={f.name} className="min-w-0">
                              <span className="block text-zinc-500 truncate">{f.displayName}</span>
                              {formatValue(s.features[f.name]) == null
                                ? <span className="italic text-zinc-500">not measured</span>
                                : <span className="font-semibold tabular-nums">{formatValue(s.features[f.name])}</span>}
                            </span>
                          ))}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-2 px-3 py-1.5 border-t border-zinc-100 text-[12.5px] text-zinc-600">
                <span className="tabular-nums">
                  {sorted.length
                    ? `${formatCount(page * pagination.pageSize + 1)}–${formatCount(Math.min(sorted.length, (page + 1) * pagination.pageSize))} of ${formatCount(sorted.length)}`
                    : '0 of 0'}
                </span>
                <div className="flex-1" />
                <button type="button" aria-label="Previous page" disabled={page <= 0} onClick={() => setPagination({ pageIndex: page - 1 })} className="w-[30px] h-7 border border-zinc-200 rounded-md bg-white text-zinc-900 cursor-pointer disabled:opacity-40 disabled:cursor-default">‹</button>
                <span className="tabular-nums">{page + 1} / {formatCount(pages)}</span>
                <button type="button" aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPagination({ pageIndex: page + 1 })} className="w-[30px] h-7 border border-zinc-200 rounded-md bg-white text-zinc-900 cursor-pointer disabled:opacity-40 disabled:cursor-default">›</button>
              </div>
            </div>
          )}

          {tab === 'histomics' && (
            <div className="flex-1 min-h-0 overflow-auto px-3.5 pt-1.5 pb-3.5">
              {families.map((fam) => (
                <div key={fam.label} className="pt-2.5">
                  <div className={`pb-1 border-b border-zinc-100 ${EYEBROW}`}>{fam.label}</div>
                  {fam.feats.map((f) => {
                    const active = colorBy === f.name;
                    return (
                      <div key={f.name} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_110px_96px_auto] gap-x-3.5 items-center py-1.5 border-b border-zinc-100 text-[12.5px]">
                        <a href={`/${dataset}/${cohort}/histomics/${encodeURIComponent(f.name)}/`} className="text-zinc-900 hover:underline">
                          {f.displayName} <span className="text-zinc-500">{f.unit}</span>
                        </a>
                        <span className="hidden sm:block text-right tabular-nums text-zinc-700">median {formatValue(f.quantiles.p50)}</span>
                        <span className="hidden sm:block"><MiniHistogram bins={f.histogramBins ?? []} percentile={-1} /></span>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleColor(f.name)}
                          className={`h-[26px] px-2.5 rounded-md border bg-white text-zinc-900 text-xs whitespace-nowrap cursor-pointer ${active ? 'border-blue-600' : 'border-zinc-200'}`}
                        >
                          {active ? 'Coloring map' : 'Color map'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {tab === 'clusters' && (
            <div className="flex-1 min-h-0 overflow-auto px-3.5 pt-2 pb-3.5 flex flex-col gap-1.5">
              {clusters.map((c) => {
                const n = c.slideIds.length;
                const isolated = isolate === c.id;
                const top = [...(topTypes.get(c.id) ?? [])].sort((a, b) => b[1] - a[1]).slice(0, 3);
                return (
                  <div key={c.id} className={`grid grid-cols-[12px_22px_minmax(0,1fr)_auto] sm:grid-cols-[12px_22px_minmax(0,1fr)_110px_auto] gap-2.5 items-center px-2.5 py-2 border rounded-lg text-[12.5px] ${isolated ? 'border-blue-600' : 'border-zinc-200'}`}>
                    <span className="w-3 h-3 rounded-[3px]" style={swatch(c.id)} />
                    <span className="font-semibold text-sm tabular-nums">{c.id}</span>
                    <span className="min-w-0">
                      <a href={`/${dataset}/${cohort}/cluster/${c.id}/`} className="block font-medium text-zinc-900 hover:underline">{c.name}</a>
                      {top.length > 0 && (
                        <span className="block text-[11.5px] text-zinc-600">
                          Top types: {top.map(([type, k]) => `${type} ${Math.round((100 * k) / n)}%`).join(' · ')}
                        </span>
                      )}
                    </span>
                    <span className="hidden sm:block text-right tabular-nums">
                      <strong className="font-semibold">{formatCount(n)}</strong> slides
                      <span className="block text-[11.5px] text-zinc-500">{((100 * n) / slides.length).toFixed(1)}% of cohort</span>
                    </span>
                    <button
                      type="button"
                      aria-pressed={isolated}
                      onClick={() => setIsolate(isolated ? null : c.id)}
                      className="h-7 px-2.5 rounded-md border border-zinc-200 bg-white text-zinc-900 text-xs cursor-pointer hover:bg-zinc-100"
                    >
                      {isolated ? 'Show all' : 'Isolate on map'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {drawerSlide && (
        <SlideDrawer
          slide={drawerSlide}
          dataset={dataset}
          cohort={cohort}
          clusters={clusters}
          keyFeatures={keyFeatures}
          slideById={slideById}
          onClose={() => setDrawerId(null)}
          onLocate={(id) => { setDrawerId(null); setPinId(id); setIsolate(null); }}
          onOpen={openSlide}
        />
      )}

      <DownloadDialog
        isOpen={download != null}
        onClose={() => setDownload(null)}
        filteredSlides={download ?? []}
        selectedSlideIds={[]}
        featureNames={data.featureNames ?? []}
      />
    </div>
  );
}

function NotAvailable({ title }: { title: string }) {
  return (
    <span title={title} className="text-[11px] italic text-zinc-500 border border-dashed border-zinc-200 rounded px-1">
      n/a
    </span>
  );
}
