import { useEffect, useMemo, useRef, useState } from 'react';
import { interpolateViridis } from 'd3-scale-chromatic';
import type { Cluster, Slide } from '../../types';
import { IMMUNE_SUBTYPE_COLORS } from '../../lib/colors';
import { COHORT_FULL_NAMES } from '../../data/cohortNames';
import { ORGAN_SYSTEMS, organOf } from '../../data/organSystems';
import { Thumb } from './parts';
import { Icon } from '../ui/Icon';
import {
  EYEBROW,
  POPOVER,
  clusterVar,
  formatCount,
  formatValue,
  parseSlideId,
  useIsDark,
  type FeatureFamily,
} from './shared';

const VIRIDIS = Array.from({ length: 24 }, (_, i) => interpolateViridis(i / 23));
const VIRIDIS_CSS = `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => interpolateViridis(t)).join(', ')})`;
const CATEGORICAL = ['clusterId', 'cancerType', 'immuneSubtype'];

interface CanvasOptions {
  xs: Float32Array;
  ys: Float32Array;
  colors: string[];
  active: Uint8Array | null;
  highlight: number;
  pin: number;
  mode: 'pan' | 'box';
  touchPan: boolean;
}

interface Tip {
  i: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CanvasHandlers {
  onHover: (i: number) => void;
  onSelect: (indices: number[]) => void;
  onClick: (i: number) => void;
  onTip: (tip: Tip | null) => void;
}

/** 2D-canvas scatter plot with pan, zoom and box select. Colours come from the page theme. */
class UmapCanvas {
  private c: HTMLCanvasElement;
  private ro: ResizeObserver;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private view = { s: 1, s0: 1, ox: 0, oy: 0 };
  private bounds = [0, 0, 1, 1];
  private userMoved = false;
  private hover = -1;
  private box: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private down: { x: number; y: number; ox: number; oy: number; moved: boolean; box: boolean } | null = null;
  private tipKey = '';
  private el: HTMLElement;
  private o: CanvasOptions;
  private handlers: () => CanvasHandlers;

  constructor(el: HTMLElement, o: CanvasOptions, handlers: () => CanvasHandlers) {
    this.el = el;
    this.o = o;
    this.handlers = handlers;
    this.c = document.createElement('canvas');
    this.c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;cursor:crosshair';
    el.appendChild(this.c);
    this.computeBounds();
    this.bind();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    this.resize();
  }

  destroy() {
    this.ro.disconnect();
    this.c.remove();
  }

  set(o: CanvasOptions) {
    const newData = o.xs !== this.o.xs;
    this.o = o;
    this.c.style.touchAction = o.touchPan ? 'none' : '';
    if (newData) {
      this.computeBounds();
      this.hover = -1;
      this.userMoved = false;
      this.fit();
    }
    this.draw();
  }

  zoom(f: number, px = this.w / 2, py = this.h / 2) {
    const v = this.view;
    v.ox = px - (px - v.ox) * f;
    v.oy = py - (py - v.oy) * f;
    v.s *= f;
    this.userMoved = true;
    this.draw();
  }

  reset() {
    this.userMoved = false;
    this.fit();
    this.draw();
  }

  private computeBounds() {
    const { xs, ys } = this.o;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < xs.length; i++) {
      if (xs[i] < x0) x0 = xs[i];
      if (xs[i] > x1) x1 = xs[i];
      if (ys[i] < y0) y0 = ys[i];
      if (ys[i] > y1) y1 = ys[i];
    }
    this.bounds = xs.length ? [x0, y0, x1, y1] : [0, 0, 1, 1];
  }

  private resize() {
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    if (!w || !h) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.c.width = w * this.dpr;
    this.c.height = h * this.dpr;
    this.w = w;
    this.h = h;
    if (!this.userMoved) this.fit();
    this.draw();
  }

  private fit() {
    if (!this.w) return;
    const [x0, y0, x1, y1] = this.bounds, pad = 12;
    const s = Math.min((this.w - 2 * pad) / (x1 - x0 || 1), (this.h - 2 * pad) / (y1 - y0 || 1));
    this.view = { s, s0: s, ox: this.w / 2 - (s * (x0 + x1)) / 2, oy: this.h / 2 - (s * (y0 + y1)) / 2 };
  }

  private sx(i: number) { return this.view.ox + this.view.s * this.o.xs[i]; }
  private sy(i: number) { return this.view.oy + this.view.s * this.o.ys[i]; }
  private active(i: number) { return !this.o.active || this.o.active[i] === 1; }

  private local(e: PointerEvent | WheelEvent) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private draw() {
    if (!this.w) return;
    const ctx = this.c.getContext('2d');
    if (!ctx) return;
    const cs = getComputedStyle(this.el);
    const g = (n: string, fallback: string) => cs.getPropertyValue(n).trim() || fallback;
    const bg = g('--plot-bg', '#fff'), ink = g('--color-zinc-900', '#18181b'), acc = g('--color-blue-600', '#2563eb');
    const { xs, colors } = this.o, v = this.view;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);

    const r = Math.max(1.1, Math.min(4, 1.25 * Math.sqrt(v.s / v.s0))), size = r * 2;
    ctx.fillStyle = g('--plot-faint', 'rgba(113,113,122,.16)');
    const buckets = new Map<string, number[]>();
    for (let i = 0; i < xs.length; i++) {
      const x = this.sx(i), y = this.sy(i);
      if (x < -5 || y < -5 || x > this.w + 5 || y > this.h + 5) continue;
      if (!this.active(i)) { ctx.fillRect(x - r, y - r, size, size); continue; }
      let b = buckets.get(colors[i]);
      if (!b) buckets.set(colors[i], (b = []));
      b.push(x, y);
    }
    ctx.globalAlpha = 0.82;
    buckets.forEach((b, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let j = 0; j < b.length; j += 2) {
        ctx.moveTo(b[j] + r, b[j + 1]);
        ctx.arc(b[j], b[j + 1], r, 0, 6.2832);
      }
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    for (const i of [this.o.highlight, this.o.pin, this.hover]) {
      if (i < 0 || i >= xs.length) continue;
      const x = this.sx(i), y = this.sy(i);
      ctx.lineWidth = 2; ctx.strokeStyle = bg;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.2832); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = ink;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = colors[i];
      ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 6.2832); ctx.fill();
    }

    if (this.box) {
      const b = this.box, x = Math.min(b.x0, b.x1), y = Math.min(b.y0, b.y1);
      const w = Math.abs(b.x1 - b.x0), h = Math.abs(b.y1 - b.y0);
      ctx.fillStyle = acc; ctx.globalAlpha = 0.1; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
      ctx.setLineDash([4, 3]); ctx.strokeStyle = acc; ctx.lineWidth = 1.25;
      ctx.strokeRect(x + 0.5, y + 0.5, w, h); ctx.setLineDash([]);
    }

    const t = this.hover >= 0 ? this.hover : this.o.pin;
    const tip = t >= 0 && t < xs.length ? { i: t, x: this.sx(t), y: this.sy(t), w: this.w, h: this.h } : null;
    const key = tip ? `${tip.i}:${tip.x | 0}:${tip.y | 0}:${tip.w}:${tip.h}` : '';
    if (key !== this.tipKey) {
      this.tipKey = key;
      this.handlers().onTip(tip);
    }
  }

  private nearest(px: number, py: number) {
    let best = -1, bd = 64;
    for (let i = 0; i < this.o.xs.length; i++) {
      if (!this.active(i)) continue;
      const dx = this.sx(i) - px, dy = this.sy(i) - py, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  private setHover(i: number) {
    if (i === this.hover) return;
    this.hover = i;
    this.draw();
    this.handlers().onHover(i);
  }

  private bind() {
    const c = this.c;
    c.addEventListener('pointerdown', (e) => {
      const p = this.local(e);
      this.down = { ...p, ox: this.view.ox, oy: this.view.oy, moved: false, box: this.o.mode === 'box' || e.shiftKey };
      if (this.o.touchPan || e.pointerType === 'mouse') c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.local(e), d = this.down;
      if (d) {
        if (Math.abs(p.x - d.x) + Math.abs(p.y - d.y) > 3) d.moved = true;
        if (!d.moved) return;
        if (d.box) this.box = { x0: d.x, y0: d.y, x1: p.x, y1: p.y };
        else if (this.o.touchPan || e.pointerType === 'mouse') {
          this.view.ox = d.ox + p.x - d.x;
          this.view.oy = d.oy + p.y - d.y;
          this.userMoved = true;
        }
        this.hover = -1;
        this.draw();
        return;
      }
      const n = this.nearest(p.x, p.y);
      this.setHover(n);
      c.style.cursor = n >= 0 ? 'pointer' : this.o.mode === 'box' ? 'crosshair' : 'grab';
    });
    c.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (!d) return;
      if (d.box && d.moved && this.box) {
        const b = this.box, out: number[] = [];
        const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1);
        const y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
        for (let i = 0; i < this.o.xs.length; i++) {
          if (!this.active(i)) continue;
          const x = this.sx(i), y = this.sy(i);
          if (x >= x0 && x <= x1 && y >= y0 && y <= y1) out.push(i);
        }
        this.box = null;
        this.draw();
        if (out.length) this.handlers().onSelect(out);
        return;
      }
      this.box = null;
      if (!d.moved) {
        // Touch has no hover: resolve the tapped point here
        const p = this.local(e), n = this.hover >= 0 ? this.hover : this.nearest(p.x, p.y);
        if (n >= 0) this.handlers().onClick(n);
      }
      this.draw();
    });
    c.addEventListener('pointerleave', () => {
      if (!this.down) this.setHover(-1);
    });
    c.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const p = this.local(e);
      this.zoom(Math.exp(-e.deltaY * 0.01), p.x, p.y);
    }, { passive: false });
  }
}

interface UmapPanelProps {
  slides: Slide[];
  clusters: Cluster[];
  families: FeatureFamily[];
  showCancerType: boolean;
  colorBy: string;
  onColorBy: (value: string) => void;
  isolate: string | null;
  onIsolate: (clusterId: string | null) => void;
  /** Slides that pass the filters; null means all of them. */
  activeIds: Set<string> | null;
  highlightId: string | null;
  pinId: string | null;
  onHover: (slideId: string | null) => void;
  onSelect: (slideIds: string[]) => void;
  onPointClick: (slideId: string) => void;
  selCount: number;
  onClearSel: () => void;
  dataVersion?: string;
  dataUpdatedAt?: string;
  compact: boolean;
}

const CONTROL = 'bg-white border border-zinc-200 rounded-md';

export function UmapPanel({
  slides, clusters, families, showCancerType, colorBy, onColorBy, isolate, onIsolate, activeIds,
  highlightId, pinId, onHover, onSelect, onPointClick, selCount, onClearSel, dataVersion, dataUpdatedAt, compact,
}: UmapPanelProps) {
  const dark = useIsDark();
  const [mode, setMode] = useState<'pan' | 'box'>('pan');
  const [info, setInfo] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<UmapCanvas | null>(null);
  const handlersRef = useRef<CanvasHandlers | null>(null);

  const feature = useMemo(
    () => families.flatMap((f) => f.feats).find((f) => f.name === colorBy),
    [families, colorBy],
  );
  const clusterIndex = useMemo(() => new Map(clusters.map((c, i) => [c.id, i])), [clusters]);
  const indexById = useMemo(() => new Map(slides.map((s, i) => [s.id, i])), [slides]);

  // The plot keeps the orientation of the published figures: UMAP y runs horizontally, x downwards.
  const coords = useMemo(
    () => ({ xs: Float32Array.from(slides, (s) => s.y), ys: Float32Array.from(slides, (s) => s.x) }),
    [slides],
  );

  const colors = useMemo(() => {
    const cs = getComputedStyle(document.documentElement);
    const css = (name: string) => cs.getPropertyValue(name).trim();
    const na = css('--plot-na') || '#c4c4c9';
    const lo = feature?.quantiles.p01 ?? 0, span = (feature?.quantiles.p99 ?? 1) - lo || 1;
    return slides.map((s) => {
      if (colorBy === 'clusterId') {
        const i = s.clusterId == null ? undefined : clusterIndex.get(s.clusterId);
        return i == null ? na : css(clusterVar(i));
      }
      if (colorBy === 'cancerType') {
        const organ = organOf(s.cancerType);
        return organ ? css(organ.cssVar) : na;
      }
      if (colorBy === 'immuneSubtype') return IMMUNE_SUBTYPE_COLORS[s.immuneSubtype ?? ''] ?? na;
      const v = s.features[colorBy];
      if (v == null || !Number.isFinite(v)) return na;
      return VIRIDIS[Math.max(0, Math.min(23, Math.round((23 * (v - lo)) / span)))];
    });
    // `dark` is a dependency because the resolved CSS colours change with the theme
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, colorBy, clusterIndex, feature, dark]);

  const active = useMemo(() => {
    if (!activeIds && isolate == null) return null;
    return Uint8Array.from(slides, (s) =>
      (!activeIds || activeIds.has(s.id)) && (isolate == null || s.clusterId === isolate) ? 1 : 0,
    );
  }, [slides, activeIds, isolate]);

  const options: CanvasOptions = {
    ...coords,
    colors,
    active,
    highlight: highlightId ? (indexById.get(highlightId) ?? -1) : -1,
    pin: pinId ? (indexById.get(pinId) ?? -1) : -1,
    mode,
    touchPan: !compact,
  };

  // Runs after every render on purpose: it pushes the latest props into the imperative canvas
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    handlersRef.current = {
      onHover: (i) => onHover(i >= 0 ? slides[i].id : null),
      onSelect: (indices) => onSelect(indices.map((i) => slides[i].id)),
      onClick: (i) => onPointClick(slides[i].id),
      onTip: setTip,
    };
    if (!canvasRef.current && plotRef.current) {
      canvasRef.current = new UmapCanvas(plotRef.current, options, () => handlersRef.current!);
    }
    canvasRef.current?.set(options);
  });
  useEffect(() => () => canvasRef.current?.destroy(), []);

  const counts = useMemo(() => {
    const byCluster = new Map<string, number>(), byOrgan = new Map<string, number>(), byImmune = new Map<string, number>();
    const types = new Map<string, Set<string>>();
    let missing = 0;
    for (const s of slides) {
      const organ = organOf(s.cancerType)?.id;
      if (organ) {
        byOrgan.set(organ, (byOrgan.get(organ) ?? 0) + 1);
        if (!types.has(organ)) types.set(organ, new Set());
        types.get(organ)!.add(s.cancerType);
      }
      if (feature && !Number.isFinite(s.features[feature.name] ?? NaN)) missing++;
      if (activeIds && !activeIds.has(s.id)) continue;
      if (s.clusterId != null) byCluster.set(s.clusterId, (byCluster.get(s.clusterId) ?? 0) + 1);
      if (s.immuneSubtype) byImmune.set(s.immuneSubtype, (byImmune.get(s.immuneSubtype) ?? 0) + 1);
    }
    return { byCluster, byOrgan, byImmune, types, missing };
  }, [slides, activeIds, feature]);

  const isoCluster = isolate == null ? undefined : clusters.find((c) => c.id === isolate);
  const tipSlide = tip ? slides[tip.i] : undefined;
  const legendShown = !compact || legendOpen;
  const updated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return (
    <div className="relative h-full min-h-0 flex flex-col bg-white text-zinc-900 border border-zinc-200 rounded-lg text-[13px] leading-snug">
      <div className="flex items-center gap-2 flex-wrap min-h-12 py-2 pl-3.5 pr-2.5 border-b border-zinc-100">
        <h2 className="text-[13.5px] font-semibold">
          {compact ? 'UMAP · slide histomics' : 'UMAP of slide-level histomic features'}
        </h2>
        <button
          type="button"
          aria-label="About this plot"
          aria-expanded={info}
          onClick={() => setInfo((v) => !v)}
          className="w-[26px] h-[26px] flex items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 cursor-pointer"
        >
          <Icon name="info" size={14} />
        </button>
        <div className="flex-1" />
        <label className="flex items-center gap-2 text-xs text-zinc-600">
          Color by
          <select
            aria-label="Color points by"
            value={colorBy}
            onChange={(e) => onColorBy(e.target.value)}
            className="h-[30px] max-w-[190px] border border-zinc-200 rounded-md bg-white text-zinc-900 text-[12.5px] px-1.5"
          >
            <option value="clusterId">Cluster</option>
            {showCancerType && <option value="cancerType">Cancer type (organ system)</option>}
            <option value="immuneSubtype">Immune subtype</option>
            {families.map((fam) => (
              <optgroup key={fam.label} label={fam.label}>
                {fam.feats.map((f) => <option key={f.name} value={f.name}>{f.displayName}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      {info && (
        <div role="dialog" aria-label="About this plot" className={`absolute top-11 left-3 z-20 w-[330px] max-w-[calc(100%-24px)] p-3.5 flex flex-col gap-2.5 text-[12.5px] text-zinc-700 ${POPOVER}`}>
          <div>
            <div className="font-semibold text-zinc-900 mb-0.5">Embedding</div>
            UMAP of the z-scored slide-level features · n_neighbors = 15, min_dist = 0.1, euclidean metric. Axes have no units.
          </div>
          <div>
            <div className="font-semibold text-zinc-900 mb-0.5">Interactions</div>
            Drag to pan · ⌘/Ctrl + scroll or +/− to zoom · Box select (or Shift-drag) filters the table · click a point to preview the slide.
          </div>
          {dataVersion && (
            <div className="flex justify-between border-t border-zinc-100 pt-2 text-zinc-600">
              <span>Data version</span>
              <span className="tabular-nums">
                <span className="font-mono text-[11.5px]">{dataVersion}</span>
                {updated && !Number.isNaN(updated.getTime()) &&
                  ` · ${updated.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-b-lg">
        <div className="relative min-w-0 min-h-[200px] flex-1">
          <div
            ref={plotRef}
            role="img"
            aria-label={`UMAP embedding of ${formatCount(slides.length)} slides, ${formatCount(activeIds?.size ?? slides.length)} matching the filters`}
            className="absolute inset-0"
            style={{ background: 'var(--plot-bg)' }}
          />
          {tipSlide && tip && (
            <div
              className={`absolute z-10 pointer-events-none flex gap-2.5 p-2.5 w-[272px] text-xs leading-snug ${POPOVER}`}
              style={{
                left: Math.max(4, tip.x + 14 + 272 > tip.w - 4 ? tip.x - 272 - 14 : tip.x + 14),
                top: Math.max(4, tip.y + 14 + 110 > tip.h - 4 ? tip.y - 110 - 14 : tip.y + 14),
              }}
            >
              <Thumb slideId={tipSlide.id} className="w-[60px] h-[60px] rounded" />
              <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                <div className="font-mono text-[11px] font-semibold truncate">{parseSlideId(tipSlide.id).barcode}</div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full flex-none ${organOf(tipSlide.cancerType)?.dot ?? 'bg-zinc-400'}`} />
                  <span className="truncate">{COHORT_FULL_NAMES[tipSlide.cancerType] ?? tipSlide.cancerType}</span>
                  <span className="text-zinc-500">{tipSlide.cancerType}</span>
                </div>
                {tipSlide.clusterId != null && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-[9px] h-[9px] rounded-sm flex-none" style={{ background: `var(${clusterVar(clusterIndex.get(tipSlide.clusterId) ?? 8)})` }} />
                    <span className="font-semibold tabular-nums">{tipSlide.clusterId}</span>
                    <span className="text-zinc-600 truncate">{clusters.find((c) => c.id === tipSlide.clusterId)?.name}</span>
                  </div>
                )}
                {feature && (
                  <div className="flex justify-between gap-2 border-t border-zinc-100 pt-1 mt-0.5">
                    <span className="text-zinc-600 truncate">{feature.displayName}</span>
                    {formatValue(tipSlide.features[feature.name]) == null
                      ? <span className="italic text-zinc-500">not measured</span>
                      : <span className="font-semibold tabular-nums whitespace-nowrap">{formatValue(tipSlide.features[feature.name])} <span className="font-normal text-zinc-500">{feature.unit}</span></span>}
                  </div>
                )}
                <div className="text-zinc-500 text-[11px]">Click to open slide preview</div>
              </div>
            </div>
          )}

          <div className="absolute top-2 left-2 z-[5] flex flex-col gap-1.5 items-start">
            {isoCluster && (
              <div className="flex items-center gap-2 h-7 pl-2.5 pr-1 rounded-full bg-white border border-zinc-200 text-xs shadow-sm whitespace-nowrap max-w-[300px]">
                <span className="w-[9px] h-[9px] rounded-sm flex-none" style={{ background: `var(${clusterVar(clusterIndex.get(isoCluster.id) ?? 8)})` }} />
                <span className="truncate">Cluster {isoCluster.id} · {isoCluster.name}</span>
                <button type="button" onClick={() => onIsolate(null)} className="h-[22px] px-2 rounded-full bg-zinc-100 text-zinc-700 text-[11.5px] cursor-pointer">Show all</button>
              </div>
            )}
            {selCount > 0 && (
              <div className="flex items-center gap-2 h-7 pl-2.5 pr-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                <span className="tabular-nums">{formatCount(selCount)} slides selected</span>
                <button type="button" onClick={onClearSel} className="h-[22px] px-2 rounded-full bg-white text-blue-700 text-[11.5px] cursor-pointer">Clear</button>
              </div>
            )}
          </div>

          <div className="absolute top-2 right-2 z-[5] flex flex-col gap-1.5 items-end">
            {!compact && (
              <div role="group" aria-label="Pointer mode" className={`flex p-0.5 ${CONTROL}`}>
                {(['pan', 'box'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                    className={`h-[26px] px-2.5 rounded text-xs text-zinc-900 cursor-pointer ${mode === m ? 'bg-zinc-100' : ''}`}
                  >
                    {m === 'pan' ? 'Pan' : 'Box select'}
                  </button>
                ))}
              </div>
            )}
            <div className={`flex flex-col overflow-hidden ${CONTROL}`}>
              <button type="button" aria-label="Zoom in" onClick={() => canvasRef.current?.zoom(1.4)} className="w-[30px] h-[30px] text-base text-zinc-900 hover:bg-zinc-100 cursor-pointer">+</button>
              <button type="button" aria-label="Zoom out" onClick={() => canvasRef.current?.zoom(1 / 1.4)} className="w-[30px] h-[30px] text-base text-zinc-900 border-t border-zinc-100 hover:bg-zinc-100 cursor-pointer">−</button>
              <button type="button" aria-label="Reset view" title="Reset view" onClick={() => canvasRef.current?.reset()} className="w-[30px] h-[30px] flex items-center justify-center text-zinc-900 border-t border-zinc-100 hover:bg-zinc-100 cursor-pointer">
                <Icon name="rotate-ccw" size={14} />
              </button>
            </div>
          </div>

          {compact && (
            <button
              type="button"
              aria-expanded={legendOpen}
              onClick={() => setLegendOpen((v) => !v)}
              className={`absolute left-2 bottom-2 z-[5] h-8 px-2.5 text-[12.5px] text-zinc-900 cursor-pointer ${CONTROL}`}
            >
              {legendOpen ? 'Hide legend' : 'Legend'}
            </button>
          )}
        </div>

        {legendShown && (
          <div aria-label="Legend" className="flex-none max-h-[45%] overflow-auto bg-white px-2.5 pt-2.5 pb-3 border-t border-zinc-100">
            {colorBy === 'clusterId' && (
              <>
                <div className="flex flex-col px-1 pb-1.5">
                  <span className={EYEBROW}>Clusters · all {clusters.length} shown</span>
                  <span className="text-[11px] text-zinc-500">Click to isolate · hover for full name</span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-x-2 gap-y-px">
                  {clusters.map((c, i) => (
                    <button
                      key={c.id}
                      type="button"
                      title={`Cluster ${c.id}: ${c.name}`}
                      aria-pressed={isolate === c.id}
                      onClick={() => onIsolate(isolate === c.id ? null : c.id)}
                      className={`grid grid-cols-[10px_16px_minmax(0,1fr)_auto] gap-1.5 items-center min-h-7 px-1 py-0.5 rounded text-left text-[12.5px] cursor-pointer hover:bg-zinc-100 ${isolate === c.id ? 'bg-blue-50' : ''} ${isolate == null || isolate === c.id ? 'text-zinc-900' : 'text-zinc-500'}`}
                    >
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: `var(${clusterVar(i)})` }} />
                      <span className="font-semibold tabular-nums">{c.id}</span>
                      <span className="truncate">{c.name}</span>
                      <span className="text-[11.5px] text-zinc-500 tabular-nums">{formatCount(counts.byCluster.get(c.id) ?? 0)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {colorBy === 'cancerType' && (
              <>
                <div className={`px-1 pb-1.5 ${EYEBROW}`}>Cancer type · by organ system</div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-x-2 gap-y-1">
                  {ORGAN_SYSTEMS.filter((o) => counts.byOrgan.has(o.id)).map((o) => (
                    <div key={o.id} className="grid grid-cols-[10px_minmax(0,1fr)_auto] gap-1.5 items-start px-1 py-0.5 text-[12.5px]">
                      <span className={`w-[9px] h-[9px] rounded-full mt-[5px] ${o.dot}`} />
                      <span>
                        <span className="block">{o.label}</span>
                        <span className="block text-[11px] text-zinc-500">{[...counts.types.get(o.id)!].sort().join(' · ')}</span>
                      </span>
                      <span className="text-[11.5px] text-zinc-500 tabular-nums">{formatCount(counts.byOrgan.get(o.id)!)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {colorBy === 'immuneSubtype' && (
              <>
                <div className={`px-1 pb-1.5 ${EYEBROW}`}>Immune subtype · Thorsson</div>
                {Object.entries(IMMUNE_SUBTYPE_COLORS).map(([key, color]) => (
                  <div key={key} className="grid grid-cols-[10px_minmax(0,1fr)_auto] gap-1.5 items-center px-1 py-1 text-[12.5px]">
                    <span className="w-[9px] h-[9px] rounded-full" style={{ background: color }} />
                    <span>{key}</span>
                    <span className="text-[11.5px] text-zinc-500 tabular-nums">{formatCount(counts.byImmune.get(key) ?? 0)}</span>
                  </div>
                ))}
              </>
            )}
            {feature && !CATEGORICAL.includes(colorBy) && (
              <div className="px-1 flex flex-col gap-2">
                <div className={EYEBROW}>{families.find((f) => f.feats.includes(feature))?.label}</div>
                <div className="text-[13px] font-semibold">{feature.displayName} <span className="font-normal text-zinc-500">{feature.unit}</span></div>
                <div aria-hidden="true" className="h-3 rounded-[3px]" style={{ background: VIRIDIS_CSS }} />
                <div className="flex justify-between text-[11.5px] text-zinc-600 tabular-nums">
                  <span>{formatValue(feature.quantiles.p01)}</span>
                  <span>median {formatValue(feature.quantiles.p50)}</span>
                  <span>{formatValue(feature.quantiles.p99)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11.5px] text-zinc-600">
                  <span className="w-[9px] h-[9px] rounded-full" style={{ background: 'var(--plot-na)' }} />
                  {formatCount(counts.missing)} slides not measured (grey)
                </div>
                <div className="text-[11px] text-zinc-500">Viridis, clipped to the 1st–99th percentile.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
