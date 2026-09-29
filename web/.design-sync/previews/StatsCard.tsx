import { StatsCard } from 'web';

export const SurvivalSummary = () => (
  <StatsCard
    className="w-80"
    title="Nuclear pleomorphism · OS"
    summary={{
      effect: 1.42, effectLabel: 'Hazard Ratio', ci: [1.18, 1.71], p: 0.00021, pAdj: 0.0034,
      correctionFamily: 'BH', nTests: 384, ciMethod: 'Wald', n: 1042, nEvents: 148, model: 'Cox PH', warnings: [],
    }}
  />
);

export const CorrelationSummary = () => (
  <StatsCard
    className="w-80"
    title="Lymphocyte density · CD8A"
    summary={{
      effect: 0.37, effectLabel: 'Spearman rho', ci: [0.31, 0.43], p: null, pAdj: 0.00008,
      correctionFamily: 'BH', nTests: null, ciMethod: 'bootstrap percentile', n: 987, nEvents: null, model: null, warnings: [],
    }}
  />
);

export const Empty = () => <StatsCard className="w-80" summary={null} />;
