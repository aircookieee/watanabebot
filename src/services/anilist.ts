
import config from '../config/config';
import { 
    getAllAnilistMappings, 
    registerAnilistUser as dbRegisterUser, 
    unregisterAnilistUser as dbUnregisterUser, 
    getAnilistUserCount,
    saveUserMediaBatch,
    getUserMediaList,
    getUserMediaById,
    saveUserFavorites,
    getUserFavorites as dbGetUserFavorites,
    getLastRefreshTime,
    updateRefreshLog,
    clearUserMediaList
} from '../database/db';
import { AnilistMediaType, AnimeMatch, AnilistSearchResult, AnilistUserEntry, AnilistUserEntryMinimal } from '../types';
import { getCachedMedia, setCachedMedia } from './anilistCache';

const API_URL = 'https://graphql.anilist.co';
const REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000;
const TARGET_REQUESTS_PER_MINUTE = 25;
const BASE_DELAY_MS = Math.ceil(60000 / TARGET_REQUESTS_PER_MINUTE);

export let isUpdateInProgress = false;

export function setUpdateInProgress(value: boolean): void {
    isUpdateInProgress = value;
}

function calculateRateLimitDelay(): number {
    const userCount = getAnilistUserCount();
    const delayPerUser = 100;
    const calculatedDelay = BASE_DELAY_MS + (userCount * delayPerUser);
    return Math.min(calculatedDelay, 10000);
}

class RateLimiter {
    private queue: (() => Promise<void>)[] = [];
    private processing = false;
    private lastRequestTime = 0;

    async add<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await fn();
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            });
            this.processQueue();
        });
    }

    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) return;
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

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const rateLimiter = new RateLimiter();

async function dumpAnilistFailure(
    response: Response,
    context: Record<string, any>,
    prefix: string,
    body?: any
): Promise<void> {
    try {
        const dumpDir = './data/anilist_failures';
        const fs = await import('fs');
        if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${dumpDir}/${prefix}_${timestamp}_${Math.floor(Math.random() * 100000)}.json`;
        const headersObj: Record<string, string> = {};
        response.headers.forEach((value, key) => { headersObj[key] = value; });
        let bodyContent = body;
        if (bodyContent === undefined) {
            try { bodyContent = await response.text(); }
            catch (e) { bodyContent = `Failed to read body: ${e}`; }
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
    } catch (err) {
        console.error(`Failed to dump Anilist response (${prefix}):`, err);
    }
}

function toSaveableEntry(entry: AnilistUserEntry, mediaType: AnilistMediaType): { mediaId: number; mediaType: string; entryData: string } {
    const minimal: AnilistUserEntryMinimal = {
        mediaId: entry.media.id,
        mediaType,
        status: entry.status,
        score: entry.score,
        progress: entry.progress,
        repeat: entry.repeat,
    };
    return { mediaId: entry.media.id, mediaType, entryData: JSON.stringify(minimal) };
}

async function fetchAnilistLists(username: string, mediaType: AnilistMediaType): Promise<AnilistUserEntry[]> {
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

    const response = await rateLimiter.add(() =>
        fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ query, variables: { username, type: mediaType } }),
        })
    ) as Response;

    if (!response.ok) {
        await dumpAnilistFailure(response, { username, mediaType, query }, 'fail');
        throw new Error(`Anilist API error: ${response.status}`);
    }

    const json = await response.json() as any;
    if (json.errors) {
        await dumpAnilistFailure(response, { username, mediaType, query }, 'graphql_fail', json);
        throw new Error(`GraphQL error: ${json.errors[0].message}`);
    }

    const lists = json.data.MediaListCollection.lists;
    const allEntries: AnilistUserEntry[] = [];

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

async function fetchUserFavorites(username: string): Promise<number[]> {
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

    const response = await rateLimiter.add(() =>
        fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ query, variables: { username } }),
        })
    ) as Response;

    if (!response.ok) {
        await dumpAnilistFailure(response, { username, query }, 'fail_favs');
        throw new Error(`Anilist API error: ${response.status}`);
    }

    const json = await response.json() as any;
    if (json.errors) {
        await dumpAnilistFailure(response, { username, query }, 'graphql_fail_favs', json);
        throw new Error(`GraphQL error: ${json.errors[0].message}`);
    }

    const animeIds = json.data?.User?.favourites?.anime?.nodes?.map((n: any) => n.id) || [];
    const mangaIds = json.data?.User?.favourites?.manga?.nodes?.map((n: any) => n.id) || [];

    return [...animeIds, ...mangaIds];
}

export async function searchMedia(searchInput: string, mediaType: AnilistMediaType = 'ANIME'): Promise<AnilistSearchResult | null> {
    // Check persistent cache first
    const cached = getCachedMedia(searchInput, mediaType);
    if (cached) {
        return cached;
    }

    const isId = /^\d+$/.test(searchInput);

    let query: string;
    let variables: any;

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
    } else {
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

    const response = await rateLimiter.add(() =>
        fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ query, variables }),
        })
    ) as Response;

    if (!response.ok) {
        throw new Error(`Anilist API error: ${response.status}`);
    }

    const json = await response.json() as any;
    const media = json.data?.Media || null;

    // Save to persistent cache
    if (media) {
        setCachedMedia(searchInput, mediaType, media);
    }

    return media;
}

export async function registerUser(discordId: string, anilistUsername: string): Promise<boolean> {
    const success = dbRegisterUser(discordId, anilistUsername);
    if (!success) return false;

    await getUserLists(discordId, true);
    return true;
}

export function unregisterUser(discordId: string): boolean {
    return dbUnregisterUser(discordId);
}

export async function getUserLists(discordId: string, forceRefresh = false, mediaType?: AnilistMediaType): Promise<AnilistUserEntryMinimal[]> {
    const username = getAllAnilistMappings()[discordId];
    if (!username) return [];

    const lastRefresh = getLastRefreshTime(discordId);
    const isStale = !lastRefresh?.lists || (Date.now() - new Date(lastRefresh.lists).getTime()) > REFRESH_INTERVAL_MS;

    if (!forceRefresh && !isStale) {
        const dbEntries = getUserMediaList(discordId, mediaType);
        if (dbEntries.length > 0) {
            return dbEntries.map(e => JSON.parse(e.entryData) as AnilistUserEntryMinimal);
        }
    }

    try {
        if (mediaType) {
            const lists = await fetchAnilistLists(username, mediaType);
            console.log(`${new Date().toISOString()} - Fetched ${mediaType} lists for ${username}, ${lists.length} entries`);
            
            const entriesToSave = lists.map(entry => toSaveableEntry(entry, mediaType));
            saveUserMediaBatch(discordId, entriesToSave);
            updateRefreshLog(discordId, 'lists');
            
            return entriesToSave.map(e => JSON.parse(e.entryData));
        } else {
            const animeLists = await fetchAnilistLists(username, 'ANIME');
            console.log(`${new Date().toISOString()} - Fetched anime lists for ${username}, ${animeLists.length} entries`);
            
            const animeEntries = animeLists.map(entry => toSaveableEntry(entry, 'ANIME'));
            saveUserMediaBatch(discordId, animeEntries);
            
            const mangaLists = await fetchAnilistLists(username, 'MANGA');
            console.log(`${new Date().toISOString()} - Fetched manga lists for ${username}, ${mangaLists.length} entries`);
            
            const mangaEntries = mangaLists.map(entry => toSaveableEntry(entry, 'MANGA'));
            saveUserMediaBatch(discordId, mangaEntries);
            updateRefreshLog(discordId, 'lists');
            
            return [
                ...animeEntries.map(e => JSON.parse(e.entryData)),
                ...mangaEntries.map(e => JSON.parse(e.entryData))
            ];
        }
    } catch (err) {
        console.error(`Failed to fetch lists for ${username}:`, err);
        const dbEntries = getUserMediaList(discordId, mediaType);
        return dbEntries.map(e => JSON.parse(e.entryData) as AnilistUserEntryMinimal);
    }
}

export async function getUserFavorites(discordId: string, forceRefresh = false): Promise<number[]> {
    const username = getAllAnilistMappings()[discordId];
    if (!username) return [];

    const lastRefresh = getLastRefreshTime(discordId);
    const isStale = !lastRefresh?.favorites || (Date.now() - new Date(lastRefresh.favorites).getTime()) > REFRESH_INTERVAL_MS;

    if (!forceRefresh && !isStale) {
        const dbFavs = dbGetUserFavorites(discordId);
        if (dbFavs.length > 0) {
            return dbFavs;
        }
    }

    try {
        const favs = await fetchUserFavorites(username);
        console.log(`${new Date().toISOString()} - Fetched favorites for ${username}, ${favs.length} entries`);
        saveUserFavorites(discordId, favs);
        updateRefreshLog(discordId, 'favorites');
        return favs;
    } catch (err) {
        console.error(`Failed to fetch favorites for ${username}:`, err);
        return dbGetUserFavorites(discordId);
    }
}

const COMMAND_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export async function getAnimeInfoWithScores(
    searchInput: string,
    mediaType: AnilistMediaType = 'ANIME',
    requesterDiscordId?: string
): Promise<{
    resolvedTitle: string;
    description: string;
    anilistURL: string;
    score: number;
    coverImage: string;
    matches: AnimeMatch[];
} | null> {
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
        const lastRefresh = getLastRefreshTime(requesterDiscordId);
        const needsRefresh = !lastRefresh?.lists || 
            (Date.now() - new Date(lastRefresh.lists).getTime()) > COMMAND_REFRESH_INTERVAL_MS;
        
        if (needsRefresh) {
            await getUserLists(requesterDiscordId, true, mediaType);
        }
    }

    const mappings = getAllAnilistMappings();
    const matches: AnimeMatch[] = [];

    for (const [discordId, aniUsername] of Object.entries(mappings)) {
        let userLists: AnilistUserEntryMinimal[] = [];
        
        const dbEntries = getUserMediaList(discordId, mediaType);
        if (dbEntries.length > 0) {
            userLists = dbEntries.map(e => JSON.parse(e.entryData) as AnilistUserEntryMinimal);
        }

        let userFavs: number[] = [];
        let foundEntry: AnilistUserEntryMinimal | null = null;
        
        for (const entry of userLists) {
            if (entry.mediaId === media.id && entry.mediaType === mediaType) {
                foundEntry = entry;
                break;
            }
        }

        if (foundEntry) {
            if (userFavs.length === 0) {
                userFavs = dbGetUserFavorites(discordId);
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
        } else {
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

export async function updateAllUserData(): Promise<void> {
    isUpdateInProgress = true;
    const mappings = getAllAnilistMappings();
    const delayBetweenUsers = calculateRateLimitDelay();

    try {
        for (const [discordId] of Object.entries(mappings)) {
            await getUserLists(discordId, true);
            await getUserFavorites(discordId, true);
            await new Promise(resolve => setTimeout(resolve, delayBetweenUsers));
        }
    } finally {
        isUpdateInProgress = false;
    }
}
