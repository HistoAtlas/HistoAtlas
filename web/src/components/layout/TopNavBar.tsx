import { Icon } from '../ui/Icon';

interface TopNavBarProps {
  cohort: string;
  dataset: string;
  onSearchFocus?: () => void;
  onGlossaryToggle?: () => void;
}

export function TopNavBar({ cohort, dataset, onSearchFocus, onGlossaryToggle }: TopNavBarProps) {
  const NAV_LINKS = [
    { label: 'Explore', to: `/${dataset}/${cohort}/atlas/` },
    { label: 'Associations', to: `/${dataset}/${cohort}/associations/` },
    { label: 'Mutations', to: '/mutations/' },
    { label: 'Methods', to: '/methods/' },
    { label: 'Blog', to: '/blog/' },
    { label: 'About', to: '/about/' },
  ];

  return (
    <header className="sticky top-0 z-50 h-16 bg-brand-dark text-white">
      <div className="h-full max-w-7xl mx-auto px-6 flex items-center gap-8">
        {/* Logo */}
        <a
          href="/"
          className="flex items-center gap-2.5 text-white shrink-0"
        >
          <img src="/icon-192.png" width="26" height="26" alt="" aria-hidden="true" className="h-[26px] w-[26px] shrink-0" />
          <span className="font-semibold text-[15px] tracking-tight">HistoAtlas</span>
        </a>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.to}
              href={link.to}
              className="px-3 py-1.5 text-base text-white/80 hover:text-white rounded-md hover:bg-white/10 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search + Glossary */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            onClick={onSearchFocus}
            className="w-72 h-9 flex items-center gap-2 px-3 text-sm text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-md hover:border-zinc-500 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-zinc-500" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="flex-1 text-left">Search slides, clusters...</span>
            <kbd className="text-[10px] font-mono text-zinc-500 bg-zinc-700 border border-zinc-600 rounded px-1.5 py-0.5">/</kbd>
          </button>

          {/* Separator */}
          <div className="h-5 w-px bg-zinc-700" />

          {/* Glossary */}
          <button
            onClick={onGlossaryToggle}
            className="h-10 w-10 flex items-center justify-center text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-md hover:border-zinc-500 hover:text-zinc-200 transition-colors"
            aria-label="Feature glossary"
          >
            <Icon name="book-open" size={16} />
          </button>

          {/* Separator */}
          <div className="h-5 w-px bg-zinc-700" />

          {/* GitHub */}
          <a
            href="https://github.com/HistoAtlas/HistoAtlas"
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 w-10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            aria-label="GitHub repository"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
