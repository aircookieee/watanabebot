import { AnilistMediaType, AnimeMatch, AnilistSearchResult, AnilistUserEntryMinimal } from '../types';
export declare let isUpdateInProgress: boolean;
export declare function setUpdateInProgress(value: boolean): void;
export declare function searchMedia(searchInput: string, mediaType?: AnilistMediaType): Promise<AnilistSearchResult | null>;
export declare function registerUser(discordId: string, anilistUsername: string): Promise<boolean>;
export declare function unregisterUser(discordId: string): boolean;
export declare function getUserLists(discordId: string, forceRefresh?: boolean, mediaType?: AnilistMediaType): Promise<AnilistUserEntryMinimal[]>;
export declare function getUserFavorites(discordId: string, forceRefresh?: boolean): Promise<number[]>;
export declare function getAnimeInfoWithScores(searchInput: string, mediaType?: AnilistMediaType, requesterDiscordId?: string): Promise<{
    resolvedTitle: string;
    description: string;
    anilistURL: string;
    score: number;
    coverImage: string;
    matches: AnimeMatch[];
} | null>;
export declare function updateAllUserData(): Promise<void>;
//# sourceMappingURL=anilist.d.ts.map