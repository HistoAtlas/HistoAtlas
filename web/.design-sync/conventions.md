# HistoAtlas UI conventions

HistoAtlas is a scientific web app (histology atlas, survival and molecular statistics). The look is quiet and dense: white surfaces, zinc greys, thin borders, small type, one blue accent. Components are on `window.HistoAtlasUI`.

## Setup

- No theme provider. Components are styled by utility classes compiled into `styles.css`; load it and they look right.
- Only `ProvenanceBar` needs context (react-query). Wrap it, or the whole app, once:

```jsx
const { QueryClientProvider, queryClient, ProvenanceBar } = window.HistoAtlasUI;
<QueryClientProvider client={queryClient}><ProvenanceBar evidence={evidence} /></QueryClientProvider>
```

  Without the wrapper `ProvenanceBar` throws. Always pass `evidence.bundleVersion`; without it the bar fetches an API that does not exist in designs and renders nothing.
- Selection components (`PillToggle`, `SegmentedControl`, `TabNav`, `ToolbarSelect`) are controlled: hold `value` / `activeTab` in `useState` and pass `onChange`.
- `InfoTooltip` shows its text on hover only. `AssumptionChecks` rows expand on click when a warning has `detail`.
- `Icon` takes `name` from a fixed set (e.g. `microscope`, `dna`, `heart-pulse`, `scatter-chart`, `bar-chart`, `table`, `filter`, `search`, `download`, `info`, `warning`, `check-circle`, `circle-x`, `chevron-right`, `users`), plus `size` and `className`. Read `Icon.d.ts` for the full list; other names crash.

## Styling idiom: Tailwind utility classes, precompiled

The stylesheet is a static Tailwind v4 build. **Only classes already used by the app exist.** A class that is not in `styles.css` silently does nothing, so stay inside the vocabulary below, and use inline `style` with the CSS variables for anything else.

| Family | Classes that exist |
|---|---|
| Surface | `bg-white`, `bg-zinc-50`, `bg-zinc-100`, `bg-zinc-900` |
| Border | `border`, `border-zinc-200`, `border-zinc-100`, `border-t`, `border-b` |
| Text color | `text-zinc-900` (headings), `text-zinc-700`, `text-zinc-600` (body), `text-zinc-500` (secondary), `text-zinc-400` (meta), `text-blue-600`, `text-white` |
| Type size | `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-[11px]` |
| Weight / face | `font-medium`, `font-semibold`, `font-mono` (numbers, versions), `uppercase tracking-wide` (field labels) |
| Radius | `rounded`, `rounded-md`, `rounded-lg` (cards, buttons), `rounded-full` (pills) |
| Spacing | `p-4`, `p-5`, `px-4`, `px-6`, `py-3`, `mt-4`, `mb-4`, `gap-2`, `gap-3`, `gap-4`, `gap-6`, `space-y-2`, `space-y-4` |
| Layout | `flex`, `grid`, `grid-cols-2`, `grid-cols-3`, `items-center`, `justify-between`, `w-full`, `max-w-7xl mx-auto` (page width) |
| Status tints | `bg-green-50 text-green-700 border-green-200`, `bg-amber-50 text-amber-700 border-amber-200`, `bg-red-50 text-red-700 border-red-200`, `bg-blue-50 text-blue-700` |
| Helpers | `focus-ring` (keyboard focus outline), `scrollbar-hide`, `animate-fade-in`, `animate-scale-in`, `prose` (long-form article text) |

Cards use a border, not a shadow.

CSS variables for inline styles: `--color-zinc-50` … `--color-zinc-900`, `--color-blue-600`, `--color-brand-dark`, `--radius-md` (6px), `--radius-lg` (8px), `--font-family-sans`.

The card recipe used everywhere: `bg-white border border-zinc-200 rounded-lg p-5`.

## Where the truth lives

- `styles.css` and the `_ds_bundle.css` it imports: the complete class and variable list. Search it before using a class not in the table.
- `components/general/<Name>/<Name>.d.ts` for props and `<Name>.prompt.md` for usage examples.

## Example

```jsx
const { PageHeader, TabNav, SectionCard, StatsCard, EvidenceBadge, ExportActions, Icon } = window.HistoAtlasUI;

function ClusterPage() {
  const [tab, setTab] = React.useState('survival');
  return (
    <div className="bg-zinc-50">
      <PageHeader title="Cluster 7" subtitle="Lymphocyte-rich stroma" actions={[<ExportActions onExportCSV={() => {}} />]} />
      <div className="bg-white border-b border-zinc-200">
        <TabNav activeTab={tab} onChange={setTab} tabs={[{ id: 'survival', label: 'Survival' }, { id: 'members', label: 'Members', badge: 1098 }]} />
      </div>
      <div className="max-w-7xl mx-auto px-6 mt-4 grid grid-cols-2 gap-4">
        <SectionCard title="Survival analysis" icon={<Icon name="heart-pulse" size={18} />} badge={<EvidenceBadge badge="strong" />}>
          <p className="text-sm text-zinc-600">High nuclear pleomorphism is associated with shorter overall survival.</p>
        </SectionCard>
        <StatsCard title="Nuclear pleomorphism" summary={{ effect: 1.42, effectLabel: 'Hazard Ratio', ci: [1.18, 1.71], p: 0.0002, pAdj: 0.0034, correctionFamily: 'BH', nTests: 384, ciMethod: 'Wald', n: 1042, nEvents: 148, model: 'Cox PH', warnings: [] }} />
      </div>
    </div>
  );
}
```
