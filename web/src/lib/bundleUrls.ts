// Production serves the bundles from R2 (functions/bundles); the dev server builds them on request
// and only answers endpoints with a trailing slash.
const path = (file: string) => (import.meta.env.DEV ? `/downloads/${file}/` : `/bundles/downloads/${file}`);

export const bundleUrl = (dataset: string, cohort: string) => path(`${dataset}/${cohort}.zip`);
export const fullBundleUrl = path('histoatlas.zip');
/** Sizes of the bundles produced by the same build as the site. */
export const bundleSizesUrl = `/downloads/sizes.json${import.meta.env.DEV ? '/' : ''}`;
