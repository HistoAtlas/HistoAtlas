import type { APIRoute } from 'astro';
import { bundleSizes } from '../../lib/bundles';

export const GET: APIRoute = () => Response.json(bundleSizes());
