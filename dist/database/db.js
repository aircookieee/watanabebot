"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.registerAnilistUser = registerAnilistUser;
exports.unregisterAnilistUser = unregisterAnilistUser;
exports.getAnilistUsername = getAnilistUsername;
exports.getAllAnilistMappings = getAllAnilistMappings;
exports.getAnilistUserCount = getAnilistUserCount;
exports.saveUserMediaBatch = saveUserMediaBatch;
exports.clearUserMediaList = clearUserMediaList;
exports.getUserMediaList = getUserMediaList;
exports.getUserMediaById = getUserMediaById;
exports.saveUserFavorites = saveUserFavorites;
exports.getUserFavorites = getUserFavorites;
exports.getLastRefreshTime = getLastRefreshTime;
exports.updateRefreshLog = updateRefreshLog;
exports.getGuildConfig = getGuildConfig;
exports.setGuildConfig = setGuildConfig;
exports.getSetting = getSetting;
exports.setSetting = setSetting;
exports.getOrCreateWallet = getOrCreateWallet;
exports.getBalance = getBalance;
exports.addCurrency = addCurrency;
exports.spendCurrency = spendCurrency;
exports.setBalance = setBalance;
exports.transferCurrency = transferCurrency;
exports.getLeaderboard = getLeaderboard;
exports.getWalletTransactions = getWalletTransactions;
exports.addAuditLog = addAuditLog;
exports.getAuditLogs = getAuditLogs;
exports.saveWebSession = saveWebSession;
exports.getWebSession = getWebSession;
exports.deleteWebSession = deleteWebSession;
exports.createTournament = createTournament;
exports.addTournamentMatch = addTournamentMatch;
exports.getActiveTournament = getActiveTournament;
exports.getTournamentMatches = getTournamentMatches;
exports.getMatch = getMatch;
exports.getMatchByNumber = getMatchByNumber;
exports.getCurrentRoundNumber = getCurrentRoundNumber;
exports.createNextRoundFromWinners = createNextRoundFromWinners;
exports.closeBettingForMatch = closeBettingForMatch;
exports.placeBet = placeBet;
exports.getBetsForMatch = getBetsForMatch;
exports.getUserBets = getUserBets;
exports.resolveMatch = resolveMatch;
exports.endTournament = endTournament;
exports.closeDatabase = closeDatabase;
const sql_js_1 = __importDefault(require("sql.js"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = __importDefault(require("../config/config"));
let db = null;
let dbPath = '';
async function initDatabase() {
    const wasmPath = path_1.default.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm');
    let SQL;
    if (fs_1.default.existsSync(wasmPath)) {
        const wasmBinary = fs_1.default.readFileSync(wasmPath);
        SQL = await (0, sql_js_1.default)({ wasmBinary: wasmBinary });
    }
    else {
        SQL = await (0, sql_js_1.default)();
    }
    dbPath = config_1.default.paths.databasePath;
    const dataDir = config_1.default.paths.dataDir;
    if (!fs_1.default.existsSync(dataDir)) {
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
    if (fs_1.default.existsSync(dbPath)) {
        const fileBuffer = fs_1.default.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
    }
    else {
        db = new SQL.Database();
    }
    initializeTables();
    migrateLegacyData();
    saveDatabase();
}
function saveDatabase() {
    if (!db)
        return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs_1.default.writeFileSync(dbPath, buffer);
}
function initializeTables() {
    if (!db)
        return;
    db.run(`
        CREATE TABLE IF NOT EXISTS discord_anilist_map (
            discord_id TEXT PRIMARY KEY,
            anilist_username TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS guild_config (
            guild_id TEXT PRIMARY KEY,
            channel_id TEXT DEFAULT '',
            mode TEXT DEFAULT 'everywhere'
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS web_sessions (
            sid TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            guild_member INTEGER NOT NULL DEFAULT 1,
            csrf_token TEXT NOT NULL,
            bracket_preview TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS user_media_lists (
            discord_id TEXT NOT NULL,
            media_id INTEGER NOT NULL,
            media_type TEXT NOT NULL,
            entry_data TEXT NOT NULL,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (discord_id, media_id)
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS user_favorites (
            discord_id TEXT NOT NULL,
            media_id INTEGER NOT NULL,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (discord_id, media_id)
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS anilist_refresh_log (
            discord_id TEXT PRIMARY KEY,
            last_lists_refresh TEXT,
            last_favorites_refresh TEXT
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS wallets (
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            balance INTEGER NOT NULL DEFAULT 500,
            total_earned INTEGER NOT NULL DEFAULT 0,
            total_spent INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, guild_id)
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS wallet_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            amount INTEGER NOT NULL,
            reason TEXT NOT NULL,
            reference_id TEXT,
            balance_after INTEGER NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_user_id TEXT NOT NULL,
            action TEXT NOT NULL,
            target_type TEXT NOT NULL,
            target_id TEXT,
            metadata TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS tournaments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS tournament_rounds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tournament_id INTEGER NOT NULL,
            round_number INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tournament_id, round_number),
            FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS tournament_matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tournament_id INTEGER NOT NULL,
            match_number INTEGER NOT NULL,
            round_number INTEGER NOT NULL DEFAULT 1,
            contestant_a TEXT NOT NULL,
            contestant_b TEXT NOT NULL,
            winner TEXT,
            betting_open INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
        )
    `);
    try {
        db.run(`ALTER TABLE tournament_matches ADD COLUMN round_number INTEGER NOT NULL DEFAULT 1`);
    }
    catch { }
    db.run(`
        CREATE TABLE IF NOT EXISTS bets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tournament_id INTEGER NOT NULL,
            match_id INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            picked TEXT NOT NULL,
            amount INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            payout INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tournament_id, match_id, user_id),
            FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
            FOREIGN KEY (match_id) REFERENCES tournament_matches(id)
        )
    `);
}
function migrateLegacyData() {
    if (!db)
        return;
    const legacyMapPath = path_1.default.join(__dirname, '../../discordAniListMap.json');
    console.log('Checking for legacy data at:', legacyMapPath);
    if (fs_1.default.existsSync(legacyMapPath)) {
        try {
            const legacyMap = JSON.parse(fs_1.default.readFileSync(legacyMapPath, 'utf-8'));
            console.log('Found legacy mappings:', JSON.stringify(legacyMap));
            const stmt = db.prepare(`
                INSERT OR IGNORE INTO discord_anilist_map (discord_id, anilist_username)
                VALUES (?, ?)
            `);
            for (const [discordId, anilistUsername] of Object.entries(legacyMap)) {
                stmt.run([discordId, anilistUsername]);
            }
            stmt.free();
            saveDatabase();
            console.log('Migrated legacy Anilist mapping data');
        }
        catch (err) {
            console.error('Failed to migrate legacy data:', err);
        }
    }
    else {
        console.log('No legacy mapping file found');
    }
}
function registerAnilistUser(discordId, anilistUsername) {
    if (!db)
        return false;
    const existingUser = db.exec(`SELECT discord_id FROM discord_anilist_map WHERE anilist_username = ?`, [anilistUsername]);
    if (existingUser.length > 0 && existingUser[0].values.length > 0) {
        const existingDiscordId = existingUser[0].values[0][0];
        if (existingDiscordId !== discordId) {
            return false;
        }
    }
    const existing = db.exec(`SELECT discord_id FROM discord_anilist_map WHERE discord_id = ?`, [discordId]);
    if (existing.length > 0 && existing[0].values.length > 0) {
        db.run(`UPDATE discord_anilist_map SET anilist_username = ?, updated_at = CURRENT_TIMESTAMP WHERE discord_id = ?`, [anilistUsername, discordId]);
    }
    else {
        db.run(`INSERT INTO discord_anilist_map (discord_id, anilist_username) VALUES (?, ?)`, [discordId, anilistUsername]);
    }
    saveDatabase();
    return true;
}
function unregisterAnilistUser(discordId) {
    if (!db)
        return false;
    const before = db.exec(`SELECT COUNT(*) FROM discord_anilist_map WHERE discord_id = ?`, [discordId]);
    const countBefore = before[0]?.values[0]?.[0] || 0;
    if (countBefore === 0)
        return false;
    db.run(`DELETE FROM discord_anilist_map WHERE discord_id = ?`, [discordId]);
    saveDatabase();
    return true;
}
function getAnilistUsername(discordId) {
    if (!db)
        return null;
    const result = db.exec(`SELECT anilist_username FROM discord_anilist_map WHERE discord_id = ?`, [discordId]);
    if (result.length > 0 && result[0].values.length > 0) {
        return result[0].values[0][0];
    }
    return null;
}
function getAllAnilistMappings() {
    if (!db)
        return {};
    const result = db.exec(`SELECT discord_id, anilist_username FROM discord_anilist_map`);
    const mappings = {};
    if (result.length > 0) {
        for (const row of result[0].values) {
            mappings[row[0]] = row[1];
        }
    }
    return mappings;
}
function getAnilistUserCount() {
    if (!db)
        return 0;
    const result = db.exec(`SELECT COUNT(*) FROM discord_anilist_map`);
    if (result.length > 0 && result[0].values.length > 0) {
        return result[0].values[0][0];
    }
    return 0;
}
function saveUserMediaBatch(discordId, entries) {
    if (!db)
        return;
    if (entries.length === 0) {
        saveDatabase();
        return;
    }
    const mediaType = entries[0].mediaType;
    db.run(`DELETE FROM user_media_lists WHERE discord_id = ? AND media_type = ?`, [discordId, mediaType]);
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO user_media_lists (discord_id, media_id, media_type, entry_data, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    for (const entry of entries) {
        stmt.run([discordId, entry.mediaId, entry.mediaType, entry.entryData]);
    }
    stmt.free();
    saveDatabase();
}
function clearUserMediaList(discordId, mediaType) {
    if (!db)
        return;
    if (mediaType) {
        db.run(`DELETE FROM user_media_lists WHERE discord_id = ? AND media_type = ?`, [discordId, mediaType]);
    }
    else {
        db.run(`DELETE FROM user_media_lists WHERE discord_id = ?`, [discordId]);
    }
    saveDatabase();
}
function getUserMediaList(discordId, mediaType) {
    if (!db)
        return [];
    let query = `SELECT media_id, media_type, entry_data FROM user_media_lists WHERE discord_id = ?`;
    const params = [discordId];
    if (mediaType) {
        query += ` AND media_type = ?`;
        params.push(mediaType);
    }
    const result = db.exec(query, params);
    const entries = [];
    if (result.length > 0 && result[0].values.length > 0) {
        for (const row of result[0].values) {
            entries.push({
                mediaId: row[0],
                mediaType: row[1],
                entryData: row[2],
            });
        }
    }
    return entries;
}
function getUserMediaById(discordId, mediaId) {
    if (!db)
        return null;
    const result = db.exec(`SELECT entry_data FROM user_media_lists WHERE discord_id = ? AND media_id = ?`, [discordId, mediaId]);
    if (result.length > 0 && result[0].values.length > 0) {
        return result[0].values[0][0];
    }
    return null;
}
function saveUserFavorites(discordId, mediaIds) {
    if (!db || mediaIds.length === 0)
        return;
    db.run(`DELETE FROM user_favorites WHERE discord_id = ?`, [discordId]);
    const stmt = db.prepare(`
        INSERT INTO user_favorites (discord_id, media_id, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
    `);
    for (const mediaId of mediaIds) {
        stmt.run([discordId, mediaId]);
    }
    stmt.free();
    saveDatabase();
}
function getUserFavorites(discordId) {
    if (!db)
        return [];
    const result = db.exec(`SELECT media_id FROM user_favorites WHERE discord_id = ?`, [discordId]);
    const ids = [];
    if (result.length > 0 && result[0].values.length > 0) {
        for (const row of result[0].values) {
            ids.push(row[0]);
        }
    }
    return ids;
}
function getLastRefreshTime(discordId) {
    if (!db)
        return null;
    const result = db.exec(`SELECT last_lists_refresh, last_favorites_refresh FROM anilist_refresh_log WHERE discord_id = ?`, [discordId]);
    if (result.length > 0 && result[0].values.length > 0) {
        const row = result[0].values[0];
        return {
            lists: row[0],
            favorites: row[1],
        };
    }
    return null;
}
function updateRefreshLog(discordId, refreshType) {
    if (!db)
        return;
    const value = new Date().toISOString();
    // Ensure a row exists
    db.run(`INSERT OR IGNORE INTO anilist_refresh_log (discord_id) VALUES (?)`, [discordId]);
    const column = refreshType === 'lists' ? 'last_lists_refresh' : 'last_favorites_refresh';
    db.run(`UPDATE anilist_refresh_log SET ${column} = ? WHERE discord_id = ?`, [value, discordId]);
    saveDatabase();
}
function getGuildConfig(guildId) {
    if (!db)
        return null;
    const result = db.exec(`SELECT channel_id, mode FROM guild_config WHERE guild_id = ?`, [guildId]);
    if (result.length > 0 && result[0].values.length > 0) {
        return {
            channelId: result[0].values[0][0],
            mode: result[0].values[0][1],
        };
    }
    return null;
}
function setGuildConfig(guildId, channelId, mode) {
    if (!db)
        return;
    db.run(`INSERT OR REPLACE INTO guild_config (guild_id, channel_id, mode) VALUES (?, ?, ?)`, [guildId, channelId, mode]);
    saveDatabase();
}
function getSetting(key) {
    if (!db)
        return null;
    const result = db.exec(`SELECT value FROM settings WHERE key = ?`, [key]);
    if (result.length > 0 && result[0].values.length > 0) {
        return result[0].values[0][0];
    }
    return null;
}
function setSetting(key, value) {
    if (!db)
        return;
    db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, value]);
    saveDatabase();
}
function getOrCreateWallet(userId, guildId) {
    if (!db)
        return { balance: 0, totalEarned: 0, totalSpent: 0 };
    const result = db.exec(`SELECT balance, total_earned, total_spent FROM wallets WHERE user_id = ? AND guild_id = ?`, [userId, guildId]);
    if (result.length > 0 && result[0].values.length > 0) {
        const row = result[0].values[0];
        return {
            balance: row[0],
            totalEarned: row[1],
            totalSpent: row[2],
        };
    }
    db.run(`INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, ?)`, [userId, guildId, config_1.default.currency.startingBalance]);
    saveDatabase();
    return { balance: config_1.default.currency.startingBalance, totalEarned: 0, totalSpent: 0 };
}
function getBalance(userId, guildId) {
    return getOrCreateWallet(userId, guildId).balance;
}
function addCurrency(userId, guildId, amount, reason, refId = null) {
    if (!db || amount <= 0)
        return;
    const wallet = getOrCreateWallet(userId, guildId);
    const newBalance = wallet.balance + amount;
    const newEarned = wallet.totalEarned + amount;
    db.run(`UPDATE wallets SET balance = ?, total_earned = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND guild_id = ?`, [newBalance, newEarned, userId, guildId]);
    db.run(`INSERT INTO wallet_transactions (user_id, guild_id, amount, reason, reference_id, balance_after) VALUES (?, ?, ?, ?, ?, ?)`, [userId, guildId, amount, reason, refId, newBalance]);
    saveDatabase();
}
function spendCurrency(userId, guildId, amount, reason, refId = null) {
    if (!db || amount <= 0)
        return false;
    const wallet = getOrCreateWallet(userId, guildId);
    if (wallet.balance < amount)
        return false;
    const newBalance = wallet.balance - amount;
    const newSpent = wallet.totalSpent + amount;
    db.run(`UPDATE wallets SET balance = ?, total_spent = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND guild_id = ?`, [newBalance, newSpent, userId, guildId]);
    db.run(`INSERT INTO wallet_transactions (user_id, guild_id, amount, reason, reference_id, balance_after) VALUES (?, ?, ?, ?, ?, ?)`, [userId, guildId, -amount, reason, refId, newBalance]);
    saveDatabase();
    return true;
}
function setBalance(userId, guildId, amount, reason) {
    if (!db || amount < 0)
        return;
    const wallet = getOrCreateWallet(userId, guildId);
    const diff = amount - wallet.balance;
    if (diff === 0)
        return;
    db.run(`UPDATE wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND guild_id = ?`, [amount, userId, guildId]);
    db.run(`INSERT INTO wallet_transactions (user_id, guild_id, amount, reason, balance_after) VALUES (?, ?, ?, ?, ?)`, [userId, guildId, diff, reason, amount]);
    saveDatabase();
}
function transferCurrency(senderId, receiverId, guildId, amount) {
    if (!db || amount <= 0 || senderId === receiverId)
        return false;
    const senderWallet = getOrCreateWallet(senderId, guildId);
    if (senderWallet.balance < amount)
        return false;
    const receiverWallet = getOrCreateWallet(receiverId, guildId);
    const newSenderBalance = senderWallet.balance - amount;
    const newSenderSpent = senderWallet.totalSpent + amount;
    const newReceiverBalance = receiverWallet.balance + amount;
    const newReceiverEarned = receiverWallet.totalEarned + amount;
    // Update sender
    db.run(`UPDATE wallets SET balance = ?, total_spent = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND guild_id = ?`, [newSenderBalance, newSenderSpent, senderId, guildId]);
    db.run(`INSERT INTO wallet_transactions (user_id, guild_id, amount, reason, balance_after) VALUES (?, ?, ?, ?, ?)`, [senderId, guildId, -amount, 'user_transfer', newSenderBalance]);
    // Update receiver
    db.run(`UPDATE wallets SET balance = ?, total_earned = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND guild_id = ?`, [newReceiverBalance, newReceiverEarned, receiverId, guildId]);
    db.run(`INSERT INTO wallet_transactions (user_id, guild_id, amount, reason, balance_after) VALUES (?, ?, ?, ?, ?)`, [receiverId, guildId, amount, 'user_transfer', newReceiverBalance]);
    saveDatabase();
    return true;
}
function getLeaderboard(guildId, limit) {
    if (!db)
        return [];
    const result = db.exec(`SELECT user_id, balance FROM wallets WHERE guild_id = ? ORDER BY balance DESC LIMIT ?`, [guildId, limit]);
    const leaderboard = [];
    if (result.length > 0 && result[0].values.length > 0) {
        for (const row of result[0].values) {
            leaderboard.push({
                userId: row[0],
                balance: row[1],
            });
        }
    }
    return leaderboard;
}
function getWalletTransactions(guildId, userId, limit = 50) {
    if (!db)
        return [];
    const result = userId
        ? db.exec(`SELECT id, user_id, amount, reason, reference_id, balance_after, created_at FROM wallet_transactions WHERE guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT ?`, [guildId, userId, limit])
        : db.exec(`SELECT id, user_id, amount, reason, reference_id, balance_after, created_at FROM wallet_transactions WHERE guild_id = ? ORDER BY id DESC LIMIT ?`, [guildId, limit]);
    const rows = [];
    if (result.length > 0 && result[0].values.length > 0) {
        for (const row of result[0].values) {
            rows.push({
                id: row[0],
                userId: row[1],
                amount: row[2],
                reason: row[3],
                referenceId: row[4] ?? null,
                balanceAfter: row[5],
                createdAt: row[6],
            });
        }
    }
    return rows;
}
function addAuditLog(actorUserId, action, targetType, targetId = null, metadata = {}) {
    if (!db)
        return;
    db.run(`INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata) VALUES (?, ?, ?, ?, ?)`, [actorUserId, action, targetType, targetId, JSON.stringify(metadata)]);
    saveDatabase();
}
function getAuditLogs(limit = 100) {
    if (!db)
        return [];
    const result = db.exec(`SELECT id, actor_user_id, action, target_type, target_id, metadata, created_at FROM audit_log ORDER BY id DESC LIMIT ?`, [limit]);
    const logs = [];
    if (result.length > 0 && result[0].values.length > 0) {
        for (const row of result[0].values) {
            logs.push({
                id: row[0],
                actorUserId: row[1],
                action: row[2],
                targetType: row[3],
                targetId: row[4] ?? null,
                metadata: row[5] ?? null,
                createdAt: row[6],
            });
        }
    }
    return logs;
}
function saveWebSession(sid, userId, username, guildMember, csrfToken, bracketPreview = null) {
    if (!db)
        return;
    db.run(`INSERT OR REPLACE INTO web_sessions (sid, user_id, username, guild_member, csrf_token, bracket_preview, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [sid, userId, username, guildMember ? 1 : 0, csrfToken, bracketPreview]);
    saveDatabase();
}
function getWebSession(sid) {
    if (!db)
        return null;
    const result = db.exec(`SELECT user_id, username, guild_member, csrf_token, bracket_preview FROM web_sessions WHERE sid = ?`, [sid]);
    if (result.length > 0 && result[0].values.length > 0) {
        const row = result[0].values[0];
        return {
            userId: row[0],
            username: row[1],
            guildMember: row[2] === 1,
            csrfToken: row[3],
            bracketPreview: row[4] ?? null,
        };
    }
    return null;
}
function deleteWebSession(sid) {
    if (!db)
        return;
    db.run(`DELETE FROM web_sessions WHERE sid = ?`, [sid]);
    saveDatabase();
}
// Tournament Functions
function createTournament(guildId, name) {
    if (!db)
        return null;
    db.run(`INSERT INTO tournaments (guild_id, name) VALUES (?, ?)`, [guildId, name]);
    const result = db.exec(`SELECT last_insert_rowid()`);
    const tournamentId = result[0].values[0][0];
    db.run(`INSERT INTO tournament_rounds (tournament_id, round_number, status) VALUES (?, 1, 'active')`, [tournamentId]);
    saveDatabase();
    return tournamentId;
}
function addTournamentMatch(tournamentId, matchNum, contestantA, contestantB, roundNumber = 1) {
    if (!db)
        return;
    db.run(`INSERT INTO tournament_matches (tournament_id, match_number, round_number, contestant_a, contestant_b) VALUES (?, ?, ?, ?, ?)`, [tournamentId, matchNum, roundNumber, contestantA, contestantB]);
    saveDatabase();
}
function getActiveTournament(guildId) {
    if (!db)
        return null;
    const result = db.exec(`SELECT id, name FROM tournaments WHERE guild_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`, [guildId]);
    if (result.length > 0 && result[0].values.length > 0) {
        return {
            id: result[0].values[0][0],
            name: result[0].values[0][1],
        };
    }
    return null;
}
function getTournamentMatches(tournamentId, roundNumber) {
    if (!db)
        return [];
    const query = roundNumber == null
        ? `SELECT id, match_number, round_number, contestant_a, contestant_b, winner, betting_open FROM tournament_matches WHERE tournament_id = ? ORDER BY round_number ASC, match_number ASC`
        : `SELECT id, match_number, round_number, contestant_a, contestant_b, winner, betting_open FROM tournament_matches WHERE tournament_id = ? AND round_number = ? ORDER BY match_number ASC`;
    const params = roundNumber == null ? [tournamentId] : [tournamentId, roundNumber];
    const result = db.exec(query, params);
    const matches = [];
    if (result.length > 0 && result[0].values.length > 0) {
        for (const row of result[0].values) {
            matches.push({
                id: row[0],
                matchNumber: row[1],
                roundNumber: row[2],
                contestantA: row[3],
                contestantB: row[4],
                winner: row[5],
                bettingOpen: row[6] === 1,
            });
        }
    }
    return matches;
}
function getMatch(matchId) {
    if (!db)
        return null;
    const result = db.exec(`SELECT tournament_id, match_number, round_number, contestant_a, contestant_b, winner, betting_open FROM tournament_matches WHERE id = ?`, [matchId]);
    if (result.length > 0 && result[0].values.length > 0) {
        const row = result[0].values[0];
        return {
            id: matchId,
            tournamentId: row[0],
            matchNumber: row[1],
            roundNumber: row[2],
            contestantA: row[3],
            contestantB: row[4],
            winner: row[5],
            bettingOpen: row[6] === 1,
        };
    }
    return null;
}
function getMatchByNumber(tournamentId, matchNumber) {
    if (!db)
        return null;
    const result = db.exec(`SELECT id, round_number, contestant_a, contestant_b, winner, betting_open FROM tournament_matches WHERE tournament_id = ? AND match_number = ? ORDER BY round_number DESC LIMIT 1`, [tournamentId, matchNumber]);
    if (result.length > 0 && result[0].values.length > 0) {
        const row = result[0].values[0];
        return {
            id: row[0],
            tournamentId: tournamentId,
            matchNumber: matchNumber,
            roundNumber: row[1],
            contestantA: row[2],
            contestantB: row[3],
            winner: row[4],
            bettingOpen: row[5] === 1,
        };
    }
    return null;
}
function getCurrentRoundNumber(tournamentId) {
    if (!db)
        return 1;
    const result = db.exec(`SELECT COALESCE(MAX(round_number), 1) FROM tournament_matches WHERE tournament_id = ?`, [tournamentId]);
    return result[0]?.values?.[0]?.[0] || 1;
}
function createNextRoundFromWinners(tournamentId) {
    if (!db)
        throw new Error('Database unavailable.');
    const currentRound = getCurrentRoundNumber(tournamentId);
    const currentMatches = getTournamentMatches(tournamentId, currentRound);
    if (currentMatches.length === 0) {
        throw new Error('No matches found in the current round.');
    }
    if (!currentMatches.every(match => !!match.winner)) {
        throw new Error('All matches in the current round must be resolved before advancing.');
    }
    if (currentMatches.length < 2) {
        throw new Error('No further round can be created from a single resolved match.');
    }
    const nextRound = currentRound + 1;
    const existingNext = getTournamentMatches(tournamentId, nextRound);
    if (existingNext.length > 0) {
        throw new Error('The next round has already been created.');
    }
    const winners = currentMatches.map(match => match.winner);
    if (winners.length % 2 !== 0) {
        throw new Error('Winner count must be even to advance the round.');
    }
    db.run(`INSERT OR REPLACE INTO tournament_rounds (tournament_id, round_number, status) VALUES (?, ?, 'completed')`, [tournamentId, currentRound]);
    db.run(`INSERT OR REPLACE INTO tournament_rounds (tournament_id, round_number, status) VALUES (?, ?, 'active')`, [tournamentId, nextRound]);
    let nextMatchNumber = 1;
    for (let i = 0; i < winners.length; i += 2) {
        addTournamentMatch(tournamentId, nextMatchNumber, winners[i], winners[i + 1], nextRound);
        nextMatchNumber++;
    }
    saveDatabase();
    return { roundNumber: nextRound, matchCount: winners.length / 2 };
}
function closeBettingForMatch(matchId) {
    if (!db)
        return;
    db.run(`UPDATE tournament_matches SET betting_open = 0 WHERE id = ?`, [matchId]);
    saveDatabase();
}
function placeBet(tournamentId, matchId, userId, guildId, picked, amount) {
    if (!db)
        return false;
    // Must have balance
    if (!spendCurrency(userId, guildId, amount, 'bet_place', matchId.toString())) {
        return false;
    }
    try {
        db.run(`INSERT INTO bets (tournament_id, match_id, user_id, guild_id, picked, amount) VALUES (?, ?, ?, ?, ?, ?)`, [tournamentId, matchId, userId, guildId, picked, amount]);
        saveDatabase();
        return true;
    }
    catch (e) {
        // Reverse spend if bet insert fails (e.g. duplicate bet)
        addCurrency(userId, guildId, amount, 'bet_refund', matchId.toString());
        return false;
    }
}
function getBetsForMatch(tournamentId, matchId) {
    if (!db)
        return [];
    const result = db.exec(`SELECT user_id, picked, amount FROM bets WHERE tournament_id = ? AND match_id = ?`, [tournamentId, matchId]);
    const bets = [];
    if (result.length > 0 && result[0].values.length > 0) {
        for (const row of result[0].values) {
            bets.push({
                userId: row[0],
                picked: row[1],
                amount: row[2],
            });
        }
    }
    return bets;
}
function getUserBets(tournamentId, userId) {
    if (!db)
        return [];
    const result = db.exec(`
        SELECT b.match_id, b.picked, b.amount, b.status, b.payout, m.match_number, m.contestant_a, m.contestant_b, m.winner
        FROM bets b
        JOIN tournament_matches m ON b.match_id = m.id
        WHERE b.tournament_id = ? AND b.user_id = ?
        ORDER BY m.match_number ASC
    `, [tournamentId, userId]);
    const bets = [];
    if (result.length > 0 && result[0].values.length > 0) {
        for (const row of result[0].values) {
            bets.push({
                matchId: row[0],
                picked: row[1],
                amount: row[2],
                status: row[3],
                payout: row[4],
                matchNumber: row[5],
                contestantA: row[6],
                contestantB: row[7],
                winner: row[8],
            });
        }
    }
    return bets;
}
function resolveMatch(tournamentId, matchId, winner) {
    if (!db)
        return null;
    closeBettingForMatch(matchId);
    db.run(`UPDATE tournament_matches SET winner = ? WHERE id = ?`, [winner, matchId]);
    const bets = getBetsForMatch(tournamentId, matchId);
    let totalPool = 0;
    let winnerPool = 0;
    for (const bet of bets) {
        totalPool += bet.amount;
        if (bet.picked === winner) {
            winnerPool += bet.amount;
        }
    }
    const payouts = [];
    // Fetch guild_id from tournament
    let guildId = '';
    const tournamentResult = db.exec(`SELECT guild_id FROM tournaments WHERE id = ?`, [tournamentId]);
    if (tournamentResult.length > 0 && tournamentResult[0].values.length > 0) {
        guildId = tournamentResult[0].values[0][0];
    }
    // Process winners
    for (const bet of bets) {
        if (bet.picked === winner) {
            let payout = 0;
            if (winnerPool > 0) {
                // Parimutuel calculation
                const proportion = bet.amount / winnerPool;
                payout = Math.floor(proportion * totalPool);
            }
            db.run(`UPDATE bets SET status = 'won', payout = ? WHERE tournament_id = ? AND match_id = ? AND user_id = ?`, [payout, tournamentId, matchId, bet.userId]);
            if (guildId) {
                addCurrency(bet.userId, guildId, payout, 'bet_win', matchId.toString());
            }
            payouts.push({ userId: bet.userId, betAmount: bet.amount, payout });
        }
        else {
            db.run(`UPDATE bets SET status = 'lost' WHERE tournament_id = ? AND match_id = ? AND user_id = ?`, [tournamentId, matchId, bet.userId]);
        }
    }
    saveDatabase();
    return {
        totalPool,
        winnerPool,
        payouts
    };
}
function endTournament(tournamentId) {
    if (!db)
        return;
    db.run(`UPDATE tournaments SET status = 'completed' WHERE id = ?`, [tournamentId]);
    // Refund pending bets
    const result = db.exec(`SELECT match_id, user_id, guild_id, amount FROM bets WHERE tournament_id = ? AND status = 'pending'`, [tournamentId]);
    if (result.length > 0 && result[0].values.length > 0) {
        for (const row of result[0].values) {
            const matchId = row[0];
            const userId = row[1];
            const guildId = row[2];
            const amount = row[3];
            addCurrency(userId, guildId, amount, 'bet_refund_ended', matchId.toString());
            db.run(`UPDATE bets SET status = 'refunded' WHERE tournament_id = ? AND match_id = ? AND user_id = ?`, [tournamentId, matchId, userId]);
        }
    }
    saveDatabase();
}
function closeDatabase() {
    if (db) {
        saveDatabase();
        db.close();
        db = null;
    }
}
//# sourceMappingURL=db.js.map