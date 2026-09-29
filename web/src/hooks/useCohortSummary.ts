import { useQuery } from '@tanstack/react-query';
import { apiPaths } from '../api/paths';

export interface CohortSummary {
  id: string;
  name: string;
  slideCount: number;
  patientCount: number;
  /** Total size of the cohort's precomputed result files served by the API. */
  /** ISO date (YYYY-MM-DD) the cohort's analysis run completed. */
  updatedAt: string | null;
  clusterCount: number;
  featureCount: number;
  survivalSignificant: number;
  treatmentSignificant: number;
}

export function useCohortSummary(dataset = 'tcga', enabled = true) {
  return useQuery<CohortSummary[]>({
    queryKey: ['cohorts', dataset, 'summary'],
    queryFn: async () => {
      const res = await fetch(apiPaths.cohortSummary(dataset));
      if (!res.ok) throw new Error('Failed to load cohort summaries');
      return res.json();
    },
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
