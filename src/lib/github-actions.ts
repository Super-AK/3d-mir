import { config } from '../config.js';

export type GithubActionsState =
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'skipped'
  | 'in_progress'
  | 'queued'
  | 'unknown';

export type GithubActionsStatus = {
  available: boolean;
  state: GithubActionsState;
  status: string | null;
  conclusion: string | null;
  title: string;
  htmlUrl: string;
  headSha: string;
  createdAt: string | null;
  updatedAt: string | null;
};

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { expires: number; value: GithubActionsStatus }>();

function unavailable(): GithubActionsStatus {
  return {
    available: false,
    state: 'unknown',
    status: null,
    conclusion: null,
    title: '',
    htmlUrl: '',
    headSha: '',
    createdAt: null,
    updatedAt: null,
  };
}

function toState(conclusion: string | null, status: string | null): GithubActionsState {
  if (conclusion) {
    if (conclusion === 'success') return 'success';
    if (conclusion === 'failure') return 'failure';
    if (conclusion === 'cancelled') return 'cancelled';
    if (conclusion === 'skipped') return 'skipped';
    return 'unknown';
  }
  if (status === 'completed') return 'unknown';
  if (status === 'in_progress') return 'in_progress';
  if (status === 'queued') return 'queued';
  return 'unknown';
}

/**
 * Liest den letzten Workflow-Lauf des CI-Workflows für den Hauptbranch.
 *
 * Ohne GitHub-Token wird der öffentliche GitHub-API-Endpunkt genutzt. Bei
 * Ausfällen, Rate-Limits oder Fehlern bleibt die Anzeige bewusst ohne Daten
 * verfügbar, damit der Dashboard nicht blockiert wird.
 */
export async function getGithubActionsStatus(): Promise<GithubActionsStatus> {
  const repo = process.env.GITHUB_REPOSITORY ?? 'Super-AK/3d-mir';
  const workflow = 'ci.yml';
  const branch = 'main';
  const cacheKey = `${repo}/${workflow}/${branch}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;

  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/runs?branch=${branch}&per_page=1`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    const value = unavailable();
    cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, value });
    return value;
  }

  if (!response.ok) {
    const value = unavailable();
    cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, value });
    return value;
  }

  let payload: { workflow_runs?: Array<Record<string, unknown>> } = {};
  try {
    payload = (await response.json()) as { workflow_runs?: Array<Record<string, unknown>> };
  } catch {
    const value = unavailable();
    cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, value });
    return value;
  }

  const run = payload.workflow_runs?.[0];
  const state = toState(
    typeof run?.conclusion === 'string' ? run.conclusion : null,
    typeof run?.status === 'string' ? run.status : null,
  );
  const value: GithubActionsStatus = {
    available: true,
    state,
    status: typeof run?.status === 'string' ? run.status : null,
    conclusion: typeof run?.conclusion === 'string' ? run.conclusion : null,
    title: typeof run?.name === 'string' ? run.name : workflow,
    htmlUrl: typeof run?.html_url === 'string' ? run.html_url : `https://github.com/${repo}/actions/workflows/${workflow}`,
    headSha: typeof run?.head_sha === 'string' ? run.head_sha : '',
    createdAt: typeof run?.created_at === 'string' ? run.created_at : null,
    updatedAt: typeof run?.updated_at === 'string' ? run.updated_at : null,
  };

  cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, value });
  return value;
}
