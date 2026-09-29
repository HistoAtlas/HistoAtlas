import { InfoTooltip } from 'web';

export const NextToLabel = () => (
  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">
    Hazard ratio
    <InfoTooltip text="Cox proportional hazards model, adjusted for age and stage." />
  </span>
);

export const LargerIcon = () => (
  <span className="inline-flex items-center gap-2 text-sm text-zinc-900">
    Evidence strength
    <InfoTooltip text="Combines adjusted p-value, effect size, CI width and sample size." className="w-5 h-5" />
  </span>
);
