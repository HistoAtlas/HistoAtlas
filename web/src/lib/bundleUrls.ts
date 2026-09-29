// The dev server only serves endpoints with a trailing slash; the built site serves plain files.
const suffix = import.meta.env.DEV ? '/' : '';

export const bundleUrl = (dataset: string, cohort: string) => `/downloads/${dataset}/${cohort}.zip${suffix}`;
export const bundleSizesUrl = `/downloads/sizes.json${suffix}`;

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Download every cohort bundle as one archive of `<dataset>/<cohort>.zip` files.
 * Assembled in the browser because the combined file exceeds the host's 25 MiB per-file limit.
 */
export async function downloadAllBundles(
  cohorts: { dataset: string; id: string }[],
  onProgress: (done: number) => void,
) {
  const { zipSync } = await import('fflate');
  const files: Record<string, Uint8Array> = {};
  let done = 0;
  await Promise.all(
    cohorts.map(async ({ dataset, id }) => {
      const res = await fetch(bundleUrl(dataset, id));
      if (!res.ok) throw new Error(`Failed to download ${dataset}/${id}`);
      files[`histoatlas/${dataset}/${id}.zip`] = new Uint8Array(await res.arrayBuffer());
      onProgress(++done);
    }),
  );
  // Already compressed: store only
  save(new Blob([zipSync(files, { level: 0 }) as BlobPart], { type: 'application/zip' }), 'histoatlas.zip');
}
