import { SkeletonTable } from 'web';

export const Default = () => (
  <div className="w-[560px] bg-white border border-zinc-200 rounded-lg overflow-hidden">
    <SkeletonTable />
  </div>
);

export const Compact = () => (
  <div className="w-[560px] bg-white border border-zinc-200 rounded-lg overflow-hidden">
    <SkeletonTable rows={3} columns={4} />
  </div>
);
