import { PValueBadge } from 'web';

export const Significant = () => <PValueBadge p={0.0034} label="p_adj" />;
export const NotSignificant = () => <PValueBadge p={0.27} />;
export const Missing = () => <PValueBadge p={null} />;
