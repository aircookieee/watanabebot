import React, { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Link, NavLink, Navigate, Route, BrowserRouter as Router, Routes, useLocation, useNavigate } from 'react-router-dom';
import './styles.css';

type Role = 'user' | 'operator' | 'admin';
type Me = { userId: string; username: string; role: Role; balance: number; csrfToken: string };
type Match = { id: number; matchNumber: number; roundNumber: number; contestantA: string; contestantB: string; winner: string | null; bettingOpen: boolean; userBet?: { picked: string; amount: number; status: string; payout: number } | null };
type Tournament = { tournament: { id: number; name: string } | null; role: Role; walletBalance: number; currentRoundNumber: number | null; matches: Match[] };
type Bet = { matchId: number; matchNumber: number; picked: string; amount: number; status: string; payout: number; contestantA: string; contestantB: string; winner: string | null };
type Tx = { id: number; userId: string; username?: string | null; amount: number; reason: string; referenceId: string | null; balanceAfter: number; createdAt: string };
type Audit = { id: number; actorUserId: string; actorUsername?: string | null; action: string; targetType: string; targetId: string | null; targetUsername?: string | null; metadata: string | null; createdAt: string };
type BracketPreview = { entries: { seed: number; name: string; originalNumber: number }[]; matches: { a: string; b: string }[] };

const currency = new Intl.NumberFormat('en-US');

async function api<T>(path: string, options: RequestInit = {}, csrf?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (csrf) headers.set('x-csrf-token', csrf);
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

function useAuth() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<Me>('/api/me').then(setMe).catch(() => setMe(null)).finally(() => setLoading(false));
  }, []);
  return { me, loading, setMe };
}

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

function AppRoutes() {
  const auth = useAuth();
  if (auth.loading) return <FullScreenState title="Loading console" />;
  return (
    <Routes>
      <Route path="/login" element={auth.me ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/*" element={auth.me ? <Shell me={auth.me} /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}

function Login() {
  return (
    <main className="loginPage">
      <section className="loginPanel">
        <img src="/favicon.png" alt="" className="loginMark" />
        <p className="eyebrow">Watanabe operations</p>
        <h1>Tournament console</h1>
        <p className="muted">Sign in with Discord to manage brackets, bets, wallets, and audit history.</p>
        <a className="primary wide" href="/auth/discord">Sign in with Discord</a>
      </section>
    </main>
  );
}

function Shell({ me }: { me: Me }) {
  const location = useLocation();
  const [balance, setBalance] = useState(me.balance);
  const nav = [
    ['Dashboard', '/dashboard'],
    ['Tournament', '/tournament'],
    ['My Bets', '/my-bets'],
    ['Wallet', '/wallet'],
    ['Leaderboard', '/leaderboard'],
    ...(me.role !== 'user' ? [['Operator', '/operator'], ['Bracket Sorter', '/operator/bracket-sorter'], ['History', '/operator/history']] : []),
    ...(me.role === 'admin' ? [['Admin', '/admin'], ['Transactions', '/admin/transactions']] : []),
  ];
  useEffect(() => {
    setBalance(me.balance);
    const timer = window.setInterval(() => {
      api<Me>('/api/me').then(data => setBalance(data.balance)).catch(() => {});
    }, 30000);
    return () => window.clearInterval(timer);
  }, [me.balance]);

  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/dashboard" className="brand"><img src="/favicon.png" alt="" /><span>Yousoro!</span></Link>
        <nav>{nav.map(([label, to]) => <NavLink key={to} to={to} className={({ isActive }) => isActive || location.pathname === to ? 'active' : ''}>{label}</NavLink>)}</nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="mugcoinCounter" aria-label="MugCoin balance">
            <span>MugCoin</span>
            <strong>{currency.format(balance)}</strong>
          </div>
          <div className="accountBlock"><strong>{me.username}</strong><span>{me.role}</span></div>
          <form method="post" action="/auth/logout"><button className="ghost">Logout</button></form>
        </header>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard me={me} />} />
          <Route path="/tournament" element={<TournamentPage me={me} />} />
          <Route path="/my-bets" element={<MyBets />} />
          <Route path="/wallet" element={<Wallet me={me} />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/operator" element={<Operator me={me} />} />
          <Route path="/operator/bracket-sorter" element={<BracketSorter me={me} />} />
          <Route path="/operator/history" element={<OperatorHistory />} />
          <Route path="/admin" element={<Admin me={me} />} />
          <Route path="/admin/transactions" element={<AdminTransactions />} />
        </Routes>
      </div>
    </div>
  );
}

function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = () => {
    setLoading(true);
    loader().then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(reload, deps);
  return { data, error, loading, reload };
}

function Dashboard({ me }: { me: Me }) {
  const state = useLoad(() => api<Tournament>('/api/tournament'), []);
  if (state.loading) return <FullScreenState title="Loading dashboard" />;
  if (!state.data) return <ErrorText message={state.error} />;
  const active = state.data.matches.filter(m => !m.winner && m.bettingOpen).slice(0, 6);
  const placed = state.data.matches.filter(m => m.userBet).length;
  return <Page title="Dashboard" subtitle="Current tournament state and account position.">
    <Stats>
      <Stat label="Balance" value={currency.format(state.data.walletBalance)} />
      <Stat label="Tournament" value={state.data.tournament?.name || 'None'} />
      <Stat label="Round" value={state.data.currentRoundNumber || '-'} />
      <Stat label="Bets placed" value={placed} />
    </Stats>
    <Section title="Active matches">{active.length ? <MatchGrid matches={active} me={me} onRefresh={state.reload} compact /> : <EmptyState text="No open matches right now." />}</Section>
  </Page>;
}

function TournamentPage({ me }: { me: Me }) {
  const state = useLoad(() => api<Tournament>('/api/tournament'), []);
  if (state.loading) return <FullScreenState title="Loading tournament" />;
  if (!state.data) return <ErrorText message={state.error} />;
  return <Page title="Tournament" subtitle={state.data.tournament?.name || 'No active tournament'}>
    <MatchGrid matches={state.data.matches} me={me} onRefresh={state.reload} />
  </Page>;
}

function MatchGrid({ matches, me, onRefresh, compact = false, variant }: { matches: Match[]; me: Me; onRefresh: () => void; compact?: boolean; variant?: 'operator' }) {
  if (!matches.length) return <EmptyState text="No matches to display." />;
  return <div className={variant === 'operator' ? 'matchGrid operatorGrid' : compact ? 'matchGrid compact' : 'matchGrid'}>{matches.map(match => <MatchCard key={match.id} match={match} me={me} onRefresh={onRefresh} />)}</div>;
}

function MatchCard({ match, me, onRefresh }: { match: Match; me: Me; onRefresh: () => void }) {
  const [picked, setPicked] = useState(match.contestantA);
  const [amount, setAmount] = useState(10);
  const [message, setMessage] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      await api('/api/bets', { method: 'POST', body: JSON.stringify({ matchId: match.id, picked, amount }) }, me.csrfToken);
      onRefresh();
    } catch (err: any) { setMessage(err.message); }
  };
  return <article className="matchCard">
    <div className="cardHead"><span>R{match.roundNumber} M{match.matchNumber}</span><StatusBadge match={match} /></div>
    <h3>{match.contestantA} <small>vs</small> {match.contestantB}</h3>
    {match.userBet ? <p className="muted">Your bet: {currency.format(match.userBet.amount)} on {match.userBet.picked} ({match.userBet.status}, payout {currency.format(match.userBet.payout)})</p> : <p className="muted">Pool sizes are hidden until resolution.</p>}
    {match.bettingOpen && !match.winner && !match.userBet && <form className="inlineForm" onSubmit={submit}>
      <select value={picked} onChange={e => setPicked(e.target.value)}><option>{match.contestantA}</option><option>{match.contestantB}</option></select>
      <input type="number" min="1" value={amount} onChange={e => setAmount(Number(e.target.value))} />
      <button>Bet</button>
    </form>}
    {message && <ErrorText message={message} />}
  </article>;
}

function MyBets() {
  const state = useLoad(() => api<{ bets: Bet[] }>('/api/bets'), []);
  if (state.loading) return <FullScreenState title="Loading bets" />;
  return <Page title="My Bets" subtitle="Bet status and payout history."><DataTable rows={state.data?.bets || []} columns={['matchNumber', 'picked', 'amount', 'status', 'payout', 'winner']} /></Page>;
}

function Wallet({ me }: { me: Me }) {
  const [page, setPage] = useState(1);
  const state = useLoad(() => api<{ summary: { balance: number }; transactions: Tx[]; hasMore: boolean }>(`/api/wallet?page=${page}`), [page]);
  const [form, setForm] = useState({ userId: '', amount: 1 });
  const [message, setMessage] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage('');
    const result = await api<{ ok: boolean }>('/api/wallet/pay', { method: 'POST', body: JSON.stringify(form) }, me.csrfToken);
    setMessage(result.ok ? 'Transfer complete.' : 'Transfer failed.');
    state.reload();
  }
  return <Page title="Wallet" subtitle="Balance, transfers, and transaction history.">
    <Stats><Stat label="Balance" value={currency.format(state.data?.summary.balance || 0)} /></Stats>
    <Section title="Transfer MugCoins"><form className="formRow" onSubmit={submit}><input placeholder="Discord user ID" value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} /><input type="number" min="1" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /><button>Send</button></form>{message && <p className="muted">{message}</p>}</Section>
    <Section title="Transactions"><DataTable rows={state.data?.transactions || []} columns={['amount', 'reason', 'referenceId', 'balanceAfter', 'createdAt']} /><Pager page={page} hasMore={!!state.data?.hasMore} setPage={setPage} /></Section>
  </Page>;
}

function Leaderboard() {
  const state = useLoad(() => api<{ leaderboard: { userId: string; username?: string | null; balance: number }[] }>('/api/leaderboard?limit=25'), []);
  return <Page title="Leaderboard" subtitle="Top wallet balances."><DataTable rows={(state.data?.leaderboard || []).map((x, i) => ({ rank: i + 1, ...x, user: x.username || x.userId }))} columns={['rank', 'user', 'balance']} /></Page>;
}

function Operator({ me }: { me: Me }) {
  const state = useLoad(() => api<Tournament>('/api/tournament'), []);
  const [closeMatch, setCloseMatch] = useState('');
  const [resolve, setResolve] = useState({ matchNumber: '', winner: '' });
  const matches = state.data?.matches || [];
  const closeOptions = matches.filter(match => match.bettingOpen && !match.winner);
  const resolveOptions = matches.filter(match => !match.winner);
  const selectedResolveMatch = resolveOptions.find(match => String(match.matchNumber) === resolve.matchNumber);
  const mutate = async (path: string, body = {}) => { await api(path, { method: 'POST', body: JSON.stringify(body) }, me.csrfToken); state.reload(); };
  return <Page title="Operator" subtitle="Tournament control center.">
    <div className="actions operatorActions"><ConfirmButton label="Close all betting" onConfirm={() => mutate('/api/operator/close-all')} /><ConfirmButton danger label="End tournament" onConfirm={() => mutate('/api/operator/end')} /><button onClick={() => mutate('/api/operator/advance-round')}>Advance round</button></div>
    <Section title="Matches"><MatchGrid matches={matches} me={me} onRefresh={state.reload} variant="operator" /></Section>
    <div className="twoCol">
      <Section title="Close match"><form className="formRow" onSubmit={e => { e.preventDefault(); mutate('/api/operator/close', { matchNumber: closeMatch }); }}><select value={closeMatch} onChange={e => setCloseMatch(e.target.value)} required><option value="">Select match</option>{closeOptions.map(match => <option key={match.id} value={match.matchNumber}>R{match.roundNumber} M{match.matchNumber}: {match.contestantA} vs {match.contestantB}</option>)}</select><button>Close</button></form></Section>
      <Section title="Resolve match"><form className="formRow" onSubmit={e => { e.preventDefault(); mutate('/api/operator/resolve', resolve); }}><select value={resolve.matchNumber} onChange={e => setResolve({ matchNumber: e.target.value, winner: '' })} required><option value="">Select match</option>{resolveOptions.map(match => <option key={match.id} value={match.matchNumber}>R{match.roundNumber} M{match.matchNumber}: {match.contestantA} vs {match.contestantB}</option>)}</select><select value={resolve.winner} onChange={e => setResolve({ ...resolve, winner: e.target.value })} required disabled={!selectedResolveMatch}><option value="">Select winner</option>{selectedResolveMatch && <><option value={selectedResolveMatch.contestantA}>{selectedResolveMatch.contestantA}</option><option value={selectedResolveMatch.contestantB}>{selectedResolveMatch.contestantB}</option></>}</select><button>Resolve</button></form></Section>
    </div>
  </Page>;
}

function BracketSorter({ me }: { me: Me }) {
  const [name, setName] = useState('Tournament');
  const [size, setSize] = useState(16);
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<BracketPreview | null>(null);
  const navigate = useNavigate();
  async function sort(e: FormEvent) {
    e.preventDefault();
    setPreview(await api<BracketPreview>('/api/operator/bracket-sorter', { method: 'POST', body: JSON.stringify({ input, size }) }, me.csrfToken));
  }
  async function create() {
    if (!preview) return;
    await api('/api/operator/open', { method: 'POST', body: JSON.stringify({ name, matches: preview.matches }) }, me.csrfToken);
    navigate('/operator');
  }
  return <Page title="Bracket Sorter" subtitle="Paste numbered entries, preview seed order, then create the tournament.">
    <div className="split">
      <Section title="Input"><form onSubmit={sort}><input value={name} onChange={e => setName(e.target.value)} /><select value={size} onChange={e => setSize(Number(e.target.value))}><option value={16}>16</option><option value={32}>32</option></select><textarea rows={18} value={input} onChange={e => setInput(e.target.value)} placeholder="1. Contestant A&#10;2. Contestant B" /><button>Preview bracket</button></form></Section>
      <Section title="Preview">{preview ? <><DataTable rows={preview.matches.map((m, i) => ({ match: i + 1, ...m }))} columns={['match', 'a', 'b']} /><ConfirmButton label="Create tournament" onConfirm={create} /></> : <EmptyState text="Generate a preview to inspect matches." />}</Section>
    </div>
  </Page>;
}

function OperatorHistory() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ action: '', targetType: '' });
  const query = new URLSearchParams({ page: String(page), ...filters }).toString();
  const state = useLoad(() => api<{ entries: Audit[]; hasMore: boolean }>(`/api/operator/history?${query}`), [page, filters.action, filters.targetType]);
  const rows = (state.data?.entries || []).map(entry => ({ ...entry, actor: entry.actorUsername || entry.actorUserId, target: entry.targetUsername || entry.targetId }));
  return <Page title="Operator History" subtitle="Filterable audit log."><Filters filters={filters} setFilters={setFilters} /><DataTable rows={rows} columns={['id', 'action', 'targetType', 'target', 'actor', 'createdAt']} /><Pager page={page} hasMore={!!state.data?.hasMore} setPage={setPage} /></Page>;
}

function Admin({ me }: { me: Me }) {
  const [form, setForm] = useState({ userId: '', amount: 1 });
  const [message, setMessage] = useState('');
  const run = async (path: string) => { const result = await api<{ ok: boolean }>(path, { method: 'POST', body: JSON.stringify(form) }, me.csrfToken); setMessage(result.ok ? 'Updated.' : 'Action failed.'); };
  return <Page title="Admin" subtitle="Balance tools and operational activity."><Section title="Balance tools"><div className="formRow"><input placeholder="Discord user ID" value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} /><input type="number" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /><button onClick={() => run('/api/admin/set')}>Set</button><button onClick={() => run('/api/admin/give')}>Give</button><button onClick={() => run('/api/admin/take')}>Take</button></div>{message && <p className="muted">{message}</p>}</Section><RecentAudit /></Page>;
}

function RecentAudit() {
  const state = useLoad(() => api<{ entries: Audit[] }>('/api/operator/history'), []);
  const rows = (state.data?.entries.slice(0, 10) || []).map(entry => ({ ...entry, actor: entry.actorUsername || entry.actorUserId, target: entry.targetUsername || entry.targetId }));
  return <Section title="Recent audit activity"><DataTable rows={rows} columns={['id', 'action', 'targetType', 'target', 'actor', 'createdAt']} /></Section>;
}

function AdminTransactions() {
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState('');
  const state = useLoad(() => api<{ transactions: Tx[]; hasMore: boolean }>(`/api/admin/transactions?page=${page}&userId=${encodeURIComponent(userId)}`), [page, userId]);
  const rows = (state.data?.transactions || []).map(tx => ({ ...tx, user: tx.username || tx.userId }));
  return <Page title="Admin Transactions" subtitle="Filter wallet movement by user."><div className="filters"><input placeholder="User ID" value={userId} onChange={e => setUserId(e.target.value)} /></div><DataTable rows={rows} columns={['id', 'user', 'amount', 'reason', 'referenceId', 'balanceAfter', 'createdAt']} /><Pager page={page} hasMore={!!state.data?.hasMore} setPage={setPage} /></Page>;
}

function Page({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) { return <main className="page"><div className="pageTitle"><div><h1>{title}</h1><p>{subtitle}</p></div></div>{children}</main>; }
function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="section"><h2>{title}</h2>{children}</section>; }
function Stats({ children }: { children: ReactNode }) { return <div className="stats">{children}</div>; }
function Stat({ label, value }: { label: string; value: ReactNode }) { return <div className="stat"><span>{label}</span><strong>{value}</strong></div>; }
function EmptyState({ text }: { text: string }) { return <div className="empty">{text}</div>; }
function ErrorText({ message }: { message: string }) { return message ? <p className="error">{message}</p> : null; }
function FullScreenState({ title }: { title: string }) { return <main className="centerState">{title}</main>; }
function StatusBadge({ match }: { match: Match }) { const text = match.winner ? `Winner: ${match.winner}` : match.bettingOpen ? 'Open' : 'Closed'; return <b className={match.winner ? 'badge win' : match.bettingOpen ? 'badge open' : 'badge closed'}>{text}</b>; }
function ConfirmButton({ label, danger, onConfirm }: { label: string; danger?: boolean; onConfirm: () => void }) { const [armed, setArmed] = useState(false); return <button className={danger ? 'danger' : ''} onClick={() => armed ? onConfirm() : setArmed(true)} onBlur={() => setArmed(false)}>{armed ? 'Confirm' : label}</button>; }
function Pager({ page, hasMore, setPage }: { page: number; hasMore: boolean; setPage: (page: number) => void }) { return <div className="pager"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button disabled={!hasMore} onClick={() => setPage(page + 1)}>Next</button></div>; }
function Filters({ filters, setFilters }: { filters: { action: string; targetType: string }; setFilters: (filters: { action: string; targetType: string }) => void }) { return <div className="filters"><input placeholder="Action contains" value={filters.action} onChange={e => setFilters({ ...filters, action: e.target.value })} /><input placeholder="Target type" value={filters.targetType} onChange={e => setFilters({ ...filters, targetType: e.target.value })} /></div>; }

function DataTable({ rows, columns }: { rows: Record<string, any>[]; columns: string[] }) {
  if (!rows.length) return <EmptyState text="No records found." />;
  return <div className="tableWrap"><table><thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={row.id || i}>{columns.map(c => <td key={c}>{formatCell(row[c])}</td>)}</tr>)}</tbody></table></div>;
}

function formatCell(value: unknown) {
  if (value == null || value === '') return '-';
  if (typeof value === 'number') return currency.format(value);
  return String(value);
}

createRoot(document.getElementById('root')!).render(<App />);
