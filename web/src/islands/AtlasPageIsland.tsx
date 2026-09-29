import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../api/client';
import { AtlasView } from '../routes/AtlasView';

interface AtlasPageIslandProps {
  dataset?: string;
  cohort?: string;
  keyFeatures?: string[];
}

export function AtlasPageIsland({ dataset = 'tcga', cohort = 'PANCAN', keyFeatures }: AtlasPageIslandProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AtlasView dataset={dataset} cohort={cohort} keyFeatures={keyFeatures} />
    </QueryClientProvider>
  );
}
