import { ToolbarSelect } from 'web';

const ENDPOINTS = [
  { value: 'os', label: 'Overall survival' },
  { value: 'pfi', label: 'Progression-free interval' },
  { value: 'dss', label: 'Disease-specific survival' },
];

export const WithLabel = () => <ToolbarSelect label="Endpoint" value="os" onChange={() => {}} options={ENDPOINTS} />;
export const WithoutLabel = () => <ToolbarSelect value="pfi" onChange={() => {}} options={ENDPOINTS} />;
