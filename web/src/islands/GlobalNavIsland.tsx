import { useState, useCallback } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../api/client';
import { TopNavBar } from '../components/layout/TopNavBar';
import { SearchPalette } from '../components/layout/SearchPalette';
import { GlossaryDrawer } from '../components/layout/GlossaryDrawer';
import { useGlobalSearch } from '../hooks/useGlobalSearch';

interface GlobalNavProps {
  cohort: string;
  dataset: string;
  pathname: string;
}

function GlobalNavContent({ cohort, dataset, pathname }: GlobalNavProps) {
  const search = useGlobalSearch();
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);

  const handleGlossaryToggle = useCallback(() => {
    setIsGlossaryOpen((prev) => {
      if (!prev) {
        // Close search when opening glossary
        search.setIsOpen(false);
      }
      return !prev;
    });
  }, [search]);

  const handleSearchFocus = useCallback(() => {
    // Close glossary when opening search
    setIsGlossaryOpen(false);
    search.setIsOpen(true);
  }, [search]);

  return (
    <>
      <TopNavBar
        cohort={cohort}
        dataset={dataset}
        pathname={pathname}
        onSearchFocus={handleSearchFocus}
        onGlossaryToggle={handleGlossaryToggle}
      />
      {search.isOpen && <SearchPalette search={search} />}
      <GlossaryDrawer
        isOpen={isGlossaryOpen}
        onClose={() => setIsGlossaryOpen(false)}
      />
    </>
  );
}

export function GlobalNavIsland({ cohort, dataset, pathname }: GlobalNavProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalNavContent cohort={cohort} dataset={dataset} pathname={pathname} />
    </QueryClientProvider>
  );
}
