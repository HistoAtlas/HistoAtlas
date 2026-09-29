import { useSyncExternalStore } from 'react';
import { ALL_FEATURES } from '../../data/featureGlossary';
import type { FeatureMetadata } from '../../types';

/** Swatch colour of the n-th cluster (theme-aware CSS variable). */
export const clusterVar = (index: number) => `--k${((index % 10) + 10) % 10}`;

/** Split a slide file name into its barcode and UUID ("TCGA-…-DX1.<uuid>.svs"). */
export function parseSlideId(id: string) {
  const stem = id.replace(/\.svs$/i, '');
  const dot = stem.indexOf('.');
  const barcode = dot > 0 ? stem.slice(0, dot) : stem;
  const uuid = dot > 0 ? stem.slice(dot + 1) : null;
  const patient = barcode.startsWith('TCGA-') ? barcode.slice(0, 12) : null;
  return { barcode, uuid, patient };
}

export function formatValue(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  const abs = Math.abs(v);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export const formatCount = (n: number) => n.toLocaleString('en-US');

export interface AtlasFeature extends FeatureMetadata {
  description?: string;
}

export interface FeatureFamily {
  label: string;
  feats: AtlasFeature[];
}

const GLOSSARY_BY_NAME = new Map(ALL_FEATURES.map((f) => [f.name, f]));

/** Group the cohort's features by glossary family (A–M), in glossary order. */
export function groupFeatures(metadata: FeatureMetadata[]): FeatureFamily[] {
  const families = new Map<string, AtlasFeature[]>();
  const sorted = [...metadata].sort(
    (a, b) => (GLOSSARY_BY_NAME.get(a.name)?.id ?? 999) - (GLOSSARY_BY_NAME.get(b.name)?.id ?? 999),
  );
  for (const m of sorted) {
    const g = GLOSSARY_BY_NAME.get(m.name);
    const label = g?.section ?? 'Other';
    if (!families.has(label)) families.set(label, []);
    families.get(label)!.push({ ...m, description: g?.description });
  }
  return [...families].map(([label, feats]) => ({ label, feats }));
}

function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

export function useIsDark() {
  return useSyncExternalStore(
    subscribeToTheme,
    () => document.documentElement.dataset.theme === 'dark',
    () => false,
  );
}

function subscribeToResize(onChange: () => void) {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

/** True below the `lg` breakpoint, where the workspace stacks. */
export function useIsCompact() {
  return useSyncExternalStore(
    subscribeToResize,
    () => window.innerWidth < 1024,
    () => false,
  );
}

export const EYEBROW = 'text-[11px] font-semibold tracking-wider uppercase text-zinc-500';
export const POPOVER = 'bg-white border border-zinc-200 rounded-lg shadow-xl';
