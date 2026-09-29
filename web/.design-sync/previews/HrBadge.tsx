import { HrBadge } from 'web';

export const Harmful = () => <HrBadge hr={1.42} lo={1.18} hi={1.71} />;
export const Protective = () => <HrBadge hr={0.68} lo={0.54} hi={0.86} />;
export const Missing = () => <HrBadge hr={null} lo={null} hi={null} />;
