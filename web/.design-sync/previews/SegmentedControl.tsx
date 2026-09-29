import { SegmentedControl } from 'web';

export const TwoOptions = () => (
  <SegmentedControl
    value="adjusted"
    onChange={() => {}}
    options={[
      { id: 'raw', label: 'Raw p' },
      { id: 'adjusted', label: 'Adjusted p' },
    ]}
  />
);

export const ThreeOptions = () => (
  <SegmentedControl
    value="univariate"
    onChange={() => {}}
    options={[
      { id: 'univariate', label: 'Univariate' },
      { id: 'clinical', label: 'Clinical-adjusted' },
      { id: 'full', label: 'Fully adjusted' },
    ]}
  />
);
