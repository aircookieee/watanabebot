"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUpdateInProgress = void 0;
exports.setUpdateInProgress = setUpdateInProgress;
exports.searchMedia = searchMedia;
exports.registerUser = registerUser;
exports.unregisterUser = unregisterUser;
exports.getUserLists = getUserLists;
exports.getUserFavorites = getUserFavorites;
exports.getAnimeInfoWithScores = getAnimeInfoWithScores;
exports.updateAllUserData = updateAllUserData;
const db_1 = require("../database/db");
const anilistCache_1 = require("./anilistCache");
const API_URL = 'https://graphql.anilist.co';
const REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000;
const TARGET_REQUESTS_PER_MINUTE = 25;
const BASE_DELAY_MS = Math.ceil(60000 / TARGET_REQUESTS_PER_MINUTE);
exports.isUpdateInProgress = false;
function setUpdateInProgress(value) {
    exports.isUpdateInProgress = value;
}
function calculateRateLimitDelay() {
    const userCount = (0, db_1.getAnilistUserCount)();
    const delayPerUser = 100;
    const calculatedDelay = BASE_DELAY_MS + (userCount * delayPerUser);
    return Math.min(calculatedDelay, 10000);
}
class RateLimiter {
    queue = [];
    processing = false;
    lastRequestTime = 0;
    async add(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await fn();
                    resolve(result);
                }
                catch (err) {
                    reject(err);
                }
            });
            this.processQueue();
        });
    }
    async processQueue() {
        if (this.processing || this.queue.length === 0)
            return;
        this.processing = true;
        const rateLimitDelay = calculateRateLimitDelay();
        while (this.queue.length > 0) {
            const now = Date.now();
            const timeSinceLastRequest = this.lastRequestTime === 0 ? rateLimitDelay : now - this.lastRequestTime;
            if (this.lastRequestTime !== 0 && timeSinceLastRequest < rateLimitDelay) {
                await this.sleep(rateLimitDelay - timeSinceLastRequest);
            }
            const fn = this.queue.shift();
            if (fn) {
                this.lastRequestTime = Date.now();
                await fn();
            }
        }
        this.processing = false;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
const rateLimiter = new RateLimiter();
async function dumpAnilistFailure(response, context, prefix, body) {
    try {
        const dumpDir = './data/anilist_failures';
        const fs = await Promise.resolve().then(() => __importStar(require('fs')));
        if (!fs.existsSync(dumpDir))
            fs.mkdirSync(dumpDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${dumpDir}/${prefix}_${timestamp}_${Math.floor(Math.random() * 100000)}.json`;
        const headersObj = {};
        response.headers.forEach((value, key) => { headersObj[key] = value; });
        let bodyContent = body;
        if (bodyContent === undefined) {
            try {
                bodyContent = await response.text();
            }
            catch (e) {
                bodyContent = `Failed to read body: ${e}`;
            }
        }
        const dump = {
            status: response.status,
            statusText: response.statusText,
            headers: headersObj,
            url: response.url,
            request: context,
            body: bodyContent,
        };
        fs.writeFileSync(fileName, JSON.stringify(dump, null, 2), 'utf8');
    }
    catch (err) {
        console.error(`Failed to dump Anilist response (${prefix}):`, err);
    }
}
function toSaveableEntry(entry, mediaType) {
    const minimal = {
        mediaId: entry.media.id,
        mediaType,
        status: entry.status,
        score: entry.score,
        progress: entry.progress,
        repeat: entry.repeat,
    };
    return { mediaId: entry.media.id, mediaType, entryData: JSON.stringify(minimal) };
}
async function fetchAnilistLists(username, mediaType) {
    const query = `
        query ($username: String, $type: MediaType) {
            MediaListCollection(userName: $username, type: $type) {
                lists {
                    name
                    isCustomList
                    isSplitCompletedList
                    entries {
                        media {
                            id
                            type
                            title {
                                romaji
                                english
                                native
                            }
                            status
                            description(asHtml: false)
                            coverImage {
                                large
                                extraLarge
                            }
                        }
                        status
                        score(format: POINT_100)
                        progress
                        repeat
                    }
                }
            }
        }
    `;
    const response = await rateLimiter.add(() => fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables: { username, type: mediaType } }),
    }));
    if (!response.ok) {
        await dumpAnilistFailure(response, { username, mediaType, query }, 'fail');
        throw new Error(`Anilist API error: ${response.status}`);
    }
    const json = await response.json();
    if (json.errors) {
        await dumpAnilistFailure(response, { username, mediaType, query }, 'graphql_fail', json);
        throw new Error(`GraphQL error: ${json.errors[0].message}`);
    }
    const lists = json.data.MediaListCollection.lists;
    const allEntries = [];
    for (const list of lists) {
        for (const entry of list.entries) {
            allEntries.push({
                media: {
                    id: entry.media.id,
                    type: entry.media.type,
                    title: entry.media.title,
                    description: entry.media.description,
                    status: entry.media.status,
                    coverImage: entry.media.coverImage,
                },
                status: entry.status,
                score: entry.score,
                progress: entry.progress,
                repeat: entry.repeat,
            });
        }
    }
    return allEntries;
}
async function fetchUserFavorites(username) {
    const query = `
        query ($username: String) {
            User(name: $username) {
                favourites {
                    anime {
                        nodes {
                            id
                        }
                    }
                    manga {
                        nodes {
                            id
                        }
                    }
                }
            }
        }
    `;
    const response = await rateLimiter.add(() => fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables: { username } }),
    }));
    if (!response.ok) {
        await dumpAnilistFailure(response, { username, query }, 'fail_favs');
        throw new Error(`Anilist API error: ${response.status}`);
    }
    const json = await response.json();
    if (json.errors) {
        await dumpAnilistFailure(response, { username, query }, 'graphql_fail_favs', json);
        throw new Error(`GraphQL error: ${json.errors[0].message}`);
    }
    const animeIds = json.data?.User?.favourites?.anime?.nodes?.map((n) => n.id) || [];
    const mangaIds = json.data?.User?.favourites?.manga?.nodes?.map((n) => n.id) || [];
    return [...animeIds, ...mangaIds];
}
async function searchMedia(searchInput, mediaType = 'ANIME') {
    // Check persistent cache first
    const cached = (0, anilistCache_1.getCachedMedia)(searchInput, mediaType);
    if (cached) {
        return cached;
    }
    const isId = /^\d+$/.test(searchInput);
    let query;
    let variables;
    if (isId) {
        query = `
            query ($id: Int, $type: MediaType) {
                Media(id: $id, type: $type) {
                    id
                    type
                    siteUrl
                    title {
                        romaji
                        english
                        native
                    }
                    description(asHtml: false)
                    meanScore
                    coverImage {
                        large
                        extraLarge
                    }
                }
            }
        `;
        variables = { id: parseInt(searchInput, 10), type: mediaType };
    }
    else {
        query = `
            query ($search: String, $type: MediaType) {
                Media(search: $search, type: $type) {
                    id
                    type
                    siteUrl
                    title {
                        romaji
                        english
                        native
                    }
                    description(asHtml: false)
                    meanScore
                    coverImage {
                        large
                        extraLarge
                    }
                }
            }
        `;
        variables = { search: searchInput, type: mediaType };
    }
    const response = await rateLimiter.add(() => fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
    }));
    if (!response.ok) {
        throw new Error(`Anilist API error: ${response.status}`);
    }
    const json = await response.json();
    const media = json.data?.Media || null;
    // Save to persistent cache
    if (media) {
        (0, anilistCache_1.setCachedMedia)(searchInput, mediaType, media);
    }
    return media;
}
async function registerUser(discordId, anilistUsername) {
    const success = (0, db_1.registerAnilistUser)(discordId, anilistUsername);
    if (!success)
        return false;
    await getUserLists(discordId, true);
    return true;
}
function unregisterUser(discordId) {
    return (0, db_1.unregisterAnilistUser)(discordId);
}
async function getUserLists(discordId, forceRefresh = false, mediaType) {
    const username = (0, db_1.getAllAnilistMappings)()[discordId];
    if (!username)
        return [];
    const lastRefresh = (0, db_1.getLastRefreshTime)(discordId);
    const isStale = !lastRefresh?.lists || (Date.now() - new Date(lastRefresh.lists).getTime()) > REFRESH_INTERVAL_MS;
    if (!forceRefresh && !isStale) {
        const dbEntries = (0, db_1.getUserMediaList)(discordId, mediaType);
        if (dbEntries.length > 0) {
            return dbEntries.map(e => JSON.parse(e.entryData));
        }
    }
    try {
        if (mediaType) {
            const lists = await fetchAnilistLists(username, mediaType);
            console.log(`${new Date().toISOString()} - Fetched ${mediaType} lists for ${username}, ${lists.length} entries`);
            const entriesToSave = lists.map(entry => toSaveableEntry(entry, mediaType));
            (0, db_1.saveUserMediaBatch)(discordId, entriesToSave);
            (0, db_1.updateRefreshLog)(discordId, 'lists');
            return entriesToSave.map(e => JSON.parse(e.entryData));
        }
        else {
            const animeLists = await fetchAnilistLists(username, 'ANIME');
            console.log(`${new Date().toISOString()} - Fetched anime lists for ${username}, ${animeLists.length} entries`);
            const animeEntries = animeLists.map(entry => toSaveableEntry(entry, 'ANIME'));
            (0, db_1.saveUserMediaBatch)(discordId, animeEntries);
            const mangaLists = await fetchAnilistLists(username, 'MANGA');
            console.log(`${new Date().toISOString()} - Fetched manga lists for ${username}, ${mangaLists.length} entries`);
            const mangaEntries = mangaLists.map(entry => toSaveableEntry(entry, 'MANGA'));
            (0, db_1.saveUserMediaBatch)(discordId, mangaEntries);
            (0, db_1.updateRefreshLog)(discordId, 'lists');
            return [
                ...animeEntries.map(e => JSON.parse(e.entryData)),
                ...mangaEntries.map(e => JSON.parse(e.entryData))
            ];
        }
    }
    catch (err) {
        console.error(`Failed to fetch lists for ${username}:`, err);
        const dbEntries = (0, db_1.getUserMediaList)(discordId, mediaType);
        return dbEntries.map(e => JSON.parse(e.entryData));
    }
}
async function getUserFavorites(discordId, forceRefresh = false) {
    const username = (0, db_1.getAllAnilistMappings)()[discordId];
    if (!username)
        return [];
    const lastRefresh = (0, db_1.getLastRefreshTime)(discordId);
    const isStale = !lastRefresh?.favorites || (Date.now() - new Date(lastRefresh.favorites).getTime()) > REFRESH_INTERVAL_MS;
    if (!forceRefresh && !isStale) {
        const dbFavs = (0, db_1.getUserFavorites)(discordId);
        if (dbFavs.length > 0) {
            return dbFavs;
        }
    }
    try {
        const favs = await fetchUserFavorites(username);
        console.log(`${new Date().toISOString()} - Fetched favorites for ${username}, ${favs.length} entries`);
        (0, db_1.saveUserFavorites)(discordId, favs);
        (0, db_1.updateRefreshLog)(discordId, 'favorites');
        return favs;
    }
    catch (err) {
        console.error(`Failed to fetch favorites for ${username}:`, err);
        return (0, db_1.getUserFavorites)(discordId);
    }
}
const COMMAND_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
async function getAnimeInfoWithScores(searchInput, mediaType = 'ANIME', requesterDiscordId) {
    const media = await searchMedia(searchInput, mediaType);
    if (!media) {
        return null;
    }
    const resolvedTitle = media.title.english || media.title.romaji || media.title.native || searchInput;
    const description = media.description
        ?.replace(/(<br>|\n)+/g, '\n')
        ?.replace(/<b>(.*?)<\/b>/gi, '**$1**')
        ?.replace(/<i>(.*?)<\/i>/gi, '*$1*')
        ?.replace(/<\/?b>/gi, '')
        ?.replace(/<\/?i>/gi, '') || 'No description available.';
    const coverImage = media.coverImage.extraLarge || media.coverImage.large || '';
    const anilistURL = media.siteUrl;
    const score = media.meanScore || 0;
    if (requesterDiscordId) {
        const lastRefresh = (0, db_1.getLastRefreshTime)(requesterDiscordId);
        const needsRefresh = !lastRefresh?.lists ||
            (Date.now() - new Date(lastRefresh.lists).getTime()) > COMMAND_REFRESH_INTERVAL_MS;
        if (needsRefresh) {
            await getUserLists(requesterDiscordId, true, mediaType);
        }
    }
    const mappings = (0, db_1.getAllAnilistMappings)();
    const matches = [];
    for (const [discordId, aniUsername] of Object.entries(mappings)) {
        let userLists = [];
        const dbEntries = (0, db_1.getUserMediaList)(discordId, mediaType);
        if (dbEntries.length > 0) {
            userLists = dbEntries.map(e => JSON.parse(e.entryData));
        }
        let userFavs = [];
        let foundEntry = null;
        for (const entry of userLists) {
            if (entry.mediaId === media.id && entry.mediaType === mediaType) {
                foundEntry = entry;
                break;
            }
        }
        if (foundEntry) {
            if (userFavs.length === 0) {
                userFavs = (0, db_1.getUserFavorites)(discordId);
            }
            matches.push({
                discordId,
                aniUsername,
                listName: '',
                score: foundEntry.score,
                progress: foundEntry.progress,
                status: foundEntry.status,
                repeat: foundEntry.repeat,
                isFavorite: userFavs.includes(media.id),
            });
        }
        else {
            matches.push({
                discordId,
                aniUsername,
                listName: '',
                score: 0,
                progress: 0,
                status: 'NOT_ON_LIST',
                repeat: 0,
                isFavorite: false,
            });
        }
    }
    return {
        resolvedTitle,
        description,
        anilistURL,
        score,
        coverImage,
        matches,
    };
}
async function updateAllUserData() {
    exports.isUpdateInProgress = true;
    const mappings = (0, db_1.getAllAnilistMappings)();
    const delayBetweenUsers = calculateRateLimitDelay();
    try {
        for (const [discordId] of Object.entries(mappings)) {
            await getUserLists(discordId, true);
            await getUserFavorites(discordId, true);
            await new Promise(resolve => setTimeout(resolve, delayBetweenUsers));
        }
    }
    finally {
        exports.isUpdateInProgress = false;
    }
}
//# sourceMappingURL=anilist.js.map