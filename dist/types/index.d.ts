import { Client, TextChannel, DMChannel, GuildTextBasedChannel } from 'discord.js';
export type AnilistMediaType = 'ANIME' | 'MANGA';
export interface AnilistUserEntryMinimal {
    mediaId: number;
    mediaType: AnilistMediaType;
    status: string;
    score: number;
    progress: number;
    repeat: number;
}
export interface AnilistUserEntry {
    media: {
        id: number;
        type?: AnilistMediaType;
        title: {
            romaji: string;
            english: string | null;
            native: string | null;
        };
        description: string | null;
        status: string;
        coverImage: {
            large: string | null;
            extraLarge: string | null;
        };
    };
    status: string;
    score: number;
    progress: number;
    repeat: number;
}
export interface AnimeMatch {
    discordId: string;
    aniUsername: string;
    listName: string;
    score: number;
    progress: number;
    status: string;
    repeat: number;
    isFavorite: boolean;
}
export interface AnilistSearchResult {
    id: number;
    type: AnilistMediaType;
    title: {
        romaji: string;
        english: string | null;
        native: string | null;
    };
    description: string | null;
    meanScore: number;
    coverImage: {
        large: string | null;
        extraLarge: string | null;
    };
    siteUrl: string;
}
export interface GuildChannelConfig {
    channelId: string;
    mode: 'here' | 'everywhere';
}
export interface BotData {
    [guildId: string]: GuildChannelConfig;
}
export interface Fact {
    text: string;
    source?: string;
    source_url?: string;
    id?: string;
}
export interface SpotifyTrack {
    title: string;
    link: string;
    uri: string;
    albumCover: string;
    artists: string;
}
export { Client, TextChannel, DMChannel, GuildTextBasedChannel };
//# sourceMappingURL=index.d.ts.map