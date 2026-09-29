import { ProvenanceBar } from 'web';

export const FullProvenance = () => (
  <div className="w-[640px]">
    <ProvenanceBar
      evidence={{
        atlasVersion: '1.2.0',
        bundleVersion: '2026.03.1',
        extractionVersion: 'v0.9.4',
        lastUpdated: '2026-03-14',
        pipelineCommitHash: 'a6a129d4c0ffee',
        pythonVersion: '3.11.8',
      }}
    />
  </div>
);

export const VersionsOnly = () => (
  <div className="w-[640px]">
    <ProvenanceBar
      evidence={{ atlasVersion: '1.2.0', bundleVersion: '2026.03.1', extractionVersion: 'v0.9.4', lastUpdated: '2026-03-14' }}
    />
  </div>
);
