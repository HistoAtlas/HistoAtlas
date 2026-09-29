import { MiniHistogram } from 'web';

const BINS = [2, 5, 11, 19, 27, 31, 24, 15, 8, 3];

export const MidPercentile = () => <MiniHistogram bins={BINS} percentile={55} />;
export const HighPercentile = () => <MiniHistogram bins={BINS} percentile={75} />;
export const CustomColor = () => <MiniHistogram bins={BINS} percentile={30} color="#16a34a" />;
