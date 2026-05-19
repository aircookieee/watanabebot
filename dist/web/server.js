"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWebServer = startWebServer;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const config_1 = __importDefault(require("../config/config"));
const db_1 = require("../database/db");
const authz_1 = require("../services/authz");
const tournaments_1 = require("../services/tournaments");
const wallets_1 = require("../services/wallets");
const bracketSorter_1 = require("../services/bracketSorter");
const sessions = new Map();
function parseCookies(req) {
    const cookie = req.headers.cookie || '';
    const out = {};
    cookie.split(';').forEach(part => {
        const idx = part.indexOf('=');
        if (idx > -1)
            out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1));
    });
    return out;
}
function getSession(req) {
    const sid = parseCookies(req).sid;
    if (!sid)
        return null;
    const cached = sessions.get(sid);
    if (cached)
        return cached;
    const stored = (0, db_1.getWebSession)(sid);
    if (!stored)
        return null;
    const session = { userId: stored.userId, username: stored.username, guildMember: stored.guildMember, csrfToken: stored.csrfToken };
    sessions.set(sid, session);
    return session;
}
function syncSession(sid, session) {
    if (!sid)
        return;
    sessions.set(sid, session);
    (0, db_1.saveWebSession)(sid, session.userId, session.username, session.guildMember, session.csrfToken, null);
}
function createCsrfToken() {
    return crypto_1.default.randomBytes(24).toString('hex');
}
function send(res, statusCode, body, headers = {}) {
    res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
    res.end(body);
}
function json(res, statusCode, data, headers = {}) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
    res.end(JSON.stringify(data));
}
function apiError(res, statusCode, error) {
    return json(res, statusCode, { error });
}
function redirect(res, location) {
    res.writeHead(302, { Location: location });
    res.end();
}
function file(res, statusCode, body, contentType) {
    res.writeHead(statusCode, { 'Content-Type': contentType, 'Content-Length': body.length.toString(), 'Cache-Control': 'public, max-age=3600' });
    res.end(body);
}
async function readJson(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => {
            try {
                resolve(data ? JSON.parse(data) : {});
            }
            catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}
async function readForm(req) {
    const body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
    return Object.fromEntries(new URLSearchParams(body).entries());
}
function requireCsrf(req, session, bodyToken) {
    const headerToken = req.headers['x-csrf-token'];
    const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;
    if (session.csrfToken !== bodyToken && session.csrfToken !== token) {
        throw new Error('Invalid CSRF token.');
    }
}
async function verifyGuildMembership(client, userId) {
    if (!config_1.default.discord.guildId)
        return false;
    try {
        const member = await client.guilds.fetch(config_1.default.discord.guildId).then(g => g.members.fetch(userId));
        return !!member;
    }
    catch {
        return false;
    }
}
async function sendTournamentUpdate(client, content) {
    const channelId = config_1.default.channels.tournamentUpdatesChannelId;
    if (!channelId)
        return;
    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel || !('send' in channel) || typeof channel.send !== 'function')
            return;
        await channel.send(content);
    }
    catch (error) {
        console.error('Failed to send tournament update:', error);
    }
}
function assetPath(...segments) {
    return path_1.default.resolve(__dirname, '../../dist-web', ...segments);
}
function serveAppShell(res) {
    const indexPath = assetPath('index.html');
    if (!fs_1.default.existsSync(indexPath))
        return send(res, 500, 'Web build not found.');
    const html = fs_1.default.readFileSync(indexPath, 'utf-8');
    return send(res, 200, html);
}
function isAssetRequest(p) {
    return /\.[a-z0-9]+$/i.test(p);
}
function readFavicon() {
    const candidates = [
        config_1.default.web.faviconPath,
        path_1.default.resolve(__dirname, '../../resources/yousoro2.png'),
        path_1.default.resolve(process.cwd(), 'resources/yousoro2.png'),
        path_1.default.resolve(__dirname, '../../resources/yousoro.png'),
        path_1.default.resolve(process.cwd(), 'resources/yousoro.png'),
    ];
    const faviconPath = candidates.find(candidate => fs_1.default.existsSync(candidate));
    if (faviconPath) {
        return { body: fs_1.default.readFileSync(faviconPath), contentType: 'image/png' };
    }
    const fallback = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#111827"/><circle cx="32" cy="32" r="20" fill="#38bdf8"/><path d="M20 34c4 8 20 8 24 0" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="25" cy="26" r="3" fill="#fff"/><circle cx="39" cy="26" r="3" fill="#fff"/></svg>`;
    return { body: Buffer.from(fallback), contentType: 'image/svg+xml' };
}
async function startWebServer(client) {
    const server = http_1.default.createServer(async (req, res) => {
        const method = req.method || 'GET';
        const url = new url_1.URL(req.url || '/', config_1.default.web.baseUrl);
        const session = getSession(req);
        const sid = parseCookies(req).sid;
        if (url.pathname === '/favicon.ico' && method === 'GET') {
            const favicon = readFavicon();
            return file(res, 200, favicon.body, favicon.contentType);
        }
        if (url.pathname === '/auth/discord' && method === 'GET') {
            const params = new URLSearchParams({
                client_id: config_1.default.discord.clientId,
                redirect_uri: config_1.default.discord.oauthRedirectUri || `${config_1.default.web.baseUrl}/auth/callback`,
                response_type: 'code',
                scope: 'identify',
                state: crypto_1.default.randomBytes(16).toString('hex'),
            });
            return redirect(res, `https://discord.com/oauth2/authorize?${params.toString()}`);
        }
        if (url.pathname === '/auth/callback' && method === 'GET') {
            const code = url.searchParams.get('code');
            if (!code)
                return send(res, 400, 'Missing OAuth code');
            const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: config_1.default.discord.clientId,
                    client_secret: config_1.default.discord.oauthClientSecret,
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: config_1.default.discord.oauthRedirectUri || `${config_1.default.web.baseUrl}/auth/callback`,
                }),
            });
            const token = await tokenRes.json();
            if (!token.access_token)
                return send(res, 400, 'Discord OAuth failed.');
            const userRes = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${token.access_token}` } });
            const user = await userRes.json();
            const guildMember = await verifyGuildMembership(client, user.id);
            if (!guildMember)
                return send(res, 403, 'You must be a member of the configured Discord server.');
            const newSid = crypto_1.default.randomBytes(32).toString('hex');
            const sessionState = { userId: user.id, username: user.username, guildMember, csrfToken: createCsrfToken() };
            sessions.set(newSid, sessionState);
            (0, db_1.saveWebSession)(newSid, sessionState.userId, sessionState.username, sessionState.guildMember, sessionState.csrfToken, null);
            res.writeHead(302, { 'Set-Cookie': `sid=${newSid}; HttpOnly; Path=/; SameSite=Lax`, Location: '/' });
            return res.end();
        }
        if (url.pathname === '/auth/logout' && method === 'POST') {
            if (sid) {
                sessions.delete(sid);
                (0, db_1.deleteWebSession)(sid);
            }
            res.writeHead(302, { 'Set-Cookie': 'sid=; HttpOnly; Path=/; Max-Age=0', Location: '/login' });
            return res.end();
        }
        if (url.pathname.startsWith('/api/')) {
            if (!session)
                return apiError(res, 401, 'unauthorized');
        }
        if (url.pathname === '/api/me' && method === 'GET') {
            return json(res, 200, { userId: session.userId, username: session.username, role: (0, authz_1.getUserRole)(session.userId), csrfToken: session.csrfToken });
        }
        if (url.pathname === '/api/tournament' && method === 'GET') {
            return json(res, 200, (0, tournaments_1.getTournamentOverview)(config_1.default.currency.guildId, session.userId));
        }
        if (url.pathname === '/api/bets' && method === 'GET') {
            return json(res, 200, { bets: (0, tournaments_1.getCurrentUserBets)(config_1.default.currency.guildId, session.userId) });
        }
        if (url.pathname === '/api/bets' && method === 'POST') {
            try {
                requireCsrf(req, session, undefined);
                const body = await readJson(req);
                (0, tournaments_1.placeTournamentBet)(config_1.default.currency.guildId, session.userId, Number(body.matchId), String(body.picked), Number(body.amount));
                return json(res, 200, { ok: true });
            }
            catch (error) {
                return apiError(res, 400, error.message);
            }
        }
        if (url.pathname === '/api/wallet' && method === 'GET') {
            const page = Math.max(1, Number(url.searchParams.get('page') || '1') || 1);
            const pageSize = 25;
            const transactions = (0, db_1.getWalletTransactions)(config_1.default.currency.guildId, session.userId, 500);
            const start = (page - 1) * pageSize;
            return json(res, 200, { summary: (0, wallets_1.getWalletSummary)(session.userId, config_1.default.currency.guildId), transactions: transactions.slice(start, start + pageSize), page, hasMore: start + pageSize < transactions.length });
        }
        if (url.pathname === '/api/wallet/pay' && method === 'POST') {
            try {
                requireCsrf(req, session, undefined);
                const body = await readJson(req);
                return json(res, 200, { ok: (0, wallets_1.payUser)(session.userId, String(body.userId), config_1.default.currency.guildId, Number(body.amount)) });
            }
            catch (error) {
                return apiError(res, 400, error.message);
            }
        }
        if (url.pathname === '/api/leaderboard' && method === 'GET') {
            return json(res, 200, { leaderboard: (0, wallets_1.getWalletLeaderboard)(config_1.default.currency.guildId, Number(url.searchParams.get('limit') || '10') || 10) });
        }
        if (url.pathname === '/api/operator/history' && method === 'GET') {
            if (!session || !(0, authz_1.canManageTournaments)(session.userId))
                return apiError(res, 403, 'forbidden');
            const action = url.searchParams.get('action') || '';
            const targetType = url.searchParams.get('targetType') || '';
            const page = Math.max(1, Number(url.searchParams.get('page') || '1') || 1);
            const pageSize = 25;
            const logs = (0, db_1.getAuditLogs)(250).filter(log => (!action || log.action.includes(action)) && (!targetType || log.targetType.includes(targetType)));
            const start = (page - 1) * pageSize;
            return json(res, 200, { entries: logs.slice(start, start + pageSize), page, hasMore: start + pageSize < logs.length });
        }
        if (url.pathname === '/api/admin/transactions' && method === 'GET') {
            if (!session || !(0, authz_1.canUseAdminTools)(session.userId))
                return apiError(res, 403, 'forbidden');
            const userId = url.searchParams.get('userId') || undefined;
            const page = Math.max(1, Number(url.searchParams.get('page') || '1') || 1);
            const pageSize = 25;
            const txs = (0, db_1.getWalletTransactions)(config_1.default.currency.guildId, userId, 500);
            const start = (page - 1) * pageSize;
            return json(res, 200, { transactions: txs.slice(start, start + pageSize), page, hasMore: start + pageSize < txs.length });
        }
        if (url.pathname === '/api/operator/bracket-sorter' && method === 'POST') {
            if (!session || !(0, authz_1.canManageTournaments)(session.userId))
                return apiError(res, 403, 'forbidden');
            try {
                const body = await readJson(req);
                return json(res, 200, (0, bracketSorter_1.sortBracket)(String(body.input || ''), Number(body.size) === 32 ? 32 : 16));
            }
            catch (error) {
                return apiError(res, 400, error.message);
            }
        }
        const mutating = [
            '/api/operator/open',
            '/api/operator/close-all',
            '/api/operator/resolve',
            '/api/operator/close',
            '/api/operator/advance-round',
            '/api/operator/end',
            '/api/admin/give',
            '/api/admin/set',
            '/api/admin/take',
        ];
        if (mutating.includes(url.pathname) && method === 'POST') {
            try {
                requireCsrf(req, session, undefined);
                const body = await readJson(req);
                if (url.pathname === '/api/operator/open') {
                    if (!session || !(0, authz_1.canManageTournaments)(session.userId))
                        return apiError(res, 403, 'forbidden');
                    const tournamentId = (0, tournaments_1.openTournamentFromBracket)(session.userId, config_1.default.currency.guildId, String(body.name), Array.isArray(body.matches) ? body.matches : []);
                    await sendTournamentUpdate(client, `Successfully opened tournament **${String(body.name)}** with ${Array.isArray(body.matches) ? body.matches.length : 0} matches. Betting is now open!`);
                    return json(res, 200, { ok: true, tournamentId });
                }
                if (url.pathname === '/api/operator/close-all') {
                    if (!session || !(0, authz_1.canManageTournaments)(session.userId))
                        return apiError(res, 403, 'forbidden');
                    const closedCount = (0, tournaments_1.closeAllTournamentMatches)(session.userId, config_1.default.currency.guildId);
                    await sendTournamentUpdate(client, `Betting has been **closed** for all ${closedCount} open matches. No more bets can be placed.`);
                    return json(res, 200, { ok: true, closedCount });
                }
                if (url.pathname === '/api/operator/resolve') {
                    if (!session || !(0, authz_1.canManageTournaments)(session.userId))
                        return apiError(res, 403, 'forbidden');
                    const result = (0, tournaments_1.resolveTournamentMatch)(session.userId, config_1.default.currency.guildId, Number(body.matchNumber), String(body.winner));
                    await sendTournamentUpdate(client, `Round ${result.match.roundNumber}, Match ${result.match.matchNumber} resolved. Winner: **${result.winner}**.`);
                    if (result.tournamentEnded) {
                        await sendTournamentUpdate(client, `All matches have been resolved. The tournament **${result.tournamentName}** has automatically ended.`);
                    }
                    return json(res, 200, result);
                }
                if (url.pathname === '/api/operator/close') {
                    if (!session || !(0, authz_1.canManageTournaments)(session.userId))
                        return apiError(res, 403, 'forbidden');
                    const match = (0, tournaments_1.closeTournamentMatch)(session.userId, config_1.default.currency.guildId, Number(body.matchNumber));
                    await sendTournamentUpdate(client, `Betting has been **closed** for Round ${match.roundNumber}, Match ${match.matchNumber} (${match.contestantA} vs ${match.contestantB}). No more bets can be placed.`);
                    return json(res, 200, { ok: true, match });
                }
                if (url.pathname === '/api/operator/advance-round') {
                    if (!session || !(0, authz_1.canManageTournaments)(session.userId))
                        return apiError(res, 403, 'forbidden');
                    const result = (0, tournaments_1.advanceTournamentRound)(session.userId, config_1.default.currency.guildId);
                    await sendTournamentUpdate(client, `Advanced to round **${result.roundNumber}** with **${result.matchCount}** matches.`);
                    return json(res, 200, result);
                }
                if (url.pathname === '/api/operator/end') {
                    if (!session || !(0, authz_1.canManageTournaments)(session.userId))
                        return apiError(res, 403, 'forbidden');
                    const activeTournament = (0, tournaments_1.getTournamentOverview)(config_1.default.currency.guildId, session.userId).tournament;
                    (0, tournaments_1.completeTournament)(session.userId, config_1.default.currency.guildId);
                    if (activeTournament) {
                        await sendTournamentUpdate(client, `Tournament **${activeTournament.name}** has been marked as completed. Pending bets have been refunded.`);
                    }
                    return json(res, 200, { ok: true });
                }
                if (url.pathname === '/api/admin/give') {
                    if (!session || !(0, authz_1.canUseAdminTools)(session.userId))
                        return apiError(res, 403, 'forbidden');
                    return json(res, 200, { ok: (0, wallets_1.adminGiveUserBalance)(session.userId, String(body.userId), config_1.default.currency.guildId, Number(body.amount)) });
                }
                if (url.pathname === '/api/admin/set') {
                    if (!session || !(0, authz_1.canUseAdminTools)(session.userId))
                        return apiError(res, 403, 'forbidden');
                    return json(res, 200, { ok: (0, wallets_1.adminSetUserBalance)(session.userId, String(body.userId), config_1.default.currency.guildId, Number(body.amount)) });
                }
                if (url.pathname === '/api/admin/take') {
                    if (!session || !(0, authz_1.canUseAdminTools)(session.userId))
                        return apiError(res, 403, 'forbidden');
                    return json(res, 200, { ok: (0, wallets_1.adminTakeUserBalance)(session.userId, String(body.userId), config_1.default.currency.guildId, Number(body.amount)) });
                }
            }
            catch (error) {
                return apiError(res, 400, error.message);
            }
        }
        if (url.pathname === '/api/session' && method === 'GET') {
            return json(res, 200, { authenticated: !!session, user: session ? { userId: session.userId, username: session.username, role: (0, authz_1.getUserRole)(session.userId), csrfToken: session.csrfToken } : null });
        }
        if (url.pathname === '/api/tournament' && method === 'POST') {
            return apiError(res, 405, 'method_not_allowed');
        }
        if (url.pathname.startsWith('/api/')) {
            return apiError(res, 404, 'not_found');
        }
        if (url.pathname === '/') {
            return redirect(res, session ? '/dashboard' : '/login');
        }
        if (method === 'GET' && (!isAssetRequest(url.pathname) || url.pathname === '/login' || url.pathname === '/dashboard' || url.pathname === '/tournament' || url.pathname === '/my-bets' || url.pathname === '/wallet' || url.pathname === '/leaderboard' || url.pathname === '/operator' || url.pathname === '/operator/bracket-sorter' || url.pathname === '/operator/history' || url.pathname === '/admin' || url.pathname === '/admin/transactions')) {
            return serveAppShell(res);
        }
        const candidate = assetPath(url.pathname.replace(/^\//, ''));
        if (method === 'GET' && fs_1.default.existsSync(candidate) && fs_1.default.statSync(candidate).isFile()) {
            const ext = path_1.default.extname(candidate).toLowerCase();
            const map = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
            return file(res, 200, fs_1.default.readFileSync(candidate), map[ext] || 'application/octet-stream');
        }
        return send(res, 404, 'Not found');
    });
    server.listen(config_1.default.web.port, () => console.log(`Web server listening on ${config_1.default.web.port}`));
}
//# sourceMappingURL=server.js.map