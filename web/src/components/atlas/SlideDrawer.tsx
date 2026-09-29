import type { Cluster, Slide } from '../../types';
import { useSlideData } from '../../hooks/useSlideData';
import { COHORT_FULL_NAMES } from '../../data/cohortNames';
import { organOf } from '../../data/organSystems';
import { downloadCSV } from '../../lib/export';
import { formatOrdinal } from '../../lib/formatters';
import { CopyButton, Thumb } from './parts';
import { Icon } from '../ui/Icon';
import { MiniHistogram } from '../ui/MiniHistogram';
import { EYEBROW, clusterVar, formatValue, parseSlideId, type AtlasFeature } from './shared';

interface SlideDrawerProps {
  slide: Slide;
  dataset: string;
  cohort: string;
  clusters: Cluster[];
  keyFeatures: AtlasFeature[];
  slideById: Map<string, Slide>;
  onClose: () => void;
  onLocate: (slideId: string) => void;
  onOpen: (slideId: string) => void;
}

const FOOTER_BUTTON =
  'flex items-center gap-1.5 h-[34px] px-3 rounded-md border border-zinc-200 bg-white text-zinc-700 text-[12.5px] hover:bg-zinc-100 cursor-pointer';

export function SlideDrawer({
  slide, dataset, cohort, clusters, keyFeatures, slideById, onClose, onLocate, onOpen,
}: SlideDrawerProps) {
  const { data: detail } = useSlideData(dataset, slide.id);
  const { barcode, uuid, patient } = parseSlideId(slide.id);
  const clusterIdx = clusters.findIndex((c) => c.id === slide.clusterId);
  const slideHref = `/${dataset}/${slide.cancerType}/slide/${slide.id}/`;
  const swatch = (clusterId?: string) => ({
    background: `var(${clusterVar(Math.max(0, clusters.findIndex((c) => c.id === clusterId)))})`,
  });

  const exportFeatures = () =>
    downloadCSV(
      `${barcode}_features.csv`,
      ['feature', 'value'],
      Object.entries(slide.features).map(([name, v]) => [name, v == null ? '' : String(v)]),
    );

  return (
    <aside
      role="dialog"
      aria-label="Slide preview"
      className="fixed top-[52px] right-0 bottom-0 z-40 w-full md:w-[420px] flex flex-col bg-white text-zinc-900 text-[13px] leading-snug border-l border-zinc-200 shadow-[-12px_0_32px_rgba(0,0,0,0.12)]"
    >
      <div className="flex items-start gap-2 pt-3.5 pb-3 pl-[18px] pr-3 border-b border-zinc-100">
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className={EYEBROW}>Slide preview</span>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-sm font-semibold truncate">{barcode}</span>
            <CopyButton text={barcode} label="Copy barcode" className="border border-zinc-200" />
          </div>
          {uuid && (
            <div className="flex items-center gap-1.5 min-w-0 text-[11.5px] text-zinc-500">
              <span>UUID</span>
              <span className="font-mono truncate text-zinc-600">{uuid}</span>
              <CopyButton text={uuid} label="Copy slide UUID" />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="flex-none w-9 h-9 rounded-md text-zinc-700 text-[22px] leading-none hover:bg-zinc-100 cursor-pointer"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-auto px-[18px] py-4 flex flex-col gap-[18px]">
        <div className="relative">
          <Thumb slideId={slide.id} className="w-full aspect-[4/3] rounded-lg" />
          <a
            href={slideHref}
            className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5 h-8 px-3 rounded-md bg-white text-zinc-900 text-[12.5px] font-medium shadow"
          >
            <Icon name="microscope" size={14} />
            Open slide page
          </a>
        </div>

        <dl className="grid grid-cols-[118px_minmax(0,1fr)] gap-x-3 gap-y-2">
          <dt className="text-zinc-600">Cancer type</dt>
          <dd className="flex items-center gap-1.5 min-w-0">
            <span className={`w-2 h-2 rounded-full flex-none ${organOf(slide.cancerType)?.dot ?? 'bg-zinc-400'}`} />
            <span>{COHORT_FULL_NAMES[slide.cancerType] ?? slide.cancerType}</span>
            <span className="text-zinc-500">{slide.cancerType}</span>
          </dd>
          <dt className="text-zinc-600">Cluster</dt>
          <dd>
            {clusterIdx < 0 ? '—' : (
              <a href={`/${dataset}/${cohort}/cluster/${slide.clusterId}/`} className="flex items-start gap-1.5 text-zinc-900 hover:underline">
                <span className="w-2.5 h-2.5 rounded-sm flex-none mt-1" style={swatch(slide.clusterId)} />
                <strong className="font-semibold tabular-nums">{slide.clusterId}</strong>
                <span>{clusters[clusterIdx].name}</span>
              </a>
            )}
          </dd>
          <dt className="text-zinc-600">Immune subtype</dt>
          <dd>
            {slide.immuneSubtype ?? 'Not reported'}
            {slide.immuneSubtype && <span className="block text-[11.5px] text-zinc-500">Thorsson et al., 2018</span>}
          </dd>
          <dt className="text-zinc-600">Stage · grade</dt>
          <dd>{slide.stage ?? 'Not reported'} · {slide.grade ?? 'Not reported'}</dd>
          {patient && (
            <>
              <dt className="text-zinc-600">Patient</dt>
              <dd className="font-mono text-xs">{patient}</dd>
            </>
          )}
        </dl>

        <section className="flex flex-col gap-1">
          <div className="flex justify-between items-baseline">
            <h3 className="text-[12.5px] font-semibold">Key histomic features</h3>
            <span className="text-[11.5px] text-zinc-500">position in cohort</span>
          </div>
          {keyFeatures.map((f) => {
            const value = formatValue(slide.features[f.name]);
            const pct = detail?.featurePercentiles?.[f.name];
            return (
              <div key={f.name} className="grid grid-cols-[minmax(0,1fr)_auto_84px] gap-2.5 items-center py-[7px] border-b border-zinc-100">
                <span className="min-w-0">
                  <span className="block">{f.displayName}</span>
                  <span className="block text-[11.5px] text-zinc-500">
                    {value == null ? 'Not measured on this slide' : pct == null ? ' ' : `${formatOrdinal(Math.round(pct))} percentile`}
                  </span>
                </span>
                <span className="text-right tabular-nums font-semibold">
                  {value ?? 'n/a'}
                  <span className="block text-[11px] font-normal text-zinc-500">{f.unit}</span>
                </span>
                <span className="flex justify-end">
                  <MiniHistogram bins={f.histogramBins ?? []} percentile={pct ?? -1} color="var(--color-blue-600)" />
                </span>
              </div>
            );
          })}
          <a href={slideHref} className="text-[12.5px] text-blue-700 mt-1 hover:underline">
            All {Object.keys(slide.features).length} features for this slide →
          </a>
        </section>

        {detail?.similar?.length ? (
          <section className="flex flex-col gap-0.5">
            <h3 className="text-[12.5px] font-semibold mb-1">Nearest slides in the embedding</h3>
            {detail.similar.slice(0, 4).map((n) => {
              const inCohort = slideById.get(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  disabled={!inCohort}
                  onClick={() => onOpen(n.id)}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2.5 items-center py-1.5 text-[12.5px] text-left rounded enabled:hover:bg-zinc-100 enabled:cursor-pointer"
                >
                  <span className="font-mono text-[11.5px] truncate">{parseSlideId(n.id).barcode}</span>
                  <span className="text-zinc-600">{n.cancerType}</span>
                  <span className="flex items-center gap-1 tabular-nums min-w-6">
                    {inCohort?.clusterId != null && (
                      <>
                        <span className="w-[9px] h-[9px] rounded-sm" style={swatch(inCohort.clusterId)} />
                        {inCohort.clusterId}
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </section>
        ) : null}
      </div>

      <div className="flex gap-2 flex-wrap px-[18px] pt-3 pb-3.5 border-t border-zinc-100">
        <button
          type="button"
          onClick={() => onLocate(slide.id)}
          className="flex items-center gap-1.5 h-[34px] px-3 rounded-md bg-blue-600 text-white text-[12.5px] font-medium cursor-pointer"
        >
          <Icon name="scatter-chart" size={14} />
          Show on UMAP
        </button>
        <button type="button" onClick={exportFeatures} className={FOOTER_BUTTON}>
          <Icon name="download" size={14} />
          Features CSV
        </button>
      </div>
    </aside>
  );
}
