export declare function initDatabase(): Promise<void>;
export declare function registerAnilistUser(discordId: string, anilistUsername: string): boolean;
export declare function unregisterAnilistUser(discordId: string): boolean;
export declare function getAnilistUsername(discordId: string): string | null;
export declare function getAllAnilistMappings(): Record<string, string>;
export declare function getAnilistUserCount(): number;
export declare function saveUserMediaBatch(discordId: string, entries: {
    mediaId: number;
    mediaType: string;
    entryData: string;
}[]): void;
export declare function clearUserMediaList(discordId: string, mediaType?: string): void;
export declare function getUserMediaList(discordId: string, mediaType?: string): {
    mediaId: number;
    mediaType: string;
    entryData: string;
}[];
export declare function getUserMediaById(discordId: string, mediaId: number): string | null;
export declare function saveUserFavorites(discordId: string, mediaIds: number[]): void;
export declare function getUserFavorites(discordId: string): number[];
export declare function getLastRefreshTime(discordId: string): {
    lists?: string;
    favorites?: string;
} | null;
export declare function updateRefreshLog(discordId: string, refreshType: 'lists' | 'favorites'): void;
export declare function getGuildConfig(guildId: string): {
    channelId: string;
    mode: string;
} | null;
export declare function setGuildConfig(guildId: string, channelId: string, mode: string): void;
export declare function getSetting(key: string): string | null;
export declare function setSetting(key: string, value: string): void;
export declare function closeDatabase(): void;
//# sourceMappingURL=db.d.ts.map