import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Trophy, Shield, Eye, RefreshCw, CheckCircle2, Pencil, Check, KeyRound, Search, X, List, GitBranch,
} from 'lucide-react';
import { ApiError, adminKey, tournamentService } from './services/tournamentService';
import type { ResolvedMatch, TournamentView } from './services/tournamentService';

const BYE = 'BYE';
const ID_KEY = 'bracket:tournamentId';
const LANG_KEY = 'bracket:lang';

/* ------------------------------------------------------------------ */
/* Translations                                                        */
/* ------------------------------------------------------------------ */

const EN = {
  loading: 'Loading tournament…',
  noTournament: 'No tournament has been created yet.',
  noTournamentAdmin: 'No tournament exists yet.',
  create: 'Create tournament',
  dismiss: 'Dismiss',
  champion: 'Champion',
  championLine: (n: string) => `Champion: ${n}`,
  live: 'Live · single elimination',
  saving: 'Saving…',
  searchPlaceholder: 'Find your name…',
  clearSearch: 'Clear search',
  noPlayer: (q: string) => `No player found for “${q}”.`,
  found: (n: number) => `${n} ${n === 1 ? 'match' : 'matches'} found`,
  tabRounds: 'Rounds',
  tabBracket: 'Bracket',
  nothing: 'Nothing to show yet.',
  match: (n: number) => `Match ${n}`,
  toBeDecided: 'To be decided',
  tbd: 'TBD',
  statusDone: 'Finished',
  statusToPlay: 'To play',
  statusWaiting: 'Waiting',
  byeMoves: 'BYE · moves on',
  byeSection: 'Advanced without playing',
  navPublicAria: 'Public bracket',
  navAdminAria: 'Admin panel',
  navPublic: 'Bracket',
  navAdmin: 'Admin',
  adminTitle: 'Admin',
  adminHelp: 'Tap the winner of each match. They move to the next round automatically.',
  reset: 'Reset',
  confirmReset: 'Reset all results and manual changes?',
  toPlayBtn: (n: number) => `To play (${n})`,
  allMatches: 'All matches',
  emptyFinished: (n: string) => `Tournament finished. Champion: ${n}`,
  emptyReady: 'No matches to play in this round. Pick another round above, or switch to “All matches”.',
  emptyRound: 'No matches in this round yet.',
  done: 'Done',
  autoBye: 'Auto (BYE)',
  editPlayers: 'Change players in this match',
  tapWins: 'Tap = wins',
  winnerUndo: 'Winner · tap to undo',
  player: (n: number) => `Player ${n}`,
  autoSlot: 'Auto (from bracket)',
  manual: 'manual',
  keyTitle: 'Admin access',
  keyPlaceholder: 'Admin key',
  unlock: 'Unlock',
  footer: 'Updates automatically',
  langAria: 'Language',
  errNetwork: 'Cannot reach the server. Check your connection.',
  errKey: 'Wrong admin key. Please enter it again.',
  errConflict: 'This match just changed. The latest bracket was loaded, please try again.',
  errGeneric: 'Something went wrong. Please try again.',
  roundName: (no: number, total: number) =>
    no === total ? 'Final' : no === total - 1 ? 'Semifinals' : no === total - 2 ? 'Quarterfinals' : `Round ${no}`,
};

type Dict = typeof EN;

const TR: Dict = {
  loading: 'Turnuva yükleniyor…',
  noTournament: 'Henüz turnuva oluşturulmadı.',
  noTournamentAdmin: 'Henüz turnuva yok.',
  create: 'Turnuva oluştur',
  dismiss: 'Kapat',
  champion: 'Şampiyon',
  championLine: (n) => `Şampiyon: ${n}`,
  live: 'Canlı · tek eleme',
  saving: 'Kaydediliyor…',
  searchPlaceholder: 'İsmini ara…',
  clearSearch: 'Aramayı temizle',
  noPlayer: (q) => `“${q}” için oyuncu bulunamadı.`,
  found: (n) => `${n} maç bulundu`,
  tabRounds: 'Turlar',
  tabBracket: 'Tablo',
  nothing: 'Henüz gösterilecek bir şey yok.',
  match: (n) => `Maç ${n}`,
  toBeDecided: 'Belirlenecek',
  tbd: 'Belirsiz',
  statusDone: 'Bitti',
  statusToPlay: 'Oynanacak',
  statusWaiting: 'Bekliyor',
  byeMoves: 'Bay · üst tura geçti',
  byeSection: 'Oynamadan üst tura çıkanlar',
  navPublicAria: 'Turnuva tablosu',
  navAdminAria: 'Yönetici paneli',
  navPublic: 'Tablo',
  navAdmin: 'Yönetici',
  adminTitle: 'Yönetici',
  adminHelp: 'Her maçın kazananına dokun. Kazanan otomatik olarak sonraki tura geçer.',
  reset: 'Sıfırla',
  confirmReset: 'Tüm sonuçlar ve elle yapılan değişiklikler sıfırlansın mı?',
  toPlayBtn: (n) => `Oynanacak (${n})`,
  allMatches: 'Tüm maçlar',
  emptyFinished: (n) => `Turnuva bitti. Şampiyon: ${n}`,
  emptyReady: 'Bu turda oynanacak maç yok. Yukarıdan başka bir tur seç veya “Tüm maçlar”a geç.',
  emptyRound: 'Bu turda henüz maç yok.',
  done: 'Tamam',
  autoBye: 'Otomatik (Bay)',
  editPlayers: 'Bu maçtaki oyuncuları değiştir',
  tapWins: 'Dokun = kazandı',
  winnerUndo: 'Kazanan · geri almak için dokun',
  player: (n) => `Oyuncu ${n}`,
  autoSlot: 'Otomatik (tablodan)',
  manual: 'elle',
  keyTitle: 'Yönetici girişi',
  keyPlaceholder: 'Yönetici anahtarı',
  unlock: 'Giriş',
  footer: 'Otomatik güncellenir',
  langAria: 'Dil',
  errNetwork: 'Sunucuya ulaşılamıyor. Bağlantını kontrol et.',
  errKey: 'Yönetici anahtarı yanlış. Lütfen tekrar gir.',
  errConflict: 'Bu maç az önce değişti. Güncel tablo yüklendi, lütfen tekrar dene.',
  errGeneric: 'Bir şeyler ters gitti. Lütfen tekrar dene.',
  roundName: (no, total) =>
    no === total ? 'Final' : no === total - 1 ? 'Yarı final' : no === total - 2 ? 'Çeyrek final' : `${no}. Tur`,
};

type Lang = 'en' | 'tr';
const DICTS: Record<Lang, Dict> = { en: EN, tr: TR };
const I18n = createContext<Dict>(EN);
const useT = () => useContext(I18n);

const initialLang = (): Lang => {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'tr') return saved;
  } catch { /* ignore */ }
  return navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en';
};

function errorText(t: Dict, e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return t.errNetwork;
    if (e.status === 401) return t.errKey;
    if (e.status === 409) return t.errConflict;
  }
  return t.errGeneric;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const isPlayable = (m: ResolvedMatch) => !!m.p1 && !!m.p2 && m.p1 !== BYE && m.p2 !== BYE;
const isReady = (m: ResolvedMatch) => isPlayable(m) && !m.winner;
const isEmptyBye = (m: ResolvedMatch) => m.p1 === BYE && m.p2 === BYE;

interface RoundInfo {
  no: number;
  label: string;
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
  selected: number;
  onSelect: (no: number) => void;
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
          const active = r.no === selected;
          const complete = r.total > 0 && r.done === r.total;
          return (
            <button
              key={r.no}
              data-active={active}
              onClick={() => onSelect(r.no)}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold border transition ${
                active
                  ? 'bg-amber-500 text-slate-950 border-amber-500'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              {complete && <Check className="w-3.5 h-3.5" />}
              {r.label}
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
  const t = useT();
  const base = 'text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0';
  if (match.winner) return <span className={`${base} bg-emerald-500/15 text-emerald-300`}>{t.statusDone}</span>;
  if (isPlayable(match)) return <span className={`${base} bg-amber-500/15 text-amber-300`}>{t.statusToPlay}</span>;
  return <span className={`${base} bg-slate-800 text-slate-400`}>{t.statusWaiting}</span>;
}

function MatchCard({ match, label }: { match: ResolvedMatch; label: string }) {
  const t = useT();
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
        <span className="truncate">{name ?? t.toBeDecided}</span>
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
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60 text-sm text-slate-300">
      <span className="truncate">{match.winner}</span>
      <span className="text-xs text-slate-500 shrink-0">{t.byeMoves}</span>
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
  const t = useT();
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
        <span className="truncate">{name ?? t.tbd}</span>
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

function BracketTree({ rounds }: { rounds: RoundInfo[] }) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-6 min-w-max">
        {rounds.map((r) => (
          <div key={r.no} className="flex flex-col w-56">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider text-center mb-3">{r.label}</h3>
            <div className="flex flex-col justify-around flex-1 gap-3">
              {r.list.map((m) => (
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
  const t = useT();
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
              <Check className="w-3.5 h-3.5" /> {t.done}
            </span>
          )}
          {match.auto && <span className="text-slate-500">{t.autoBye}</span>}
          <button
            onClick={() => setEditing((v) => !v)}
            className={`p-2 rounded-lg border transition ${
              editing
                ? 'bg-amber-500 text-slate-950 border-amber-500'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
            aria-label={t.editPlayers}
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
                {name ?? t.tbd}
                {match.manual[slot] && <span className="ml-2 text-[10px] uppercase text-amber-300">{t.manual}</span>}
              </span>
              <span className="text-xs shrink-0 opacity-80">
                {isWinner ? t.winnerUndo : canPick ? t.tapWins : ''}
              </span>
            </button>
          );
        })}
      </div>

      {editing && (
        <div className="space-y-2 pt-2 border-t border-slate-800">
          {([0, 1] as const).map((slot) => (
            <label key={slot} className="block text-xs text-slate-400">
              {t.player(slot + 1)}
              <select
                disabled={busy}
                value={match.manual[slot] ? (names[slot] ?? '') : ''}
                onChange={(e) => onAssign(match.id, slot, e.target.value || null)}
                className="mt-1 w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-base text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">{t.autoSlot}</option>
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
  const t = useT();
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
        <KeyRound className="w-4 h-4 text-amber-400" /> {t.keyTitle}
      </div>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t.keyPlaceholder}
        className="w-full min-h-[48px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-base text-slate-200 focus:outline-none focus:border-amber-500"
      />
      <button type="submit" className="w-full min-h-[48px] bg-amber-500 text-slate-950 font-semibold rounded-xl">
        {t.unlock}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = DICTS[lang];

  const [viewMode, setViewMode] = useState<'public' | 'admin'>('public');
  const [publicView, setPublicView] = useState<'rounds' | 'bracket'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches ? 'bracket' : 'rounds',
  );
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [adminFilter, setAdminFilter] = useState<'ready' | 'all'>('ready');
  const [query, setQuery] = useState('');

  const [tournament, setTournament] = useState<TournamentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(() => !!adminKey.get());
  const [nameDraft, setNameDraft] = useState('');

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
  }, [lang]);

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
        const first = await tournamentService.get(list[0]._id);
        localStorage.setItem(ID_KEY, first.id);
        setTournament(first);
      } else {
        setTournament(null);
      }
    } catch (e) {
      setError(errorText(DICTS[initialLang()], e));
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
      }
      setError(errorText(t, e));
      if (e instanceof ApiError && e.status === 409 && tournament) {
        try {
          setTournament(await tournamentService.get(tournament.id));
        } catch { /* ignore */ }
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
    if (!tournament || !window.confirm(t.confirmReset)) return;
    run(() => tournamentService.reset(tournament.id));
  };

  const createTournament = () =>
    run(async () => {
      const created = await tournamentService.create();
      localStorage.setItem(ID_KEY, created.id);
      return created;
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
  const totalRounds = matches.reduce((max, m) => Math.max(max, m.roundNo), 0);

  const rounds: RoundInfo[] = useMemo(() => {
    const map = new Map<number, ResolvedMatch[]>();
    matches.forEach((m) => {
      if (!map.has(m.roundNo)) map.set(m.roundNo, []);
      map.get(m.roundNo)!.push(m);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .filter(([, list]) => !list.every(isEmptyBye))
      .map(([no, list]) => {
        const real = list.filter((m) => !isEmptyBye(m) && !m.auto);
        return {
          no,
          label: t.roundName(no, totalRounds),
          list,
          done: real.filter((m) => !!m.winner).length,
          total: real.length,
        };
      });
  }, [matches, totalRounds, t]);

  // The round people care about right now: the first one with a match to play
  const currentRound =
    rounds.find((r) => r.list.some(isReady))?.no ??
    rounds.find((r) => r.total > 0 && r.done < r.total)?.no ??
    rounds[rounds.length - 1]?.no ??
    0;
  const activeNo = selectedRound !== null && rounds.some((r) => r.no === selectedRound) ? selectedRound : currentRound;
  const active = rounds.find((r) => r.no === activeNo);

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

  const subtitle = saving ? t.saving : tournament?.champion ? t.championLine(tournament.champion) : t.live;

  /* ---- Admin round content ---- */
  const adminList = (active?.list ?? []).filter((m) => !isEmptyBye(m) && (adminFilter === 'all' || isReady(m)));
  const readyTotal = matches.filter(isReady).length;

  return (
    <I18n.Provider value={t}>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        {/* Compact header */}
        <header className="sticky top-0 z-50 h-14 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
          <div className="max-w-7xl mx-auto h-full px-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-white truncate leading-tight">{title}</h1>
                <p className="text-[11px] text-slate-400 leading-tight truncate">{subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Language switch */}
              <div
                role="group"
                aria-label={t.langAria}
                className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800"
              >
                {(['tr', 'en'] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    aria-pressed={lang === l}
                    className={`px-2.5 py-2 rounded-lg text-xs font-bold transition ${
                      lang === l ? 'bg-slate-700 text-white' : 'text-slate-500'
                    }`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                {(['public', 'admin'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    aria-label={mode === 'public' ? t.navPublicAria : t.navAdminAria}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                      viewMode === mode ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                    }`}
                  >
                    {mode === 'public' ? <Eye className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                    <span className="hidden sm:inline">{mode === 'public' ? t.navPublic : t.navAdmin}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {showTabs && <RoundTabs rounds={rounds} selected={activeNo} onSelect={setSelectedRound} />}

        <main className="flex-1 max-w-7xl w-full mx-auto px-3 py-4 md:px-6 md:py-6 space-y-4">
          {error && (
            <div className="bg-red-950/50 border border-red-900/60 text-red-200 text-sm rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-xs text-red-300 shrink-0">{t.dismiss}</button>
            </div>
          )}

          {loading ? (
            <div className="text-center text-sm text-slate-500 py-16">{t.loading}</div>
          ) : viewMode === 'public' ? (
            /* ================= PUBLIC ================= */
            !tournament ? (
              <div className="text-center text-sm text-slate-500 py-16">{t.noTournament}</div>
            ) : (
              <div className="space-y-4">
                {tournament.champion && (
                  <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
                    <Trophy className="w-8 h-8 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-amber-300/80 font-medium">{t.champion}</p>
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
                      placeholder={t.searchPlaceholder}
                      className="w-full min-h-[48px] bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-10 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                    {query && (
                      <button
                        onClick={() => setQuery('')}
                        aria-label={t.clearSearch}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-0.5 shrink-0">
                    {([
                      { key: 'rounds', label: t.tabRounds, icon: <List className="w-4 h-4" /> },
                      { key: 'bracket', label: t.tabBracket, icon: <GitBranch className="w-4 h-4" /> },
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
                  found.length === 0 ? (
                    <div className="text-center text-sm text-slate-500 py-12">{t.noPlayer(query.trim())}</div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-400">{t.found(found.length)}</p>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {found.map((m) => (
                          <MatchOrBye key={m.id} match={m} label={t.roundName(m.roundNo, totalRounds)} />
                        ))}
                      </div>
                    </div>
                  )
                ) : publicView === 'bracket' ? (
                  <BracketTree rounds={rounds} />
                ) : !active ? (
                  <div className="text-center text-sm text-slate-500 py-12">{t.nothing}</div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {active.list
                        .filter((m) => !isEmptyBye(m) && !m.auto)
                        .map((m, i) => (
                          <MatchCard key={m.id} match={m} label={t.match(i + 1)} />
                        ))}
                    </div>
                    {active.list.some((m) => m.auto && !isEmptyBye(m)) && (
                      <div className="space-y-2">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          {t.byeSection}
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
              <p className="text-sm text-slate-400">{t.noTournamentAdmin}</p>
              <button
                onClick={createTournament}
                disabled={saving}
                className="min-h-[48px] bg-amber-500 text-slate-950 font-semibold rounded-xl px-6 disabled:opacity-50"
              >
                {t.create}
              </button>
            </div>
          ) : (
            /* ================= ADMIN ================= */
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                <div>
                  <h2 className="text-base font-bold text-white">{t.adminTitle}</h2>
                  <p className="text-xs text-slate-400">{t.adminHelp}</p>
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
                    {t.reset}
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
                    {f === 'ready' ? t.toPlayBtn(readyTotal) : t.allMatches}
                  </button>
                ))}
              </div>

              {adminList.length === 0 ? (
                <div className="text-center text-sm text-slate-500 py-10 border border-dashed border-slate-800 rounded-2xl px-4">
                  {tournament.champion
                    ? t.emptyFinished(tournament.champion)
                    : adminFilter === 'ready'
                    ? t.emptyReady
                    : t.emptyRound}
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
          {t.footer}
        </footer>
      </div>
    </I18n.Provider>
  );
}