import { useSyncExternalStore } from 'react';
import { Icon } from '../ui/Icon';

interface TopNavBarProps {
  cohort: string;
  dataset: string;
  pathname: string;
  onSearchFocus?: () => void;
  onGlossaryToggle?: () => void;
}

const ICON_BUTTON =
  'h-11 w-11 flex items-center justify-center text-zinc-900 rounded-md hover:bg-zinc-100 transition-colors cursor-pointer';
const TEXT_BUTTON =
  'flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[13px] text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer';

function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

/** Light/dark toggle. The saved theme is applied before paint by an inline script in BaseLayout. */
function ThemeToggle({ className }: { className: string }) {
  const dark = useSyncExternalStore(
    subscribeToTheme,
    () => document.documentElement.dataset.theme === 'dark',
    () => false,
  );

  const toggle = () => {
    if (dark) delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = 'dark';
    try {
      localStorage.setItem('theme', dark ? 'light' : 'dark');
    } catch {
      // Storage unavailable (private mode): the choice lasts for this page only
    }
  };

  return (
    <button type="button" onClick={toggle} className={className}>
      {dark ? 'Light mode' : 'Dark mode'}
    </button>
  );
}

export function TopNavBar({ cohort, dataset, pathname, onSearchFocus, onGlossaryToggle }: TopNavBarProps) {
  const NAV_LINKS = [
    { label: 'Explore', to: `/${dataset}/${cohort}/atlas/`, active: pathname === '/' || /\/(atlas|cluster|slide|histomics)\//.test(pathname) },
    { label: 'Associations', to: `/${dataset}/${cohort}/associations/`, active: pathname.includes('/associations/') },
    { label: 'Mutations', to: '/mutations/', active: pathname.startsWith('/mutations') },
    { label: 'Methods', to: '/methods/', active: pathname.startsWith('/methods') },
    { label: 'Blog', to: '/blog/', active: pathname.startsWith('/blog') },
    { label: 'About', to: '/about/', active: pathname.startsWith('/about') },
  ];

  return (
    <header className="sticky top-0 z-50 h-[52px] bg-white border-b border-zinc-200 text-zinc-900">
      <div className="h-full max-w-7xl mx-auto pl-4 pr-2 md:px-6 flex items-center gap-2 md:gap-7">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 text-zinc-900 shrink-0">
          <img src="/icon-192.png?v=2" width="22" height="22" alt="" aria-hidden="true" className="h-[22px] w-[22px] shrink-0" />
          <span className="font-semibold text-[15px]">HistoAtlas</span>
        </a>

        {/* Nav links */}
        <nav aria-label="Primary" className="hidden md:flex h-full">
          {NAV_LINKS.map((link) => (
            <a
              key={link.to}
              href={link.to}
              aria-current={link.active ? 'page' : undefined}
              className={`flex items-center px-[11px] text-[13.5px] transition-colors ${
                link.active
                  ? 'text-zinc-900 font-semibold shadow-[inset_0_-2px_0_var(--color-blue-600)]'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search field (wide screens) */}
        <button
          type="button"
          onClick={onSearchFocus}
          className="hidden xl:flex w-[340px] h-8 items-center gap-2 px-2.5 text-[13px] text-zinc-500 bg-zinc-100 border border-zinc-200 rounded-md hover:border-zinc-500 transition-colors cursor-pointer"
        >
          <Icon name="search" size={14} className="shrink-0" />
          <span className="flex-1 text-left truncate">Search cohorts, genes, clusters, slides…</span>
          <kbd className="text-[11px] text-zinc-600 border border-zinc-200 rounded px-1.5">/</kbd>
        </button>

        <div className="flex items-center md:gap-1">
          <ThemeToggle className="h-11 md:h-8 px-2.5 rounded-md md:border border-zinc-200 text-xs text-zinc-700 whitespace-nowrap hover:bg-zinc-100 transition-colors cursor-pointer" />

          {/* Search icon (narrow screens) */}
          <button
            type="button"
            onClick={onSearchFocus}
            aria-label="Search cohorts, genes, clusters, slides"
            className={`xl:hidden ${ICON_BUTTON}`}
          >
            <Icon name="search" size={18} />
          </button>

          <button type="button" onClick={onGlossaryToggle} className={`hidden md:flex ${TEXT_BUTTON}`}>
            <Icon name="book-open" size={15} />
            Glossary
          </button>
          <a
            href="https://github.com/HistoAtlas/HistoAtlas"
            target="_blank"
            rel="noopener noreferrer"
            className={`hidden md:flex ${TEXT_BUTTON}`}
          >
            GitHub
          </a>

          {/* Mobile menu */}
          <details className="md:hidden relative">
            <summary className="list-none [&::-webkit-details-marker]:hidden h-11 px-2.5 flex items-center text-[13px] text-zinc-900 cursor-pointer">
              Menu
            </summary>
            <nav
              aria-label="Primary"
              className="absolute right-0 top-12 w-52 bg-white border border-zinc-200 rounded-lg shadow-lg py-1.5 flex flex-col"
            >
              {NAV_LINKS.map((link) => (
                <a
                  key={link.to}
                  href={link.to}
                  aria-current={link.active ? 'page' : undefined}
                  className={`px-4 py-2.5 text-sm hover:bg-zinc-100 ${link.active ? 'font-semibold text-zinc-900' : 'text-zinc-700'}`}
                >
                  {link.label}
                </a>
              ))}
              <button type="button" onClick={onGlossaryToggle} className="px-4 py-2.5 text-sm text-left text-zinc-700 hover:bg-zinc-100 cursor-pointer">
                Glossary
              </button>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
