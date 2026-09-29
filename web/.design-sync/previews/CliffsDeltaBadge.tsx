import { CliffsDeltaBadge } from 'web';

export const WithInterval = () => <CliffsDeltaBadge delta={0.31} ciLower={0.22} ciUpper={0.4} />;
export const Negative = () => <CliffsDeltaBadge delta={-0.18} ciLower={-0.29} ciUpper={-0.07} />;
export const Missing = () => <CliffsDeltaBadge delta={null} ciLower={null} ciUpper={null} />;
