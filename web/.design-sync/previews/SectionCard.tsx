import { SectionCard, Icon, EvidenceBadge, ExportActions } from 'web';

export const Basic = () => (
  <div className="w-[480px]">
    <SectionCard title="Survival analysis" subtitle="Cox proportional hazards, overall survival">
      <p className="text-sm text-zinc-600">High nuclear pleomorphism is associated with shorter overall survival.</p>
    </SectionCard>
  </div>
);

export const WithIconBadgeAndActions = () => (
  <div className="w-[480px]">
    <SectionCard
      title="Molecular correlates"
      subtitle="Spearman correlation with gene expression"
      icon={<Icon name="dna" size={18} className="text-zinc-500" />}
      badge={<EvidenceBadge badge="strong" />}
      actions={<ExportActions onExportCSV={() => {}} />}
    >
      <p className="text-sm text-zinc-600">142 genes pass the adjusted significance threshold.</p>
    </SectionCard>
  </div>
);
