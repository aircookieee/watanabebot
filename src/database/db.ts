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

export function closeDatabase(): void {
    if (db) {
        saveDatabase();
        db.close();
        db = null;
    }
}
