import { PageHeader, ExportActions, PillToggle } from 'web';

export const TitleAndSubtitle = () => (
  <PageHeader title="Breast invasive carcinoma" subtitle="TCGA-BRCA · 1,098 slides · 12 morphology clusters" />
);

export const WithActions = () => (
  <PageHeader
    title="Histomic associations"
    subtitle="Survival, molecular and clinical associations for 384 features"
    actions={[<ExportActions onExportCSV={() => {}} />]}
  />
);

export const WithChildren = () => (
  <PageHeader title="Cluster 7" subtitle="Lymphocyte-rich stroma">
    <div className="mt-4">
      <PillToggle
        size="sm"
        value="survival"
        onChange={() => {}}
        options={[
          { id: 'survival', label: 'Survival' },
          { id: 'enrichment', label: 'Enrichment' },
          { id: 'members', label: 'Members' },
        ]}
      />
    </div>
  </PageHeader>
);
