/** Organ systems used to group and colour cancer types. `cssVar` follows the theme. */
export const ORGAN_SYSTEMS = [
  { id: 'gi', label: 'Gastrointestinal', dot: 'bg-amber-700', cssVar: '--color-amber-700' },
  { id: 'gyn', label: 'Breast & gynecologic', dot: 'bg-pink-700', cssVar: '--color-pink-700' },
  { id: 'gu', label: 'Genitourinary', dot: 'bg-violet-700', cssVar: '--color-violet-700' },
  { id: 'thor', label: 'Thoracic', dot: 'bg-teal-700', cssVar: '--color-teal-700' },
  { id: 'endo', label: 'Endocrine', dot: 'bg-lime-700', cssVar: '--color-lime-700' },
  { id: 'hn', label: 'Head & neck', dot: 'bg-sky-700', cssVar: '--color-sky-700' },
] as const;

export type OrganId = (typeof ORGAN_SYSTEMS)[number]['id'];

export const ORGAN_BY_ID = Object.fromEntries(ORGAN_SYSTEMS.map((o) => [o.id, o])) as Record<
  OrganId,
  (typeof ORGAN_SYSTEMS)[number]
>;

/** Short filter label and organ system per cancer type. */
export const CANCER_TYPES: Record<string, { label: string; organ: OrganId }> = {
  ACC: { label: 'Adrenocortical', organ: 'endo' },
  BLCA: { label: 'Bladder urothelial', organ: 'gu' },
  BRCA: { label: 'Breast invasive', organ: 'gyn' },
  CESC: { label: 'Cervical SCC', organ: 'gyn' },
  CHOL: { label: 'Cholangiocarcinoma', organ: 'gi' },
  COAD: { label: 'Colon adeno.', organ: 'gi' },
  ESCA: { label: 'Esophageal', organ: 'gi' },
  HNSC: { label: 'Head & neck SCC', organ: 'hn' },
  LIHC: { label: 'Liver HCC', organ: 'gi' },
  LUAD: { label: 'Lung adeno.', organ: 'thor' },
  LUSC: { label: 'Lung SCC', organ: 'thor' },
  MESO: { label: 'Mesothelioma', organ: 'thor' },
  OV: { label: 'Ovarian serous', organ: 'gyn' },
  PAAD: { label: 'Pancreatic adeno.', organ: 'gi' },
  PRAD: { label: 'Prostate adeno.', organ: 'gu' },
  READ: { label: 'Rectal adeno.', organ: 'gi' },
  STAD: { label: 'Stomach adeno.', organ: 'gi' },
  THCA: { label: 'Thyroid', organ: 'endo' },
  THYM: { label: 'Thymoma', organ: 'thor' },
  UCEC: { label: 'Endometrial', organ: 'gyn' },
  UCS: { label: 'Uterine carcinosarcoma', organ: 'gyn' },
};

/** CPTAC names head and neck HNSCC; treat it as the same cancer type as TCGA HNSC. */
export const typeKey = (cohortId: string) => (cohortId === 'HNSCC' ? 'HNSC' : cohortId);

export const organOf = (cancerType: string) => {
  const organ = CANCER_TYPES[typeKey(cancerType)]?.organ;
  return organ ? ORGAN_BY_ID[organ] : undefined;
};
