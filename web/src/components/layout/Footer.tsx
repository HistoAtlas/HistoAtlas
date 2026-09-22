import { useCohorts } from '../../hooks/useCohorts';

const LEGAL_LINKS = [
  { label: 'Terms of Service', to: '/terms/' },
  { label: 'Privacy Policy', to: '/privacy/' },
];

const MORE_LINKS = [
  { label: 'PathCollab', href: 'https://pathcollab.io' },
  { label: 'PathView', href: 'https://github.com/PABannier/PathView' },
];

function CohortList() {
  const { data: tcgaCohorts } = useCohorts('tcga');
  const { data: cptacCohorts } = useCohorts('cptac');

  const tcgaIds = tcgaCohorts?.map((c) => c.id) ?? [];
  const cptacIds = cptacCohorts?.filter((c) => c.id !== 'PANCAN').map((c) => c.id) ?? [];

  return (
    <div className="space-y-3">
      {tcgaIds.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">TCGA</div>
          <ul className="columns-2 gap-x-4 text-xs space-y-1.5">
            {tcgaIds.map((id) => (
              <li key={id}>
                <a
                  href={`/tcga/${id}/atlas/`}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  {id}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {cptacIds.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">CPTAC</div>
          <ul className="columns-2 gap-x-4 text-xs space-y-1.5">
            {cptacIds.map((id) => (
              <li key={id}>
                <a
                  href={`/cptac/${id}/atlas/`}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  {id}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="bg-zinc-900 text-zinc-400 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Branding */}
          <div>
            <a href="/" className="flex items-center gap-2.5 text-white mb-3">
              <img src="/icon-192.png?v=2" width="22" height="22" alt="" aria-hidden="true" className="h-[22px] w-[22px] shrink-0" />
              <span className="font-semibold text-sm">HistoAtlas</span>
            </a>
            <p className="text-xs text-zinc-500 leading-relaxed mb-4">
              A morphological atlas of solid tumors from TCGA and CPTAC whole-slide images.
            </p>
            <p className="text-xs text-zinc-500">
              &copy; {new Date().getFullYear()} HistoAtlas
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Made by{' '}
              <a
                href="https://x.com/el_pa_b"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-white transition-colors"
              >
                Pierre-Antoine Bannier
              </a>
            </p>
          </div>

          {/* Cohorts */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
              Cohorts
            </h4>
            <CohortList />
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
              Legal
            </h4>
            <ul className="text-xs space-y-1.5">
              {LEGAL_LINKS.map((link) => (
                <li key={link.to}>
                  <a
                    href={link.to}
                    className="text-zinc-500 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* More */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
              More
            </h4>
            <ul className="text-xs space-y-1.5">
              {MORE_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
