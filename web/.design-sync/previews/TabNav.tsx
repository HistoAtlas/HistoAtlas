import { TabNav, Icon } from 'web';

export const Basic = () => (
  <div className="w-[640px] bg-white border-b border-zinc-200">
    <TabNav
      activeTab="overview"
      onChange={() => {}}
      tabs={[
        { id: 'overview', label: 'Overview' },
        { id: 'survival', label: 'Survival' },
        { id: 'enrichment', label: 'Enrichment' },
      ]}
    />
  </div>
);

export const WithIconsAndBadges = () => (
  <div className="w-[640px] bg-white border-b border-zinc-200">
    <TabNav
      activeTab="members"
      onChange={() => {}}
      tabs={[
        { id: 'survival', label: 'Survival', icon: <Icon name="heart-pulse" size={16} /> },
        { id: 'molecular', label: 'Molecular', icon: <Icon name="dna" size={16} />, badge: 142 },
        { id: 'members', label: 'Members', icon: <Icon name="users" size={16} />, badge: 1098 },
      ]}
    />
  </div>
);
