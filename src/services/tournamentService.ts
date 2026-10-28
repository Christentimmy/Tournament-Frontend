export interface ResolvedMatch {
  id: string;
  round: string;
  roundNo: number;
  p1: string | null; // null = TBD
  p2: string | null;
  manual: [boolean, boolean];
  winner: string | null;
  auto: boolean;
}

export interface TournamentView {
  id: string;
  name: string;
  seeds: string[];
  players: string[];
  matches: ResolvedMatch[];
  champion: string | null;
  version: number;
  updatedAt: string;
}

export interface TournamentSummary {
  _id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// Set VITE_API_URL in .env, e.g. VITE_API_URL=http://localhost:5000/api
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/* The admin key is typed in by the admin and kept for this browser tab only.
   Never put it in the frontend bundle / .env. */
const KEY_STORAGE = 'bracket:adminKey';
export const adminKey = {
  get: () => sessionStorage.getItem(KEY_STORAGE) ?? '',
  set: (key: string) => sessionStorage.setItem(KEY_STORAGE, key),
  clear: () => sessionStorage.removeItem(KEY_STORAGE),
};

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; admin?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.admin) headers['x-admin-key'] = adminKey.get();

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server');
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.message ?? res.statusText);
  return data as T;
}

export const tournamentService = {
  // Public
  list: () => request<TournamentSummary[]>('/tournaments'),
  get: (id: string) => request<TournamentView>(`/tournaments/${id}`),

  // Admin
  create: (name?: string, seeds?: string[]) =>
    request<TournamentView>('/tournaments', { method: 'POST', admin: true, body: { name, seeds } }),

  rename: (id: string, name: string) =>
    request<TournamentView>(`/tournaments/${id}`, { method: 'PATCH', admin: true, body: { name } }),

  reset: (id: string) =>
    request<TournamentView>(`/tournaments/${id}/reset`, { method: 'POST', admin: true }),

  setWinner: (id: string, matchId: string, winner: string | null) =>
    request<TournamentView>(`/tournaments/${id}/matches/${matchId}/winner`, {
      method: 'PUT',
      admin: true,
      body: { winner },
    }),

  setSlot: (id: string, matchId: string, slot: 0 | 1, player: string | null) =>
    request<TournamentView>(`/tournaments/${id}/matches/${matchId}/slots/${slot}`, {
      method: 'PUT',
      admin: true,
      body: { player },
    }),
};