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

export function createAnimeEmbed(
    result: AnimeInfoResult,
    sTime: number,
    mediaType: AnilistMediaType = 'ANIME'
): EmbedBuilder {
    const isAnime = mediaType === 'ANIME';
    const color = isAnime ? 0x1f8b4c : 0xff6b9d;
    const typeLabel = isAnime ? 'Anime' : 'Manga';

    const { resolvedTitle, description, anilistURL, score, coverImage, matches } = result;

    const embed = new EmbedBuilder()
        .setTitle(`${typeLabel} • ${resolvedTitle}`)
        .setURL(anilistURL)
        .setDescription(
            description.length > 600 ? description.slice(0, 597) + '...' : description
        )
        .setColor(color);

    if (coverImage) {
        embed.setThumbnail(coverImage);
    }

    let mugAvg = 0;
    let zeroScores = 0;
    for (const user of matches) {
        if (user.score !== 0) {
            mugAvg += user.score;
        } else {
            zeroScores++;
        }
    }
    mugAvg /= matches.length - zeroScores || 1;

    embed.addFields([
        { name: 'Anilist Score', value: score.toString(), inline: true },
        { name: 'MugScore', value: Math.round(mugAvg).toString(), inline: true },
    ]);

    const statusMap: Record<string, AnimeMatch[]> = {};
    for (const match of matches) {
        if (match.status === 'REPEATING' && match.repeat === 0) {
            match.repeat = 1;
        }
        if (match.status === 'REPEATING') {
            match.status = 'CURRENT';
        }
        if (!statusMap[match.status]) {
            statusMap[match.status] = [];
        }
        statusMap[match.status].push(match);
    }

    const displayOrder = ['CURRENT', 'PAUSED', 'COMPLETED', 'DROPPED', 'PLANNING', 'NOT_ON_LIST'];
    let userScores = '';

    for (const status of displayOrder) {
        const matchesForStatus = statusMap[status];
        if (!matchesForStatus) continue;

        const users = matchesForStatus.map((match) => {
            let str = `${match.aniUsername}`;
            if (match.progress > 0 && match.status !== 'COMPLETED') {
                str += ` [${match.progress}]`;
            }
            if (match.score > 0) {
                str += `  **${match.score}**`;
            }
            if (match.repeat > 0) {
                str += ` (R${match.repeat})`;
            }
            if (match.isFavorite) {
                str += ' :heart:';
            }
            return str;
        });

        if (users.length > 0) {
            const label = status === 'NOT_ON_LIST'
                ? 'Not On List'
                : status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
            userScores += `**${label}**: ${users.join(' | ')}\n`;
        }
    }

    if (userScores) {
        embed.addFields([{ name: 'User Scores', value: userScores, inline: false }]);
    }

    const eTime = performance.now();
    embed.setFooter({ text: `Execution took ${Math.round(eTime - sTime)}ms` });

    return embed;
}
