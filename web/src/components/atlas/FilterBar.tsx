import { useMemo, useState, type ReactNode } from 'react';
import type { Cluster, Slide } from '../../types';
import { useAtlasStore } from '../../stores/atlasStore';
import { COHORT_FULL_NAMES } from '../../data/cohortNames';
import { ORGAN_SYSTEMS, organOf } from '../../data/organSystems';
import { Icon } from '../ui/Icon';
import { EYEBROW, POPOVER, clusterVar, formatCount, formatValue, type AtlasFeature, type FeatureFamily } from './shared';

const toggleIn = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

function countBy(slides: Slide[], key: (s: Slide) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const s of slides) {
    const k = key(s);
    if (k != null) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

/** Button with a popover panel; closes on outside click or Escape. */
export function Dropdown({
  label, trigger, children, panelClassName = '',
}: {
  label: string;
  trigger: (open: boolean, toggle: () => void) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className="relative" onKeyDown={(e) => e.key === 'Escape' && close()}>
      {trigger(open, () => setOpen((v) => !v))}
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={close} />
          <div role="dialog" aria-label={label} className={`absolute top-full mt-1.5 z-30 ${POPOVER} ${panelClassName}`}>
            {typeof children === 'function' ? children(close) : children}
          </div>
        </>
      )}
    </div>
  );
}

function CheckRow({
  checked, onChange, count, children,
}: { checked: boolean; onChange: () => void; count?: number; children: ReactNode }) {
  return (
    <label className="flex items-start gap-2 px-1.5 py-1 min-h-8 md:min-h-0 rounded cursor-pointer text-[12.5px] hover:bg-zinc-100">
      <input type="checkbox" checked={checked} onChange={onChange} className="w-[15px] h-[15px] mt-0.5 flex-none accent-blue-600" />
      <span className="flex-1 min-w-0 flex items-start gap-2">{children}</span>
      {count != null && <span className="text-zinc-600 tabular-nums">{formatCount(count)}</span>}
    </label>
  );
}

function FeatureRange({
  slides, families, onColorBy, onDone,
}: { slides: Slide[]; families: FeatureFamily[]; onColorBy: (v: string) => void; onDone: () => void }) {
  const { featureRanges, setFeatureRange, clearFeatureRange } = useAtlasStore();
  const features = useMemo(() => families.flatMap((f) => f.feats), [families]);
  const [query, setQuery] = useState('');
  const [pick, setPick] = useState(features[0]?.name);
  const [draft, setDraft] = useState<[number, number] | null>(null);

  const feature: AtlasFeature | undefined = features.find((f) => f.name === pick) ?? features[0];
  const q = query.trim().toLowerCase();
  const stats = useMemo(() => {
    if (!feature) return { inRange: 0, missing: 0 };
    const [lo, hi] = draft ?? featureRanges[feature.name] ?? [feature.min, feature.max];
    let inRange = 0, missing = 0;
    for (const s of slides) {
      const v = s.features[feature.name];
      if (v == null || !Number.isFinite(v)) missing++;
      else if (v >= lo && v <= hi) inRange++;
    }
    return { inRange, missing };
  }, [slides, feature, draft, featureRanges]);

  if (!feature) return null;
  const applied = featureRanges[feature.name];
  const [lo, hi] = draft ?? applied ?? [feature.min, feature.max];
  const bins = feature.histogramBins ?? [];
  const maxBin = Math.max(1, ...bins);
  const span = feature.max - feature.min || 1;
  const select = (name: string) => { setPick(name); setDraft(null); };
  const slider = (label: string, value: number, onChange: (v: number) => void) => (
    <label className="grid grid-cols-[34px_minmax(0,1fr)_72px] gap-2 items-center text-xs text-zinc-600">
      {label}
      <input
        type="range"
        aria-label={label === 'Min' ? 'Minimum' : 'Maximum'}
        min={feature.min}
        max={feature.max}
        step={span / 200}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-blue-600"
      />
      <span className="text-right tabular-nums text-zinc-900">{formatValue(value)}</span>
    </label>
  );

  return (
    <div className="grid md:grid-cols-[270px_minmax(0,1fr)]">
      <div className="md:border-r border-zinc-100 p-2.5 flex flex-col gap-2">
        <input
          type="search"
          aria-label={`Search ${features.length} features`}
          placeholder={`Search ${features.length} features`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 border border-zinc-200 rounded-md bg-white text-zinc-900 px-2.5 text-[12.5px]"
        />
        <div className="max-h-40 md:max-h-[330px] overflow-auto flex flex-col gap-1.5">
          {families.map((fam) => {
            const feats = fam.feats.filter((f) => !q || f.displayName.toLowerCase().includes(q));
            return feats.length === 0 ? null : (
              <div key={fam.label}>
                <div className={`px-1.5 py-0.5 ${EYEBROW}`}>{fam.label}</div>
                {feats.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    aria-pressed={f.name === feature.name}
                    onClick={() => select(f.name)}
                    className={`w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-[12.5px] text-left text-zinc-900 cursor-pointer hover:bg-zinc-100 ${f.name === feature.name ? 'bg-blue-50' : ''}`}
                  >
                    <span className="flex-1">{f.displayName}</span>
                    {featureRanges[f.name] && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div className="px-4 py-3.5 flex flex-col gap-2.5">
        <div>
          <div className={EYEBROW}>{families.find((f) => f.feats.includes(feature))?.label}</div>
          <div className="text-sm font-semibold">{feature.displayName}</div>
          <div className="text-[12.5px] text-zinc-600">
            {feature.description ?? 'Slide-level value'} · {feature.unit}
          </div>
        </div>
        <div aria-hidden="true" className="flex items-end gap-px h-16">
          {bins.map((b, j) => {
            const x0 = feature.min + (span * j) / bins.length, x1 = feature.min + (span * (j + 1)) / bins.length;
            return (
              <span
                key={j}
                className={`flex-1 rounded-t-[1px] ${x1 >= lo && x0 <= hi ? 'bg-blue-600' : 'bg-zinc-300'}`}
                style={{ height: `${Math.max(3, (100 * b) / maxBin)}%` }}
              />
            );
          })}
        </div>
        {slider('Min', lo, (v) => setDraft([Math.min(v, hi), hi]))}
        {slider('Max', hi, (v) => setDraft([lo, Math.max(v, lo)]))}
        <div className="text-[11.5px] text-zinc-500">
          {formatCount(stats.inRange)} slides in range · {formatCount(stats.missing)} not measured (excluded when a range is set)
        </div>
        <div className="flex flex-wrap gap-2 mt-0.5">
          <button
            type="button"
            onClick={() => { setFeatureRange(feature.name, [lo, hi]); setDraft(null); onDone(); }}
            className="h-8 px-3 rounded-md bg-blue-600 text-white text-[12.5px] font-medium cursor-pointer"
          >
            Apply range
          </button>
          <button
            type="button"
            onClick={() => { onColorBy(feature.name); onDone(); }}
            className="h-8 px-3 rounded-md border border-zinc-200 bg-white text-zinc-900 text-[12.5px] cursor-pointer"
          >
            Color map by this
          </button>
          {applied && (
            <button
              type="button"
              onClick={() => { clearFeatureRange(feature.name); setDraft(null); }}
              className="h-8 px-2.5 text-blue-700 text-[12.5px] cursor-pointer"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface Section {
  key: string;
  label: string;
  n: number;
  panel: string;
  content: (close: () => void) => ReactNode;
}

interface FilterBarProps {
  slides: Slide[];
  clusters: Cluster[];
  families: FeatureFamily[];
  keyFeatures: AtlasFeature[];
  showCancerType: boolean;
  resultCount: number;
  selCount: number;
  onClearSel: () => void;
  onColorBy: (value: string) => void;
}

export function FilterBar({
  slides, clusters, families, keyFeatures, showCancerType, resultCount, selCount, onClearSel, onColorBy,
}: FilterBarProps) {
  const {
    cancerTypes, clusterIds, stages, grades, immuneSubtypes, featureRanges, globalSearch, sort,
    setCancerTypes, setClusterIds, setStages, setGrades, setImmuneSubtypes, clearFeatureRange,
    setGlobalSearch, setSort, clearFilters,
  } = useAtlasStore();
  const [sheet, setSheet] = useState(false);

  const counts = useMemo(
    () => ({
      type: countBy(slides, (s) => s.cancerType),
      cluster: countBy(slides, (s) => s.clusterId),
      stage: countBy(slides, (s) => s.stage),
      grade: countBy(slides, (s) => s.grade),
    }),
    [slides],
  );
  const featureByName = useMemo(
    () => new Map(families.flatMap((f) => f.feats).map((f) => [f.name, f])),
    [families],
  );

  const optionList = (values: Map<string, number>, selected: string[], onChange: (v: string[]) => void) =>
    [...values.keys()].sort().map((v) => (
      <CheckRow key={v} checked={selected.includes(v)} onChange={() => onChange(toggleIn(selected, v))} count={values.get(v)}>
        {v}
      </CheckRow>
    ));

  const sections: Section[] = [
    ...(showCancerType ? [{
      key: 'type',
      label: 'Cancer type',
      n: cancerTypes.length,
      panel: 'w-[640px] px-3.5 py-3',
      content: () => (
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-2.5">
          {ORGAN_SYSTEMS.map((organ) => {
            const types = [...counts.type.keys()].filter((t) => organOf(t)?.id === organ.id).sort();
            return types.length === 0 ? null : (
              <fieldset key={organ.id} className="min-w-0">
                <legend className={`flex items-center gap-1.5 mb-0.5 ${EYEBROW}`}>
                  <span className={`w-2 h-2 rounded-full ${organ.dot}`} />
                  {organ.label}
                </legend>
                {types.map((t) => (
                  <CheckRow key={t} checked={cancerTypes.includes(t)} onChange={() => setCancerTypes(toggleIn(cancerTypes, t))} count={counts.type.get(t)}>
                    <span className="font-medium w-11 flex-none">{t}</span>
                    <span title={COHORT_FULL_NAMES[t]} className="text-zinc-600 truncate">{COHORT_FULL_NAMES[t] ?? ''}</span>
                  </CheckRow>
                ))}
              </fieldset>
            );
          })}
        </div>
      ),
    }] : []),
    {
      key: 'cluster',
      label: 'Cluster',
      n: clusterIds.length,
      panel: 'w-[400px] px-2.5 py-2',
      content: () =>
        clusters.map((c, i) => (
          <CheckRow key={c.id} checked={clusterIds.includes(c.id)} onChange={() => setClusterIds(toggleIn(clusterIds, c.id))} count={counts.cluster.get(c.id) ?? 0}>
            <span className="w-2.5 h-2.5 rounded-sm flex-none mt-1" style={{ background: `var(${clusterVar(i)})` }} />
            <span className="font-semibold tabular-nums">{c.id}</span>
            <span>{c.name}</span>
          </CheckRow>
        )),
    },
    ...(counts.stage.size > 0 ? [{
      key: 'stage',
      label: 'Stage',
      n: stages.length,
      panel: 'w-[230px] px-2.5 py-2 max-h-[380px] overflow-auto',
      content: () => optionList(counts.stage, stages, setStages),
    }] : []),
    ...(counts.grade.size > 0 ? [{
      key: 'grade',
      label: 'Grade',
      n: grades.length,
      panel: 'w-[230px] px-2.5 py-2',
      content: () => optionList(counts.grade, grades, setGrades),
    }] : []),
    {
      key: 'features',
      label: 'Features',
      n: Object.keys(featureRanges).length,
      panel: 'w-[660px]',
      content: (close: () => void) => (
        <FeatureRange slides={slides} families={families} onColorBy={onColorBy} onDone={close} />
      ),
    },
  ];

  const chips = [
    ...cancerTypes.map((t) => ({ kind: 'Cancer', label: t, title: COHORT_FULL_NAMES[t], remove: () => setCancerTypes(toggleIn(cancerTypes, t)) })),
    ...clusterIds.map((c) => ({ kind: 'Cluster', label: c, title: clusters.find((x) => x.id === c)?.name, remove: () => setClusterIds(toggleIn(clusterIds, c)) })),
    ...stages.map((v) => ({ kind: '', label: v, title: 'Pathologic stage', remove: () => setStages(toggleIn(stages, v)) })),
    ...grades.map((v) => ({ kind: 'Grade', label: v, title: 'Histologic grade', remove: () => setGrades(toggleIn(grades, v)) })),
    ...immuneSubtypes.map((v) => ({ kind: 'Immune', label: v, title: 'Immune subtype (Thorsson)', remove: () => setImmuneSubtypes(toggleIn(immuneSubtypes, v)) })),
    ...Object.entries(featureRanges).map(([name, [lo, hi]]) => ({
      kind: '',
      label: `${featureByName.get(name)?.displayName ?? name} ${formatValue(lo)}–${formatValue(hi)}`,
      title: featureByName.get(name)?.unit,
      remove: () => clearFeatureRange(name),
    })),
    ...(globalSearch.trim() ? [{ kind: 'Search', label: `“${globalSearch.trim()}”`, title: undefined, remove: () => setGlobalSearch('') }] : []),
    ...(selCount ? [{ kind: 'Map selection', label: `${formatCount(selCount)} slides`, title: 'Box selection on the UMAP', remove: onClearSel }] : []),
  ];
  const clearAll = () => { clearFilters(); onClearSel(); };
  const countLabel =
    resultCount === slides.length
      ? `Showing all ${formatCount(slides.length)} slides`
      : `Showing ${formatCount(resultCount)} of ${formatCount(slides.length)} slides`;

  const search = (
    <label className="relative flex items-center text-zinc-500 flex-1 md:flex-none">
      <span className="absolute left-2.5 flex"><Icon name="search" size={14} /></span>
      <input
        type="search"
        aria-label="Search slides by barcode or UUID"
        placeholder="Search slide barcode or UUID"
        value={globalSearch}
        onChange={(e) => setGlobalSearch(e.target.value)}
        className="w-full md:w-[280px] h-[34px] border border-zinc-200 rounded-md bg-white text-zinc-900 pl-8 pr-2.5 text-[13px]"
      />
    </label>
  );

  return (
    <div className="flex-none w-full max-w-7xl mx-auto px-3 md:px-6 pt-2.5 pb-2 flex flex-col gap-2">
      {/* Desktop: one popover per filter */}
      <div className="hidden md:flex items-center gap-2 flex-wrap">
        {sections.map((s) => (
          <Dropdown
            key={s.key}
            label={`Filter by ${s.label.toLowerCase()}`}
            panelClassName={`left-0 max-w-[calc(100vw-48px)] ${s.panel}`}
            trigger={(open, toggle) => (
              <button
                type="button"
                aria-expanded={open}
                onClick={toggle}
                className={`flex items-center gap-1.5 h-[34px] px-2.5 rounded-md border bg-white text-zinc-900 text-[13px] cursor-pointer ${s.n ? 'border-blue-600' : 'border-zinc-200'}`}
              >
                {s.label}
                {s.n > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[11px] font-semibold flex items-center justify-center">{s.n}</span>
                )}
                <Icon name="chevron-down" size={14} />
              </button>
            )}
          >
            {s.content}
          </Dropdown>
        ))}
        {search}
        <div className="flex-1" />
        <span role="status" className="text-[13px] text-zinc-700 tabular-nums">{countLabel}</span>
      </div>

      {/* Mobile: filters live in a bottom sheet */}
      <div className="flex md:hidden items-center gap-2">
        <button
          type="button"
          onClick={() => setSheet(true)}
          className="flex items-center gap-1.5 h-10 px-3 rounded-md border border-zinc-200 bg-white text-zinc-900 text-[13px] font-medium cursor-pointer"
        >
          <Icon name="filter" size={14} />
          {chips.length ? `Filters · ${chips.length}` : 'Filters'}
        </button>
        <span role="status" className="flex-1 text-[12.5px] text-zinc-600 tabular-nums">
          {formatCount(resultCount)} of {formatCount(slides.length)}
        </span>
        <select
          aria-label="Sort slides"
          value={sort ? `${sort.column}:${sort.direction}` : ''}
          onChange={(e) => {
            const [column, direction] = e.target.value.split(':');
            setSort(column ? { column, direction: direction as 'asc' | 'desc' } : null);
          }}
          className="h-10 max-w-[140px] border border-zinc-200 rounded-md bg-white text-zinc-900 text-[13px] px-1.5"
        >
          <option value="">Default order</option>
          <option value="id:asc">Slide ID</option>
          <option value="cancerType:asc">Cancer type</option>
          <option value="clusterId:asc">Cluster</option>
          {keyFeatures.map((f) => <option key={f.name} value={`${f.name}:desc`}>{f.displayName} ↓</option>)}
        </select>
      </div>

      {chips.length > 0 && (
        <div className="flex items-center gap-1.5 md:flex-wrap overflow-x-auto scrollbar-hide">
          {chips.map((c) => (
            <button
              key={`${c.kind}:${c.label}`}
              type="button"
              onClick={c.remove}
              aria-label={`Remove filter ${c.kind} ${c.label}`}
              title={c.title}
              className="flex-none flex items-center gap-1.5 h-[26px] pl-2.5 pr-1.5 rounded-full border border-zinc-200 bg-white text-zinc-700 text-xs cursor-pointer hover:border-zinc-500"
            >
              {c.kind && <span className="text-zinc-500">{c.kind}</span>}
              {c.label}
              <span aria-hidden="true" className="text-sm leading-none text-zinc-600">×</span>
            </button>
          ))}
          <button type="button" onClick={clearAll} className="flex-none h-[26px] px-1.5 text-blue-700 text-[12.5px] cursor-pointer">
            Clear all
          </button>
        </div>
      )}

      {sheet && (
        <div className="md:hidden">
          <div className="fixed inset-0 z-[60] bg-zinc-950/50" onClick={() => setSheet(false)} />
          <div role="dialog" aria-label="Filters" className="fixed inset-x-0 bottom-0 z-[61] max-h-[86%] flex flex-col bg-white rounded-t-[14px] shadow-2xl">
            <div className="flex items-center pl-4 pr-1.5 pt-1.5 pb-1.5 border-b border-zinc-100">
              <h2 className="flex-1 text-base font-semibold text-zinc-900">Filters</h2>
              <button type="button" onClick={clearAll} className="h-11 px-2.5 text-blue-700 text-[13px] cursor-pointer">Clear all</button>
              <button type="button" onClick={() => setSheet(false)} aria-label="Close filters" className="w-11 h-11 text-zinc-700 text-[22px] cursor-pointer">×</button>
            </div>
            <div className="flex-1 overflow-auto px-4 py-3 flex flex-col gap-[18px] text-zinc-900">
              {search}
              {sections.map((s) => (
                <fieldset key={s.key} className="flex-none min-w-0">
                  <legend className={`mb-1.5 ${EYEBROW}`}>{s.key === 'features' ? 'Feature range' : s.label}</legend>
                  <div className={s.key === 'features' ? 'border border-zinc-200 rounded-lg' : ''}>
                    {s.content(() => setSheet(false))}
                  </div>
                </fieldset>
              ))}
            </div>
            <div className="px-4 pt-2.5 pb-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setSheet(false)}
                className="w-full h-[46px] rounded-lg bg-blue-600 text-white font-semibold text-sm tabular-nums cursor-pointer"
              >
                Show {formatCount(resultCount)} slides
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
