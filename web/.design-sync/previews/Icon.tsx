import { Icon } from 'web';

const NAMES = ['microscope', 'dna', 'heart-pulse', 'scatter-chart', 'bar-chart', 'table', 'filter', 'search', 'download', 'info', 'warning', 'check-circle'] as const;

export const CommonIcons = () => (
  <div className="grid grid-cols-6 gap-4 text-zinc-600">
    {NAMES.map((name) => (
      <div key={name} className="flex flex-col items-center gap-1">
        <Icon name={name} size={20} />
        <span className="text-[11px] text-zinc-500">{name}</span>
      </div>
    ))}
  </div>
);

export const Sizes = () => (
  <div className="flex items-end gap-4 text-zinc-700">
    <Icon name="microscope" size={14} />
    <Icon name="microscope" size={16} />
    <Icon name="microscope" size={20} />
    <Icon name="microscope" size={32} />
  </div>
);

export const Colored = () => (
  <div className="flex items-center gap-4">
    <Icon name="check-circle" size={20} className="text-green-700" />
    <Icon name="warning" size={20} className="text-amber-700" />
    <Icon name="circle-x" size={20} className="text-red-700" />
    <Icon name="info" size={20} className="text-blue-700" />
  </div>
);
