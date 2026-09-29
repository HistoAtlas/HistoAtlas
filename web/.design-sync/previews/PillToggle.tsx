import { PillToggle, Icon } from 'web';

const OPTIONS = [
  { id: 'os', label: 'Overall survival' },
  { id: 'pfi', label: 'Progression-free' },
  { id: 'dss', label: 'Disease-specific' },
];

export const Medium = () => <PillToggle options={OPTIONS} value="os" onChange={() => {}} />;
export const Small = () => <PillToggle options={OPTIONS} value="pfi" onChange={() => {}} size="sm" />;
export const WithIcons = () => (
  <PillToggle
    value="plot"
    onChange={() => {}}
    options={[
      { id: 'plot', label: 'Plot', icon: <Icon name="scatter-chart" size={14} /> },
      { id: 'table', label: 'Table', icon: <Icon name="table" size={14} /> },
    ]}
  />
);
