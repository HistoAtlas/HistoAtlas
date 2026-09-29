import { PhBadge } from 'web';

export const Pass = () => <PhBadge flag="pass" phTestP={0.42} />;
export const Borderline = () => <PhBadge flag="warn" phTestP={0.061} />;
export const Violated = () => <PhBadge flag="fail" phTestP={0.003} />;
export const Unknown = () => <PhBadge flag="na" />;
