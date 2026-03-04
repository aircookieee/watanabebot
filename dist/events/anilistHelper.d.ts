import { EmbedBuilder } from 'discord.js';
import { AnimeMatch, AnilistMediaType } from '../types';
interface AnimeInfoResult {
    resolvedTitle: string;
    description: string;
    anilistURL: string;
    score: number;
    coverImage: string;
    matches: AnimeMatch[];
}
export declare function createAnimeEmbed(result: AnimeInfoResult, sTime: number, mediaType?: AnilistMediaType): EmbedBuilder;
export {};
//# sourceMappingURL=anilistHelper.d.ts.map