// GitHub source — org-wide commit / PR / issue counts in a window.
//
// We rotate between two PATs (when both are present) to dodge per-token
// rate limits. The Itqan stats project does the same; we match its
// queries so the numbers line up.
//
// We use the search API to count commits/PRs/issues in a window — it's
// the cheapest way to get an org-wide window count without enumerating
// every repo. Search returns `total_count` which is what we need.

import { STATS_ENV } from '../env';
import type { DateRange, GithubMetrics } from '../types';
import { describeError } from '../util';

const GITHUB_API = 'https://api.github.com';

function patPool(): string[] {
  return [STATS_ENV.GITHUB_PAT, STATS_ENV.GITHUB_PAT_2].filter(
    (x): x is string => Boolean(x),
  );
}

let patIndex = 0;
function nextPat(pool: string[]): string {
  const pat = pool[patIndex % pool.length];
  patIndex = (patIndex + 1) % pool.length;
  return pat;
}

type RepoSummary = {
  private: boolean;
  stargazers_count: number;
};

type SearchResponse = { total_count: number };

async function gh<T>(path: string, pool: string[]): Promise<T> {
  const url = path.startsWith('http') ? path : `${GITHUB_API}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${nextPat(pool)}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'itqan-crm-stats',
    },
    next: { revalidate: 300, tags: ['stats:github'] },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getGithub(opts: { range: DateRange }): Promise<GithubMetrics | null> {
  const pool = patPool();
  if (pool.length === 0) return null;
  const org = STATS_ENV.GITHUB_ORG;

  try {
    const start = isoDay(opts.range.start);
    const end = isoDay(opts.range.end);
    const window = `${start}..${end}`;

    // Run search counts + repo enumeration in parallel.
    const [commits, prsOpened, prsMerged, prsClosed, issuesOpened, repos] =
      await Promise.all([
        searchCount(`org:${org} committer-date:${window}`, 'commits', pool),
        searchCount(`org:${org} type:pr created:${window}`, 'issues', pool),
        searchCount(`org:${org} type:pr is:merged merged:${window}`, 'issues', pool),
        searchCount(
          `org:${org} type:pr is:closed -is:merged closed:${window}`,
          'issues',
          pool,
        ),
        searchCount(`org:${org} type:issue created:${window}`, 'issues', pool),
        listOrgRepos(org, pool),
      ]);

    return {
      org,
      commits,
      prsOpened,
      prsMerged,
      prsClosed,
      issuesOpened,
      publicRepos: repos.filter((r) => !r.private).length,
      privateRepos: repos.filter((r) => r.private).length,
      totalStars: repos.reduce((sum, r) => sum + (r.stargazers_count ?? 0), 0),
    };
  } catch (err) {
    console.warn('[stats:github] fetch failed:', describeError(err));
    throw err;
  }
}

async function searchCount(
  query: string,
  scope: 'commits' | 'issues',
  pool: string[],
): Promise<number> {
  // Search API requires a different Accept header for commits search.
  const url = `/search/${scope}?q=${encodeURIComponent(query)}&per_page=1`;
  if (scope === 'commits') {
    // text-match search for commits needs cloak.preview; on github.com
    // it's silently OK to use the standard accept too. We send it
    // explicitly to be safe.
    const res = await fetch(`${GITHUB_API}${url}`, {
      headers: {
        Authorization: `Bearer ${nextPat(pool)}`,
        Accept: 'application/vnd.github.cloak-preview+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'itqan-crm-stats',
      },
      next: { revalidate: 300, tags: ['stats:github'] },
    });
    if (!res.ok) throw new Error(`GitHub commit search → ${res.status}`);
    const data = (await res.json()) as SearchResponse;
    return data.total_count ?? 0;
  }
  const data = await gh<SearchResponse>(url, pool);
  return data.total_count ?? 0;
}

async function listOrgRepos(org: string, pool: string[]): Promise<RepoSummary[]> {
  // We don't paginate aggressively — orgs of Itqan's size fit in 2-3
  // pages. We cap at 200 repos to bound cost; if Itqan grows past that
  // we'll need pagination here.
  const all: RepoSummary[] = [];
  for (let page = 1; page <= 2; page++) {
    const batch = await gh<RepoSummary[]>(
      `/orgs/${org}/repos?per_page=100&page=${page}&type=all`,
      pool,
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}
