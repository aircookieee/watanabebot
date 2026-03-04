"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedMedia = getCachedMedia;
exports.setCachedMedia = setCachedMedia;
// Persistent Anilist media cache for !al command
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const CACHE_FILE = path_1.default.join(__dirname, '../../data/anilistCache.json');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
let cache = [];
function loadCache() {
    if (fs_1.default.existsSync(CACHE_FILE)) {
        try {
            cache = JSON.parse(fs_1.default.readFileSync(CACHE_FILE, 'utf-8'));
        }
        catch {
            cache = [];
        }
    }
}
function saveCache() {
    fs_1.default.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}
function getCachedMedia(query, mediaType) {
    loadCache();
    const now = Date.now();
    const entry = cache.find((c) => c.query.toLowerCase() === query.toLowerCase() &&
        c.mediaType === mediaType &&
        now - c.timestamp < CACHE_TTL);
    return entry ? entry.data : null;
}
function setCachedMedia(query, mediaType, data) {
    loadCache();
    const now = Date.now();
    // Remove old entry if exists
    cache = cache.filter((c) => !(c.query.toLowerCase() === query.toLowerCase() && c.mediaType === mediaType));
    cache.push({ query, mediaType, data, timestamp: now });
    saveCache();
}
//# sourceMappingURL=anilistCache.js.map