import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import config from '../config/config';

let db: SqlJsDatabase | null = null;
let dbPath: string = '';

export async function initDatabase(): Promise<void> {
    const wasmPath = path.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm');
    
    let SQL;
    if (fs.existsSync(wasmPath)) {
        const wasmBinary = fs.readFileSync(wasmPath);
        SQL = await initSqlJs({ wasmBinary: wasmBinary as any });
    } else {
        SQL = await initSqlJs();
    }

    dbPath = config.paths.databasePath;
    const dataDir = config.paths.dataDir;

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    initializeTables();
    migrateLegacyData();
    saveDatabase();
}

function saveDatabase(): void {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
}

function initializeTables(): void {
    if (!db) return;

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
        CREATE TABLE IF NOT EXISTS tournaments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS tournament_matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tournament_id INTEGER NOT NULL,
            match_number INTEGER NOT NULL,
            contestant_a TEXT NOT NULL,
            contestant_b TEXT NOT NULL,
            winner TEXT,
            betting_open INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
        )
    `);

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

function migrateLegacyData(): void {
    if (!db) return;

    const legacyMapPath = path.join(__dirname, '../../discordAniListMap.json');
    console.log('Checking for legacy data at:', legacyMapPath);
    
    if (fs.existsSync(legacyMapPath)) {
        try {
            const legacyMap = JSON.parse(fs.readFileSync(legacyMapPath, 'utf-8'));
            console.log('Found legacy mappings:', JSON.stringify(legacyMap));

            const stmt = db.prepare(`
                INSERT OR IGNORE INTO discord_anilist_map (discord_id, anilist_username)
                VALUES (?, ?)
            `);

            for (const [discordId, anilistUsername] of Object.entries(legacyMap)) {
                stmt.run([discordId, anilistUsername] as any);
            }
            stmt.free();

            saveDatabase();
            console.log('Migrated legacy Anilist mapping data');
        } catch (err) {
            console.error('Failed to migrate legacy data:', err);
        }
    } else {
        console.log('No legacy mapping file found');
    }
}

export function registerAnilistUser(discordId: string, anilistUsername: string): boolean {
    if (!db) return false;

    const existingUser = db.exec(`SELECT discord_id FROM discord_anilist_map WHERE anilist_username = ?`, [anilistUsername]);
    if (existingUser.length > 0 && existingUser[0].values.length > 0) {
        const existingDiscordId = existingUser[0].values[0][0] as string;
        if (existingDiscordId !== discordId) {
            return false;
        }
    }
    
    const existing = db.exec(`SELECT discord_id FROM discord_anilist_map WHERE discord_id = ?`, [discordId]);
    
    if (existing.length > 0 && existing[0].values.length > 0) {
        db.run(`UPDATE discord_anilist_map SET anilist_username = ?, updated_at = CURRENT_TIMESTAMP WHERE discord_id = ?`, 
            [anilistUsername, discordId] as any);
    } else {
        db.run(`INSERT INTO discord_anilist_map (discord_id, anilist_username) VALUES (?, ?)`,
            [discordId, anilistUsername] as any);
    }
    saveDatabase();
    return true;
}

export function unregisterAnilistUser(discordId: string): boolean {
    if (!db) return false;

    const before = db.exec(`SELECT COUNT(*) FROM discord_anilist_map WHERE discord_id = ?`, [discordId]);
    const countBefore = before[0]?.values[0]?.[0] as number || 0;

    if (countBefore === 0) return false;

    db.run(`DELETE FROM discord_anilist_map WHERE discord_id = ?`, [discordId]);
    saveDatabase();
    return true;
}

export function getAnilistUsername(discordId: string): string | null {
    if (!db) return null;

    const result = db.exec(`SELECT anilist_username FROM discord_anilist_map WHERE discord_id = ?`, [discordId]);
    if (result.length > 0 && result[0].values.length > 0) {
        return result[0].values[0][0] as string;
    }
    return null;
}

export function getAllAnilistMappings(): Record<string, string> {
    if (!db) return {};

    const result = db.exec(`SELECT discord_id, anilist_username FROM discord_anilist_map`);
    const mappings: Record<string, string> = {};

    if (result.length > 0) {
        for (const row of result[0].values) {
            mappings[row[0] as string] = row[1] as string;
        }
    }
    return mappings;
}

export function getAnilistUserCount(): number {
    if (!db) return 0;

    const result = db.exec(`SELECT COUNT(*) FROM discord_anilist_map`);
    if (result.length > 0 && result[0].values.length > 0) {
        return result[0].values[0][0] as number;
    }
    return 0;
}

export function saveUserMediaBatch(discordId: string, entries: { mediaId: number; mediaType: string; entryData: string }[]): void {
    if (!db) return;

    if (entries.length === 0) {
        saveDatabase();
        return;
    }

    const mediaType = entries[0].mediaType;
    db.run(`DELETE FROM user_media_lists WHERE discord_id = ? AND media_type = ?`, [discordId, mediaType] as any);

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO user_media_lists (discord_id, media_id, media_type, entry_data, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    for (const entry of entries) {
        stmt.run([discordId, entry.mediaId, entry.mediaType, entry.entryData] as any);
    }
    stmt.free();
    saveDatabase();
}

export function clearUserMediaList(discordId: string, mediaType?: string): void {
    if (!db) return;

    if (mediaType) {
        db.run(`DELETE FROM user_media_lists WHERE discord_id = ? AND media_type = ?`, [discordId, mediaType] as any);
    } else {
        db.run(`DELETE FROM user_media_lists WHERE discord_id = ?`, [discordId] as any);
    }
    saveDatabase();
}

export function getUserMediaList(discordId: string, mediaType?: string): { mediaId: number; mediaType: string; entryData: string }[] {
    if (!db) return [];

    let query = `SELECT media_id, media_type, entry_data FROM user_media_lists WHERE discord_id = ?`;
    const params: any[] = [discordId];

    if (mediaType) {
        query += ` AND media_type = ?`;
        params.push(mediaType);
    }

    const result = db.exec(query, params);
    const entries: { mediaId: number; mediaType: string; entryData: string }[] = [];

    if (result.length > 0 && result[0].values.length > 0) {
        for (const row of result[0].values) {
            entries.push({
                mediaId: row[0] as number,
                mediaType: row[1] as string,
                entryData: row[2] as string,
            });
        }
    }
    return entries;
}

export function getUserMediaById(discordId: string, mediaId: number): string | null {
    if (!db) return null;

    const result = db.exec(`SELECT entry_data FROM user_media_lists WHERE discord_id = ? AND media_id = ?`, [discordId, mediaId]);
    if (result.length > 0 && result[0].values.length > 0) {
        return result[0].values[0][0] as string;
    }
    return null;
}

export function saveUserFavorites(discordId: string, mediaIds: number[]): void {
    if (!db || mediaIds.length === 0) return;

    db.run(`DELETE FROM user_favorites WHERE discord_id = ?`, [discordId] as any);

    const stmt = db.prepare(`
        INSERT INTO user_favorites (discord_id, media_id, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
    `);

    for (const mediaId of mediaIds) {
        stmt.run([discordId, mediaId] as any);
    }
    stmt.free();
    saveDatabase();
}

export function getUserFavorites(discordId: string): number[] {
    if (!db) return [];

    const result = db.exec(`SELECT media_id FROM user_favorites WHERE discord_id = ?`, [discordId]);
    const ids: number[] = [];

    if (result.length > 0 && result[0].values.length > 0) {
        for (const row of result[0].values) {
            ids.push(row[0] as number);
        }
    }
    return ids;
}

export function getLastRefreshTime(discordId: string): { lists?: string; favorites?: string } | null {
    if (!db) return null;

    const result = db.exec(`SELECT last_lists_refresh, last_favorites_refresh FROM anilist_refresh_log WHERE discord_id = ?`, [discordId]);
    if (result.length > 0 && result[0].values.length > 0) {
        const row = result[0].values[0];
        return {
            lists: row[0] as string | undefined,
            favorites: row[1] as string | undefined,
        };
    }
    return null;
}

export function updateRefreshLog(discordId: string, refreshType: 'lists' | 'favorites'): void {
    if (!db) return;

    const value = new Date().toISOString();

    // Ensure a row exists
    db.run(`INSERT OR IGNORE INTO anilist_refresh_log (discord_id) VALUES (?)`, [discordId] as any);

    const column = refreshType === 'lists' ? 'last_lists_refresh' : 'last_favorites_refresh';
    db.run(`UPDATE anilist_refresh_log SET ${column} = ? WHERE discord_id = ?`, [value, discordId] as any);
    saveDatabase();
}

export function getGuildConfig(guildId: string): { channelId: string; mode: string } | null {
    if (!db) return null;

    const result = db.exec(`SELECT channel_id, mode FROM guild_config WHERE guild_id = ?`, [guildId]);
    if (result.length > 0 && result[0].values.length > 0) {
        return {
            channelId: result[0].values[0][0] as string,
            mode: result[0].values[0][1] as string,
        };
    }
    return null;
}

export function setGuildConfig(guildId: string, channelId: string, mode: string): void {
    if (!db) return;

    db.run(`INSERT OR REPLACE INTO guild_config (guild_id, channel_id, mode) VALUES (?, ?, ?)`,
        [guildId, channelId, mode]);
    saveDatabase();
}

export function getSetting(key: string): string | null {
    if (!db) return null;

    const result = db.exec(`SELECT value FROM settings WHERE key = ?`, [key]);
    if (result.length > 0 && result[0].values.length > 0) {
        return result[0].values[0][0] as string;
    }
    return null;
}

export function setSetting(key: string, value: string): void {
    if (!db) return;

    db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, value]);
    saveDatabase();
}

export function getOrCreateWallet(userId: string, guildId: string): { balance: number; totalEarned: number; totalSpent: number } {
    if (!db) return { balance: 0, totalEarned: 0, totalSpent: 0 };

    const result = db.exec(`SELECT balance, total_earned, total_spent FROM wallets WHERE user_id = ? AND guild_id = ?`, [userId, guildId]);
    if (result.length > 0 && result[0].values.length > 0) {
        const row = result[0].values[0];
        return {
            balance: row[0] as number,
            totalEarned: row[1] as number,
            totalSpent: row[2] as number,
        };
    }

    db.run(`INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, ?)`, [userId, guildId, config.currency.startingBalance]);
    saveDatabase();
    return { balance: config.currency.startingBalance, totalEarned: 0, totalSpent: 0 };
}

export function getBalance(userId: string, guildId: string): number {
    return getOrCreateWallet(userId, guildId).balance;
}

export function addCurrency(userId: string, guildId: string, amount: number, reason: string, refId: string | null = null): void {
    if (!db || amount <= 0) return;

    const wallet = getOrCreateWallet(userId, guildId);
    const newBalance = wallet.balance + amount;
    const newEarned = wallet.totalEarned + amount;

    db.run(`UPDATE wallets SET balance = ?, total_earned = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND guild_id = ?`, [newBalance, newEarned, userId, guildId]);
    db.run(`INSERT INTO wallet_transactions (user_id, guild_id, amount, reason, reference_id, balance_after) VALUES (?, ?, ?, ?, ?, ?)`, [userId, guildId, amount, reason, refId, newBalance]);
    saveDatabase();
}

export function spendCurrency(userId: string, guildId: string, amount: number, reason: string, refId: string | null = null): boolean {
    if (!db || amount <= 0) return false;

    const wallet = getOrCreateWallet(userId, guildId);
    if (wallet.balance < amount) return false;

    const newBalance = wallet.balance - amount;
    const newSpent = wallet.totalSpent + amount;

    db.run(`UPDATE wallets SET balance = ?, total_spent = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND guild_id = ?`, [newBalance, newSpent, userId, guildId]);
    db.run(`INSERT INTO wallet_transactions (user_id, guild_id, amount, reason, reference_id, balance_after) VALUES (?, ?, ?, ?, ?, ?)`, [userId, guildId, -amount, reason, refId, newBalance]);
    saveDatabase();
    return true;
}

export function setBalance(userId: string, guildId: string, amount: number, reason: string): void {
    if (!db || amount < 0) return;

    const wallet = getOrCreateWallet(userId, guildId);
    const diff = amount - wallet.balance;
    if (diff === 0) return;

    db.run(`UPDATE wallets SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND guild_id = ?`, [amount, userId, guildId]);
    db.run(`INSERT INTO wallet_transactions (user_id, guild_id, amount, reason, balance_after) VALUES (?, ?, ?, ?, ?)`, [userId, guildId, diff, reason, amount]);
    saveDatabase();
}

export function transferCurrency(senderId: string, receiverId: string, guildId: string, amount: number): boolean {
    if (!db || amount <= 0 || senderId === receiverId) return false;

    const senderWallet = getOrCreateWallet(senderId, guildId);
    if (senderWallet.balance < amount) return false;

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

export function getLeaderboard(guildId: string, limit: number): { userId: string; balance: number }[] {
    if (!db) return [];

    const result = db.exec(`SELECT user_id, balance FROM wallets WHERE guild_id = ? ORDER BY balance DESC LIMIT ?`, [guildId, limit]);
    const leaderboard: { userId: string; balance: number }[] = [];

    if (result.length > 0 && result[0].values.length > 0) {
        for (const row of result[0].values) {
            leaderboard.push({
                userId: row[0] as string,
                balance: row[1] as number,
            });
        }
    }
    return leaderboard;
}

// Tournament Functions

export function createTournament(guildId: string, name: string): number | null {
    if (!db) return null;

    db.run(`INSERT INTO tournaments (guild_id, name) VALUES (?, ?)`, [guildId, name]);
    const result = db.exec(`SELECT last_insert_rowid()`);
    saveDatabase();
    return result[0].values[0][0] as number;
}

export function addTournamentMatch(tournamentId: number, matchNum: number, contestantA: string, contestantB: string): void {
    if (!db) return;

    db.run(`INSERT INTO tournament_matches (tournament_id, match_number, contestant_a, contestant_b) VALUES (?, ?, ?, ?)`, [tournamentId, matchNum, contestantA, contestantB]);
    saveDatabase();
}

export function getActiveTournament(guildId: string): { id: number; name: string } | null {
    if (!db) return null;

    const result = db.exec(`SELECT id, name FROM tournaments WHERE guild_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`, [guildId]);
    if (result.length > 0 && result[0].values.length > 0) {
        return {
            id: result[0].values[0][0] as number,
            name: result[0].values[0][1] as string,
        };
    }
    return null;
}

export function getTournamentMatches(tournamentId: number): any[] {
    if (!db) return [];

    const result = db.exec(`SELECT id, match_number, contestant_a, contestant_b, winner, betting_open FROM tournament_matches WHERE tournament_id = ? ORDER BY match_number ASC`, [tournamentId]);
    const matches: any[] = [];

    if (result.length > 0 && result[0].values.length > 0) {
        for (const row of result[0].values) {
            matches.push({
                id: row[0] as number,
                matchNumber: row[1] as number,
                contestantA: row[2] as string,
                contestantB: row[3] as string,
                winner: row[4] as string | null,
                bettingOpen: (row[5] as number) === 1,
            });
        }
    }
    return matches;
}

export function getMatch(matchId: number): any | null {
    if (!db) return null;

    const result = db.exec(`SELECT tournament_id, match_number, contestant_a, contestant_b, winner, betting_open FROM tournament_matches WHERE id = ?`, [matchId]);
    if (result.length > 0 && result[0].values.length > 0) {
        const row = result[0].values[0];
        return {
            id: matchId,
            tournamentId: row[0] as number,
            matchNumber: row[1] as number,
            contestantA: row[2] as string,
            contestantB: row[3] as string,
            winner: row[4] as string | null,
            bettingOpen: (row[5] as number) === 1,
        };
    }
    return null;
}

export function getMatchByNumber(tournamentId: number, matchNumber: number): any | null {
    if (!db) return null;

    const result = db.exec(`SELECT id, contestant_a, contestant_b, winner, betting_open FROM tournament_matches WHERE tournament_id = ? AND match_number = ?`, [tournamentId, matchNumber]);
    if (result.length > 0 && result[0].values.length > 0) {
        const row = result[0].values[0];
        return {
            id: row[0] as number,
            tournamentId: tournamentId,
            matchNumber: matchNumber,
            contestantA: row[1] as string,
            contestantB: row[2] as string,
            winner: row[3] as string | null,
            bettingOpen: (row[4] as number) === 1,
        };
    }
    return null;
}

export function closeBettingForMatch(matchId: number): void {
    if (!db) return;
    db.run(`UPDATE tournament_matches SET betting_open = 0 WHERE id = ?`, [matchId]);
    saveDatabase();
}

export function placeBet(tournamentId: number, matchId: number, userId: string, guildId: string, picked: string, amount: number): boolean {
    if (!db) return false;

    // Must have balance
    if (!spendCurrency(userId, guildId, amount, 'bet_place', matchId.toString())) {
        return false;
    }

    try {
        db.run(`INSERT INTO bets (tournament_id, match_id, user_id, guild_id, picked, amount) VALUES (?, ?, ?, ?, ?, ?)`, [tournamentId, matchId, userId, guildId, picked, amount]);
        saveDatabase();
        return true;
    } catch (e) {
        // Reverse spend if bet insert fails (e.g. duplicate bet)
        addCurrency(userId, guildId, amount, 'bet_refund', matchId.toString());
        return false;
    }
}

export function getBetsForMatch(tournamentId: number, matchId: number): any[] {
    if (!db) return [];

    const result = db.exec(`SELECT user_id, picked, amount FROM bets WHERE tournament_id = ? AND match_id = ?`, [tournamentId, matchId]);
    const bets: any[] = [];

    if (result.length > 0 && result[0].values.length > 0) {
        for (const row of result[0].values) {
            bets.push({
                userId: row[0] as string,
                picked: row[1] as string,
                amount: row[2] as number,
            });
        }
    }
    return bets;
}

export function getUserBets(tournamentId: number, userId: string): any[] {
    if (!db) return [];

    const result = db.exec(`
        SELECT b.match_id, b.picked, b.amount, b.status, b.payout, m.match_number, m.contestant_a, m.contestant_b, m.winner
        FROM bets b
        JOIN tournament_matches m ON b.match_id = m.id
        WHERE b.tournament_id = ? AND b.user_id = ?
        ORDER BY m.match_number ASC
    `, [tournamentId, userId]);
    const bets: any[] = [];

    if (result.length > 0 && result[0].values.length > 0) {
        for (const row of result[0].values) {
            bets.push({
                matchId: row[0] as number,
                picked: row[1] as string,
                amount: row[2] as number,
                status: row[3] as string,
                payout: row[4] as number,
                matchNumber: row[5] as number,
                contestantA: row[6] as string,
                contestantB: row[7] as string,
                winner: row[8] as string | null,
            });
        }
    }
    return bets;
}

export function resolveMatch(tournamentId: number, matchId: number, winner: string): any {
    if (!db) return null;

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

    const payouts: any[] = [];
    
    // Fetch guild_id from tournament
    let guildId = '';
    const tournamentResult = db.exec(`SELECT guild_id FROM tournaments WHERE id = ?`, [tournamentId]);
    if(tournamentResult.length > 0 && tournamentResult[0].values.length > 0) {
        guildId = tournamentResult[0].values[0][0] as string;
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
        } else {
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

export function endTournament(tournamentId: number): void {
    if (!db) return;

    db.run(`UPDATE tournaments SET status = 'completed' WHERE id = ?`, [tournamentId]);
    
    // Refund pending bets
    const result = db.exec(`SELECT match_id, user_id, guild_id, amount FROM bets WHERE tournament_id = ? AND status = 'pending'`, [tournamentId]);
    if (result.length > 0 && result[0].values.length > 0) {
        for (const row of result[0].values) {
            const matchId = row[0] as number;
            const userId = row[1] as string;
            const guildId = row[2] as string;
            const amount = row[3] as number;
            
            addCurrency(userId, guildId, amount, 'bet_refund_ended', matchId.toString());
            db.run(`UPDATE bets SET status = 'refunded' WHERE tournament_id = ? AND match_id = ? AND user_id = ?`, [tournamentId, matchId, userId]);
        }
    }

    saveDatabase();
}

export function closeDatabase(): void {
    if (db) {
        saveDatabase();
        db.close();
        db = null;
    }
}
