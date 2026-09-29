import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Icon } from '../ui/Icon';
import { Equation } from '../ui/Equation';
import { GLOSSARY_SECTIONS, ALL_FEATURES, NOTATION_LEGEND } from '../../data/featureGlossary';
import type { GlossarySection } from '../../data/featureGlossary';

interface GlossaryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlossaryDrawer({ isOpen, onClose }: GlossaryDrawerProps) {
  const [filter, setFilter] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(GLOSSARY_SECTIONS.map((s) => s.key))
  );
  const [notationOpen, setNotationOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Auto-expand sections that contain matching features when searching
  useEffect(() => {
    if (filter.trim()) {
      const q = filter.toLowerCase();
      const matchingKeys = GLOSSARY_SECTIONS
        .filter((section) =>
          section.features.some(
            (f) =>
              f.displayName.toLowerCase().includes(q) ||
              f.name.toLowerCase().includes(q) ||
              f.description.toLowerCase().includes(q) ||
              f.formula.toLowerCase().includes(q)
          )
        )
        .map((s) => s.key);
      setCollapsedSections((prev) => {
        const next = new Set(prev);
        for (const key of matchingKeys) {
          next.delete(key);
        }
        return next;
      });
    } else {
      // Re-collapse all when search is cleared
      setCollapsedSections(new Set(GLOSSARY_SECTIONS.map((s) => s.key)));
    }
  }, [filter]);

  const filteredSections = useMemo((): GlossarySection[] => {
    if (!filter.trim()) return GLOSSARY_SECTIONS;
    const q = filter.toLowerCase();
    return GLOSSARY_SECTIONS.map((section) => ({
      ...section,
      features: section.features.filter(
        (f) =>
          f.displayName.toLowerCase().includes(q) ||
          f.name.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q) ||
          f.formula.toLowerCase().includes(q)
      ),
    })).filter((s) => s.features.length > 0);
  }, [filter]);

  const matchCount = useMemo(
    () => filteredSections.reduce((sum, s) => sum + s.features.length, 0),
    [filteredSections]
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ top: '52px' }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed inset-x-0 z-40 bg-white shadow-lg border-b border-zinc-200 transition-[transform,visibility] duration-200 ease-out ${
          isOpen ? 'translate-y-0' : '-translate-y-full invisible'
        }`}
        style={{ top: '52px', maxHeight: '70vh' }}
        role="dialog"
        aria-modal="true"
        aria-label="Feature glossary"
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col" style={{ maxHeight: '70vh' }}>
          {/* Header row */}
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-1">
              <Icon
                name="search"
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                ref={inputRef}
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter features by name, description, or formula..."
                aria-label="Filter features"
                className="w-full h-9 pl-9 pr-3 bg-zinc-100 border border-zinc-200 rounded-md text-sm text-zinc-900 placeholder:text-zinc-500 outline-none focus:border-zinc-500 transition-colors"
              />
            </div>
            <span className="text-xs text-zinc-500 tabular-nums shrink-0">
              {matchCount} / {ALL_FEATURES.length} features
            </span>
            <button
              onClick={onClose}
              className="h-9 w-9 flex items-center justify-center text-zinc-600 hover:text-zinc-900 transition-colors rounded-md hover:bg-zinc-100"
              aria-label="Close glossary"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 -mx-2 px-2" style={{ minHeight: 0 }}>
            {/* Notation legend */}
            <div className="mb-2">
              <button
                onClick={() => setNotationOpen((prev) => !prev)}
                className="w-full flex items-center gap-2 py-2 px-1 text-left group"
              >
                <Icon
                  name={notationOpen ? 'chevron-down' : 'chevron-right'}
                  size={12}
                  className="text-zinc-500 shrink-0"
                />
                <Icon name="info" size={12} className="text-zinc-500 shrink-0" />
                <span className="text-[11px] uppercase tracking-wide font-medium text-zinc-500 group-hover:text-zinc-700 transition-colors">
                  Notation
                </span>
              </button>

              {notationOpen && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pb-3">
                  {NOTATION_LEGEND.map((category) => (
                    <div
                      key={category.label}
                      className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3"
                    >
                      <h4 className="text-[10px] uppercase tracking-wide font-medium text-zinc-500 mb-2">
                        {category.label}
                      </h4>
                      <div className="space-y-1.5">
                        {category.entries.map((entry) => (
                          <div key={entry.symbol} className="flex items-baseline gap-3">
                            <span className="shrink-0 w-24 text-right">
                              <Equation tex={entry.tex} className="text-zinc-700" />
                            </span>
                            <span className="text-xs text-zinc-600">{entry.definition}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Feature sections */}
            {filteredSections.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-500">
                No features matching &ldquo;{filter}&rdquo;
              </div>
            ) : (
              filteredSections.map((section) => {
                const isCollapsed = collapsedSections.has(section.key);
                return (
                  <div key={section.key} className="mb-2">
                    {/* Section header */}
                    <button
                      onClick={() => toggleSection(section.key)}
                      className="w-full flex items-center gap-2 py-2 px-1 text-left group"
                    >
                      <Icon
                        name={isCollapsed ? 'chevron-right' : 'chevron-down'}
                        size={12}
                        className="text-zinc-500 shrink-0"
                      />
                      <span className="text-[11px] uppercase tracking-wide font-medium text-zinc-500 group-hover:text-zinc-700 transition-colors">
                        {section.label}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        ({section.features.length})
                      </span>
                    </button>

                    {/* Feature cards */}
                    {!isCollapsed && (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 pb-2">
                        {section.features.map((feature) => (
                          <div
                            key={feature.id}
                            className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3"
                          >
                            {/* Top row: name + badges */}
                            <div className="flex items-start gap-2 mb-2">
                              <span className="text-sm font-medium text-zinc-900 leading-tight flex-1">
                                {feature.displayName}
                              </span>
                              <span className="text-[10px] bg-zinc-100 border border-zinc-200 rounded px-1.5 py-0.5 text-zinc-600 shrink-0">
                                {feature.unit}
                              </span>
                              {feature.optional && (
                                <span className="text-[10px] bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 text-amber-700 shrink-0">
                                  optional
                                </span>
                              )}
                            </div>

                            {/* Formula */}
                            <div className="mb-2">
                              <Equation
                                tex={feature.formula}
                                className="text-zinc-700"
                              />
                            </div>

                            {/* Description */}
                            <p className="text-sm text-zinc-600 leading-relaxed">
                              {feature.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
