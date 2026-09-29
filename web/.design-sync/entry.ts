// design-sync bundle entry: the UI primitives synced to Claude Design.
// Left out: CohortSelector (bound to the cohorts API), Equation (katex CSS pulls .ttf fonts the bundler can't load).
export * from '../src/components/ui/AssumptionChecks';
export * from '../src/components/ui/EmptyState';
export * from '../src/components/ui/EvidenceBadge';
export * from '../src/components/ui/ExportActions';
export * from '../src/components/ui/Icon';
export * from '../src/components/ui/InfoTooltip';
export * from '../src/components/ui/MiniHistogram';
export * from '../src/components/ui/PageHeader';
export * from '../src/components/ui/PillToggle';
export * from '../src/components/ui/ProvenanceBar';
export * from '../src/components/ui/SectionCard';
export * from '../src/components/ui/SegmentedControl';
export * from '../src/components/ui/Skeleton';
export * from '../src/components/ui/StatsCard';
export * from '../src/components/ui/SurvivalBadges';
export * from '../src/components/ui/TabNav';
export * from '../src/components/ui/ToolbarSelect';

// ProvenanceBar reads react-query context.
import { QueryClient } from '@tanstack/react-query';
export { QueryClientProvider } from '@tanstack/react-query';
export const queryClient = new QueryClient();
