import { useState } from "react";
import { Icon } from "../ui/Icon";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 transition-colors px-2 py-1 rounded border border-zinc-200 bg-white"
    >
      <Icon name={copied ? "check" : "clipboard"} size={14} />
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  BibTeX                                                             */
/* ------------------------------------------------------------------ */

export const BIBTEX = `@misc{bannier2026histoatlaspancancermorphologyatlas,
  title         = {HistoAtlas: A Pan-Cancer Morphology Atlas Linking Histomics to Molecular Programs and Clinical Outcomes},
  author        = {Pierre-Antoine Bannier},
  year          = {2026},
  eprint        = {2603.16587},
  archivePrefix = {arXiv},
  primaryClass  = {q-bio.QM},
  url           = {https://arxiv.org/abs/2603.16587}
}`;

/* ------------------------------------------------------------------ */
/*  Main content                                                       */
/* ------------------------------------------------------------------ */

export function AboutContent() {
  return (
    <div className="text-zinc-600 leading-relaxed text-[15px]">
      {/* Narrative */}
      <p>
        While analyzing large cohorts such as TCGA, I was struck by how
        difficult it is to explore morphology systematically across cancers.
        Each whole-slide image contains millions of cells and complex spatial
        organization, yet we rarely represent a slide with an interpretable
        description of its tissue structure. I kept coming back to a simple
        question: why can't every slide be summarized by a histomic fingerprint
        capturing orthogonal aspects of the tumor microenvironment: its cellular
        composition, spatial organization, nuclear morphology, and tissue
        architecture?
      </p>
      <p className="mt-4">
        Today, histomic features are computed in many studies, but they remain
        scattered across papers and pipelines, rarely organized into a coherent,
        searchable framework. As a result, researchers still lack a way to
        navigate the morphological landscape of cancer or to compare findings
        across cohorts, centers, and staining conditions. Biology has atlases
        for genes, proteins, and cells, but not for tissue organization.
      </p>
      <p className="mt-4">
        HistoAtlas is an attempt to build that atlas: a structured way to
        explore cancer morphology at scale and connect tissue organization with
        patient outcomes and molecular signatures, enabling translational
        researchers to systematically discover and evaluate pathology-based
        biomarkers.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <span className="text-zinc-500 italic">- Pierre-Antoine Bannier</span>
        <div className="flex items-center gap-2">
          <a
            href="https://www.linkedin.com/in/pierre-antoine-bannier/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-zinc-600 transition-colors"
            aria-label="LinkedIn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </a>
          <a
            href="https://x.com/el_pa_b"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-zinc-600 transition-colors"
            aria-label="X (Twitter)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://github.com/PABannier"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-zinc-600 transition-colors"
            aria-label="GitHub"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
          </a>
        </div>
      </div>

      {/* Links */}
      <div className="mt-10 space-y-2">
        <h2 className="text-base font-semibold text-zinc-900 mb-3">
          Legal & Data Governance
        </h2>
        <ul className="space-y-1.5">
          <li>
            <a href="/terms/" className="text-blue-600 hover:underline">
              Terms of Service
            </a>
          </li>
          <li>
            <a href="/privacy/" className="text-blue-600 hover:underline">
              Privacy Policy
            </a>
          </li>
          <li>
            <a
              href="https://gdc.cancer.gov/about-gdc/gdc-policies"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              GDC Data Use Policies
            </a>
          </li>
        </ul>
      </div>

      {/* Citation */}
      <div className="mt-10">
        <h2 className="text-base font-semibold text-zinc-900 mb-3">Citation</h2>
        <div className="relative bg-white border border-zinc-200 rounded-lg">
          <div className="absolute top-2 right-2">
            <CopyButton text={BIBTEX} />
          </div>
          <pre className="p-4 pr-24 text-xs font-mono text-zinc-700 overflow-x-auto whitespace-pre">
            {BIBTEX}
          </pre>
        </div>
      </div>

      {/* Bottom spacer */}
      <div className="h-16" />
    </div>
  );
}
