import { SkeletonRow } from 'web';

export const FiveColumns = () => (
  <div className="w-[560px] bg-white">
    <SkeletonRow />
  </div>
);

export const ThreeColumns = () => (
  <div className="w-[560px] bg-white">
    <SkeletonRow columns={3} />
  </div>
);
