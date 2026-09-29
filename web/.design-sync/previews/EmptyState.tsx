import { EmptyState, NoResultsIcon, NoSelectionIcon } from 'web';

export const NoResults = () => (
  <EmptyState
    icon={<NoResultsIcon />}
    title="No slides match your filters"
    description="Try removing a cancer type or widening the feature range."
    action={{ label: 'Clear filters', onClick: () => {} }}
  />
);

export const NoSelection = () => (
  <EmptyState
    icon={<NoSelectionIcon />}
    title="No feature selected"
    description="Pick a histomic feature from the table to see its associations."
  />
);

export const TitleOnly = () => <EmptyState title="No enrichment results for this cluster" />;
