import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Trophy, Shield, Eye, RefreshCw, CheckCircle2, Pencil, Check, KeyRound, Search, X, List, GitBranch,
} from 'lucide-react';
import { ApiError, adminKey, tournamentService } from './services/tournamentService';
import type { ResolvedMatch, TournamentView } from './services/tournamentService';

const BYE = 'BYE';
const ID_KEY = 'bracket:tournamentId';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const isPlayable = (m: ResolvedMatch) => !!m.p1 && !!m.p2 && m.p1 !== BYE && m.p2 !== BYE;
const isReady = (m: ResolvedMatch) => isPlayable(m) && !m.winner;
const isEmptyBye = (m: ResolvedMatch) => m.p1 === BYE && m.p2 === BYE;

function groupByRound(list: ResolvedMatch[]) {
  const map = new Map<string, ResolvedMatch[]>();
  list.forEach((m) => {
    if (!map.has(m.round)) map.set(m.round, []);
    map.get(m.round)!.push(m);
  });
  return Array.from(map.entries());
}

interface RoundInfo {
  name: string;
  list: ResolvedMatch[];
  done: number;
  total: number;
}

/* ------------------------------------------------------------------ */
/* Round tabs (sticky, swipeable)                                      */
/* ------------------------------------------------------------------ */

function RoundTabs({
  rounds,
  selected,
  onSelect,
}: {
  rounds: RoundInfo[];
  selected: string;
  onSelect: (name: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  return (
    <div className="sticky top-14 z-40 bg-slate-950/95 backdrop-blur border-b border-slate-800/70">
      <div
        ref={ref}
        className="max-w-7xl mx-auto flex gap-2 overflow-x-auto px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {rounds.map((r) => {
          const active = r.name === selected;
          const complete = r.total > 0 && r.done === r.total;
          return (
            <button
              key={r.name}
              data-active={active}
              onClick={() => onSelect(r.name)}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold border transition ${
                active
                  ? 'bg-amber-500 text-slate-950 border-amber-500'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              {complete && <Check className="w-3.5 h-3.5" />}
              {r.name}
              {r.total > 0 && (
                <span className={`text-xs font-medium ${active ? 'text-slate-800' : 'text-slate-500'}`}>
                  {r.done}/{r.total}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Public: match cards                                                 */
/* ------------------------------------------------------------------ */

function StatusChip({ match }: { match: ResolvedMatch }) {
  const base = 'text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0';
  if (match.winner) return <span className={`${base} bg-emerald-500/15 text-emerald-300`}>Finished</span>;
  if (isPlayable(match)) return <span className={`${base} bg-amber-500/15 text-amber-300`}>To play</span>;
  return <span className={`${base} bg-slate-800 text-slate-400`}>Waiting</span>;
}

function MatchCard({ match, label }: { match: ResolvedMatch; label: string }) {
  const done = !!match.winner;

  const row = (name: string | null) => {
    const isWinner = done && name === match.winner;
    const isLoser = done && !!name && name !== match.winner;
    return (
      <div
        className={`flex items-center justify-between gap-2 px-3.5 min-h-[48px] rounded-xl border text-base ${
          isWinner
            ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-100 font-semibold'
            : isLoser
            ? 'bg-slate-950/40 border-slate-800/60 text-slate-500'
            : !name
            ? 'bg-slate-950/20 border-slate-900 text-slate-600 italic'
            : 'bg-slate-950/60 border-slate-700/70 text-slate-100'
        }`}
      >
        <span className="truncate">{name ?? 'To be decided'}</span>
        {isWinner && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
      </div>
    );
  };

  return (
    <div
      className={`rounded-2xl border p-3 space-y-2 ${
        isReady(match) ? 'border-amber-500/40 bg-slate-900' : 'border-slate-800 bg-slate-900/70'
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="text-xs font-medium text-slate-400 truncate">{label}</span>
        <StatusChip match={match} />
      </div>
      {row(match.p1)}
      {row(match.p2)}
    </div>
  );
}

function ByeLine({ match }: { match: ResolvedMatch }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60 text-sm text-slate-300">
      <span className="truncate">{match.winner}</span>
      <span className="text-xs text-slate-500 shrink-0">BYE · moves on</span>
    </div>
  );
}

function MatchOrBye({ match, label }: { match: ResolvedMatch; label: string }) {
  return match.auto ? <ByeLine match={match} /> : <MatchCard match={match} label={label} />;
}

/* ------------------------------------------------------------------ */
/* Public: full bracket tree (for bigger screens)                      */
/* ------------------------------------------------------------------ */

function BracketMatchCard({ match }: { match: ResolvedMatch }) {
  const row = (name: string | null) => {
    const isWinner = !!name && match.winner === name && name !== BYE;
    return (
      <div
        className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${
          isWinner
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200 font-bold'
            : !name
            ? 'bg-slate-950/20 border-slate-900 text-slate-600 italic'
            : name === BYE
            ? 'bg-slate-950/20 border-slate-900 text-slate-600'
            : 'bg-slate-950/50 border-slate-800/60 text-slate-200'
        }`}
      >
        <span className="truncate">{name ?? 'TBD'}</span>
        {isWinner && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
      </div>
    );
  };

  return (
    <div
      className={`bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-1.5 shadow-md ${
        isEmptyBye(match) ? 'invisible' : ''
      }`}
    >
      {row(match.p1)}
      {row(match.p2)}
    </div>
  );
}

function BracketTree({ matches }: { matches: ResolvedMatch[] }) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-6 min-w-max">
        {groupByRound(matches).map(([round, list]) => (
          <div key={round} className="flex flex-col w-56">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider text-center mb-3">{round}</h3>
            <div className="flex flex-col justify-around flex-1 gap-3">
              {list.map((m) => (
                <BracketMatchCard key={m.id} match={m} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Admin match card                                                    */
/* ------------------------------------------------------------------ */

interface AdminCardProps {
  match: ResolvedMatch;
  players: string[];
  busy: boolean;
  onWinner: (matchId: string, name: string | null) => void;
  onAssign: (matchId: string, slot: 0 | 1, name: string | null) => void;
}

function AdminMatchCard({ match, players, busy, onWinner, onAssign }: AdminCardProps) {
  const [editing, setEditing] = useState(false);
  const canPick = isPlayable(match) && !match.auto && !busy;
  const names: [string | null, string | null] = [match.p1, match.p2];

  return (
    <div
      className={`rounded-2xl border p-3 space-y-2.5 ${
        isReady(match) ? 'bg-slate-900 border-amber-500/40' : 'bg-slate-900/70 border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-amber-400">{match.id}</span>
        <div className="flex items-center gap-2">
          {match.winner && !match.auto && (
            <span className="text-emerald-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Done
            </span>
          )}
          {match.auto && <span className="text-slate-500">Auto (BYE)</span>}
          <button
            onClick={() => setEditing((v) => !v)}
            className={`p-2 rounded-lg border transition ${
              editing
                ? 'bg-amber-500 text-slate-950 border-amber-500'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
            aria-label="Change players in this match"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {names.map((name, slot) => {
          const isWinner = !!name && match.winner === name && name !== BYE;
          return (
            <button
              key={slot}
              disabled={!canPick}
              onClick={() => onWinner(match.id, isWinner ? null : (name as string))}
              className={`w-full flex items-center justify-between gap-2 px-3.5 min-h-[52px] rounded-xl border text-base text-left transition active:scale-[0.99] ${
                isWinner
                  ? 'bg-emerald-600 border-emerald-500 text-white font-semibold'
                  : canPick
                  ? 'bg-slate-950 border-slate-700 text-slate-100 active:bg-slate-800'
                  : 'bg-slate-950/40 border-slate-900 text-slate-500'
              }`}
            >
              <span className="truncate">
                {name ?? 'TBD'}
                {match.manual[slot] && <span className="ml-2 text-[10px] uppercase text-amber-300">manual</span>}
              </span>
              <span className="text-xs shrink-0 opacity-80">
                {isWinner ? 'Winner · tap to undo' : canPick ? 'Tap = wins' : ''}
              </span>
            </button>
          );
        })}
      </div>

      {editing && (
        <div className="space-y-2 pt-2 border-t border-slate-800">
          {([0, 1] as const).map((slot) => (
            <label key={slot} className="block text-xs text-slate-400">
              Player {slot + 1}
              <select
                disabled={busy}
                value={match.manual[slot] ? (names[slot] ?? '') : ''}
                onChange={(e) => onAssign(match.id, slot, e.target.value || null)}
                className="mt-1 w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-base text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Auto (from bracket)</option>
                {players.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Admin key form                                                      */
/* ------------------------------------------------------------------ */

function AdminKeyForm({ onSubmit }: { onSubmit: (key: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
      className="max-w-sm mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3"
    >
      <div className="flex items-center gap-2 text-white font-semibold">
        <KeyRound className="w-4 h-4 text-amber-400" /> Admin access
      </div>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Admin key"
        className="w-full min-h-[48px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-base text-slate-200 focus:outline-none focus:border-amber-500"
      />
      <button type="submit" className="w-full min-h-[48px] bg-amber-500 text-slate-950 font-semibold rounded-xl">
        Unlock
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

export default function App() {
  const [viewMode, setViewMode] = useState<'public' | 'admin'>('public');
  const [publicView, setPublicView] = useState<'rounds' | 'bracket'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches ? 'bracket' : 'rounds',
  );
  const [selectedRound, setSelectedRound] = useState<string | null>(null);
  const [adminFilter, setAdminFilter] = useState<'ready' | 'all'>('ready');
  const [query, setQuery] = useState('');

  const [tournament, setTournament] = useState<TournamentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(() => !!adminKey.get());
  const [nameDraft, setNameDraft] = useState('');

  /* ---- Initial load: remembered tournament, otherwise the latest one ---- */
  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const savedId = localStorage.getItem(ID_KEY);
      if (savedId) {
        try {
          setTournament(await tournamentService.get(savedId));
          return;
        } catch (e) {
          if (!(e instanceof ApiError && (e.status === 404 || e.status === 400))) throw e;
        }
      }
      const list = await tournamentService.list();
      if (list.length) {
        const t = await tournamentService.get(list[0]._id);
        localStorage.setItem(ID_KEY, t.id);
        setTournament(t);
      } else {
        setTournament(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tournament');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (tournament) setNameDraft(tournament.name);
  }, [tournament?.name]);

  /* ---- Public view: refresh every 10s and when the phone wakes up ---- */
  useEffect(() => {
    if (!tournament || viewMode !== 'public') return;
    const id = tournament.id;
    const refresh = async () => {
      try {
        setTournament(await tournamentService.get(id));
      } catch {
        /* keep showing the last data */
      }
    };
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, 10000);
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [tournament?.id, viewMode]);

  /* ---- Run an admin action; the server replies with the fresh bracket ---- */
  const run = async (action: () => Promise<TournamentView>) => {
    setSaving(true);
    setError(null);
    try {
      setTournament(await action());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        adminKey.clear();
        setHasKey(false);
        setError('Wrong admin key. Please enter it again.');
      } else {
        setError(e instanceof Error ? e.message : 'Something went wrong');
        if (e instanceof ApiError && e.status === 409 && tournament) {
          try {
            setTournament(await tournamentService.get(tournament.id));
          } catch { /* ignore */ }
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const setWinner = (matchId: string, name: string | null) =>
    tournament && run(() => tournamentService.setWinner(tournament.id, matchId, name));

  const assignSlot = (matchId: string, slot: 0 | 1, name: string | null) =>
    tournament && run(() => tournamentService.setSlot(tournament.id, matchId, slot, name));

  const resetTournament = () => {
    if (!tournament || !window.confirm('Reset all results and manual changes?')) return;
    run(() => tournamentService.reset(tournament.id));
  };

  const createTournament = () =>
    run(async () => {
      const t = await tournamentService.create();
      localStorage.setItem(ID_KEY, t.id);
      return t;
    });

  const commitName = () => {
    if (!tournament) return;
    const n = nameDraft.trim();
    if (!n || n === tournament.name) {
      setNameDraft(tournament.name);
      return;
    }
    run(() => tournamentService.rename(tournament.id, n));
  };

  /* ---- Derived ---- */
  const matches = tournament?.matches ?? [];
  const players = tournament?.players ?? [];
  const title = tournament?.name ?? 'Tournament';

  const rounds: RoundInfo[] = useMemo(
    () =>
      groupByRound(matches)
        .filter(([, list]) => !list.every(isEmptyBye))
        .map(([name, list]) => {
          const real = list.filter((m) => !isEmptyBye(m) && !m.auto);
          return { name, list, done: real.filter((m) => !!m.winner).length, total: real.length };
        }),
    [matches],
  );

  // The round people care about right now: the first one with a match to play
  const currentRound =
    rounds.find((r) => r.list.some(isReady))?.name ??
    rounds.find((r) => r.total > 0 && r.done < r.total)?.name ??
    rounds[rounds.length - 1]?.name ??
    '';
  const activeName = selectedRound && rounds.some((r) => r.name === selectedRound) ? selectedRound : currentRound;
  const active = rounds.find((r) => r.name === activeName);

  const q = query.trim().toLocaleLowerCase('tr');
  const found = q
    ? matches.filter(
        (m) =>
          !isEmptyBye(m) &&
          [m.p1, m.p2].some((n) => n && n !== BYE && n.toLocaleLowerCase('tr').includes(q)),
      )
    : [];

  const showTabs =
    !loading &&
    !!tournament &&
    rounds.length > 0 &&
    ((viewMode === 'public' && publicView === 'rounds' && !q) || (viewMode === 'admin' && hasKey));

  const subtitle = saving
    ? 'Saving…'
    : tournament?.champion
    ? `Champion: ${tournament.champion}`
    : 'Live · single elimination';

  /* ---- Admin round content ---- */
  const adminList = (active?.list ?? []).filter((m) => !isEmptyBye(m) && (adminFilter === 'all' || isReady(m)));
  const readyTotal = matches.filter(isReady).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Compact header */}
      <header className="sticky top-0 z-50 h-14 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
        <div className="max-w-7xl mx-auto h-full px-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white truncate leading-tight">{title}</h1>
              <p className="text-[11px] text-slate-400 leading-tight truncate">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800 shrink-0">
            {(['public', 'admin'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                aria-label={mode === 'public' ? 'Public bracket' : 'Admin panel'}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                  viewMode === mode ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                {mode === 'public' ? <Eye className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                <span className="hidden sm:inline">{mode === 'public' ? 'Bracket' : 'Admin'}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {showTabs && <RoundTabs rounds={rounds} selected={activeName} onSelect={setSelectedRound} />}

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 py-4 md:px-6 md:py-6 space-y-4">
        {error && (
          <div className="bg-red-950/50 border border-red-900/60 text-red-200 text-sm rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-xs text-red-300 shrink-0">Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="text-center text-sm text-slate-500 py-16">Loading tournament…</div>
        ) : viewMode === 'public' ? (
          /* ================= PUBLIC ================= */
          !tournament ? (
            <div className="text-center text-sm text-slate-500 py-16">No tournament has been created yet.</div>
          ) : (
            <div className="space-y-4">
              {tournament.champion && (
                <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
                  <Trophy className="w-8 h-8 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-amber-300/80 font-medium">Champion</p>
                    <p className="text-xl font-extrabold text-white truncate">{tournament.champion}</p>
                  </div>
                </div>
              )}

              {/* Search + view switch */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find your name…"
                    className="w-full min-h-[48px] bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-10 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-0.5 shrink-0">
                  {([
                    { key: 'rounds', label: 'Rounds', icon: <List className="w-4 h-4" /> },
                    { key: 'bracket', label: 'Bracket', icon: <GitBranch className="w-4 h-4" /> },
                  ] as const).map((v) => (
                    <button
                      key={v.key}
                      onClick={() => setPublicView(v.key)}
                      aria-label={v.label}
                      className={`flex items-center gap-1.5 px-3 min-h-[44px] rounded-[10px] text-xs font-semibold ${
                        publicView === v.key ? 'bg-slate-700 text-white' : 'text-slate-400'
                      }`}
                    >
                      {v.icon}
                      <span className="hidden sm:inline">{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {q ? (
                /* Search results across all rounds */
                found.length === 0 ? (
                  <div className="text-center text-sm text-slate-500 py-12">No player found for “{query.trim()}”.</div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-400">
                      {found.length} {found.length === 1 ? 'match' : 'matches'} found
                    </p>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {found.map((m) => (
                        <MatchOrBye key={m.id} match={m} label={m.round} />
                      ))}
                    </div>
                  </div>
                )
              ) : publicView === 'bracket' ? (
                <BracketTree matches={matches} />
              ) : !active ? (
                <div className="text-center text-sm text-slate-500 py-12">Nothing to show yet.</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {active.list
                      .filter((m) => !isEmptyBye(m) && !m.auto)
                      .map((m, i) => (
                        <MatchCard key={m.id} match={m} label={`Match ${i + 1}`} />
                      ))}
                  </div>
                  {active.list.some((m) => m.auto && !isEmptyBye(m)) && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Advanced without playing
                      </h3>
                      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                        {active.list
                          .filter((m) => m.auto && !isEmptyBye(m))
                          .map((m) => (
                            <ByeLine key={m.id} match={m} />
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        ) : !hasKey ? (
          /* ================= ADMIN: key ================= */
          <AdminKeyForm
            onSubmit={(key) => {
              adminKey.set(key);
              setHasKey(true);
              setError(null);
            }}
          />
        ) : !tournament ? (
          <div className="text-center py-16 space-y-4">
            <p className="text-sm text-slate-400">No tournament exists yet.</p>
            <button
              onClick={createTournament}
              disabled={saving}
              className="min-h-[48px] bg-amber-500 text-slate-950 font-semibold rounded-xl px-6 disabled:opacity-50"
            >
              Create tournament
            </button>
          </div>
        ) : (
          /* ================= ADMIN ================= */
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3">
              <div>
                <h2 className="text-base font-bold text-white">Admin</h2>
                <p className="text-xs text-slate-400">
                  Tap the winner of each match. They move to the next round automatically.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  className="flex-1 min-w-0 min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-base text-slate-200 focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={resetTournament}
                  disabled={saving}
                  className="flex items-center gap-1.5 min-h-[44px] text-xs bg-red-950/50 border border-red-900/50 text-red-300 font-medium px-3 rounded-xl shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(['ready', 'all'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setAdminFilter(f)}
                  className={`min-h-[44px] rounded-xl text-sm font-semibold border transition ${
                    adminFilter === f
                      ? 'bg-slate-700 border-slate-600 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  {f === 'ready' ? `To play (${readyTotal})` : 'All matches'}
                </button>
              ))}
            </div>

            {adminList.length === 0 ? (
              <div className="text-center text-sm text-slate-500 py-10 border border-dashed border-slate-800 rounded-2xl px-4">
                {tournament.champion
                  ? `Tournament finished. Champion: ${tournament.champion}`
                  : adminFilter === 'ready'
                  ? 'No matches to play in this round. Pick another round above, or switch to “All matches”.'
                  : 'No matches in this round yet.'}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {adminList.map((m) => (
                  <AdminMatchCard
                    key={m.id}
                    match={m}
                    players={players}
                    busy={saving}
                    onWinner={setWinner}
                    onAssign={assignSlot}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800/60 bg-slate-950 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center text-xs text-slate-500">
        Updates automatically
      </footer>
    </div>
  );
}