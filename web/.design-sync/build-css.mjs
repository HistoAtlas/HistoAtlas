// Compiles src/index.css (Tailwind v4) to a stable path for design-sync's cssEntry.
import { readFileSync, writeFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const from = 'src/index.css';
const to = '.design-sync/.cache/ds.css';
const { css } = await postcss([tailwind()]).process(readFileSync(from, 'utf8'), { from, to });
writeFileSync(to, css);
console.log(`${to}: ${css.length} bytes`);
