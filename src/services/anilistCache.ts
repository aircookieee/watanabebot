// Persistent Anilist media cache for !al command
import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(__dirname, '../../data/anilistCache.json');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

type MediaType = 'ANIME' | 'MANGA';

interface CachedMedia {
    mediaType: MediaType;
    query: string;
    data: any;
    timestamp: number;
}

let cache: CachedMedia[] = [];

function loadCache() {
    if (fs.existsSync(CACHE_FILE)) {
        try {
            cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        } catch {
            cache = [];
        }
    }
}

function saveCache() {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

export function getCachedMedia(query: string, mediaType: MediaType): any | null {
    loadCache();
    const now = Date.now();
    const entry = cache.find(
        (c) =>
            c.query.toLowerCase() === query.toLowerCase() &&
            c.mediaType === mediaType &&
            now - c.timestamp < CACHE_TTL
    );
    return entry ? entry.data : null;
}

export function setCachedMedia(query: string, mediaType: MediaType, data: any) {
    loadCache();
    const now = Date.now();
    // Remove expired entries and old entry for this query
    cache = cache.filter(
        (c) => now - c.timestamp < CACHE_TTL &&
            !(c.query.toLowerCase() === query.toLowerCase() && c.mediaType === mediaType)
    );
    cache.push({ query, mediaType, data, timestamp: now });
    saveCache();
}