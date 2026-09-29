import type { APIRoute, GetStaticPaths } from 'astro';
import { cohortBundle, listCohorts } from '../../../lib/bundles';

export const getStaticPaths: GetStaticPaths = () => listCohorts().map((params) => ({ params }));

export const GET: APIRoute = ({ params }) =>
  new Response(cohortBundle(params.dataset!, params.cohort!) as BodyInit, { headers: { 'Content-Type': 'application/zip' } });
