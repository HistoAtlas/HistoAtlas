import type { APIRoute } from 'astro';
import { fullBundle } from '../../lib/bundles';

export const GET: APIRoute = () => new Response(fullBundle() as BodyInit, { headers: { 'Content-Type': 'application/zip' } });
