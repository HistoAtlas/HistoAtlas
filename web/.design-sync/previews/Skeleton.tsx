import { Skeleton } from 'web';

export const TextLines = () => (
  <div className="w-72 space-y-2">
    <Skeleton className="h-4 w-48" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-2/3" />
  </div>
);

export const Thumbnail = () => <Skeleton className="h-32 w-32 rounded-lg" />;

export const CardPlaceholder = () => (
  <div className="w-72 bg-white border border-zinc-200 rounded-lg p-5 space-y-3">
    <Skeleton className="h-5 w-32" />
    <Skeleton className="h-24 w-full" />
  </div>
);
