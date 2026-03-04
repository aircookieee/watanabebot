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
function migrateLegacyData() {
    if (!db)
        return;
    const legacyMapPath = path_1.default.join(__dirname, '../../discordAnilistMap.json');
    if (fs_1.default.existsSync(legacyMapPath)) {
        try {
            const legacyMap = JSON.parse(fs_1.default.readFileSync(legacyMapPath, 'utf-8'));
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
}
function registerAnilistUser(discordId, anilistUsername) {
    if (!db)
        return false;
    const existingUser = db.exec(`SELECT discord_id FROM discord_anilist_map WHERE anilist_username = '${anilistUsername}'`);
    if (existingUser.length > 0 && existingUser[0].values.length > 0) {
        const existingDiscordId = existingUser[0].values[0][0];
        if (existingDiscordId !== discordId) {
            return false;
        }
    }
    const existing = db.exec(`SELECT discord_id FROM discord_anilist_map WHERE discord_id = '${discordId}'`);
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
    const before = db.exec(`SELECT COUNT(*) FROM discord_anilist_map WHERE discord_id = '${discordId}'`);
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
    const result = db.exec(`SELECT anilist_username FROM discord_anilist_map WHERE discord_id = '${discordId}'`);
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
    const column = refreshType === 'lists' ? 'last_lists_refresh' : 'last_favorites_refresh';
    const value = new Date().toISOString();
    const existing = db.exec(`SELECT discord_id FROM anilist_refresh_log WHERE discord_id = ?`, [discordId]);
    if (existing.length > 0 && existing[0].values.length > 0) {
        db.run(`UPDATE anilist_refresh_log SET ${column} = ? WHERE discord_id = ?`, [value, discordId]);
    }
    else {
        if (refreshType === 'lists') {
            db.run(`INSERT INTO anilist_refresh_log (discord_id, last_lists_refresh) VALUES (?, ?)`, [discordId, value]);
        }
        else {
            db.run(`INSERT INTO anilist_refresh_log (discord_id, last_favorites_refresh) VALUES (?, ?)`, [discordId, value]);
        }
    }
    saveDatabase();
}
function getGuildConfig(guildId) {
    if (!db)
        return null;
    const result = db.exec(`SELECT channel_id, mode FROM guild_config WHERE guild_id = '${guildId}'`);
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
    const existing = db.exec(`SELECT guild_id FROM guild_config WHERE guild_id = '${guildId}'`);
    if (existing.length > 0 && existing[0].values.length > 0) {
        db.run(`UPDATE guild_config SET channel_id = ?, mode = ? WHERE guild_id = ?`, [channelId, mode, guildId]);
    }
    else {
        db.run(`INSERT INTO guild_config (guild_id, channel_id, mode) VALUES (?, ?, ?)`, [guildId, channelId, mode]);
    }
    saveDatabase();
}
function getSetting(key) {
    if (!db)
        return null;
    const result = db.exec(`SELECT value FROM settings WHERE key = '${key}'`);
    if (result.length > 0 && result[0].values.length > 0) {
        return result[0].values[0][0];
    }
    return null;
}
function setSetting(key, value) {
    if (!db)
        return;
    const existing = db.exec(`SELECT key FROM settings WHERE key = '${key}'`);
    if (existing.length > 0 && existing[0].values.length > 0) {
        db.run(`UPDATE settings SET value = ? WHERE key = ?`, [value, key]);
    }
    else {
        db.run(`INSERT INTO settings (key, value) VALUES (?, ?)`, [key, value]);
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