import { MessageEmbed } from "discord.js";
import fs from "fs";
import path from "path";
import { NumericLiteral } from "typescript";

export type AnimeMatch = {
    discordId: string;
    aniUsername: string;
    listName: string;
    score: number;
    progress: number;
    status: string;
    repeat: number;
};

export function createAnimeEmbed(
title: string, anilistURL: string, description: string, score: number, coverImage: string, matches: AnimeMatch[], sTime: number,
) {
    const embed = new MessageEmbed()
        .setTitle(title)
        .setURL(anilistURL)
        .setDescription(
            description.length > 600 ? description.slice(0, 597) + "..." : description
        )
        .setColor(0x1f8b4c);

    if (coverImage) {
        embed.setThumbnail(coverImage);
    }
    let mugAvg = 0;
    let zeroScores = 0;
    matches.forEach(user => {
        user.score != 0 ? mugAvg += user.score : zeroScores++;
    });
    mugAvg /= matches.length - zeroScores;

    embed.addFields(
        { name: 'Anilist Score', value: score, inline: true },
        { name: 'MugScore™', value: Math.round(mugAvg), inline: true }
    )

    let userScores = "";

    // Grouping matches by status
    const statusMap: Record<string, AnimeMatch[]> = {};
    for (const match of matches) {
        if (match.status === "REPEATING" && match.repeat === undefined) {match.repeat = 1;}   // fix AL bs
        if (match.status === "REPEATING") {match.status = "CURRENT";}   // force grouping in current
        if (!statusMap[match.status]) statusMap[match.status] = [];
        statusMap[match.status].push(match);
    }

    const displayOrder = [
        "CURRENT",
        "PAUSED",
        "COMPLETED",
        "DROPPED",
        "PLANNING",
        "NOT_ON_LIST",
    ];

    // Load registered users from the AniList map
    const MAP_FILE = path.join(__dirname, "discordAniListMap.json");
    let allRegistered: Record<string, string> = {};
    if (fs.existsSync(MAP_FILE)) {
        allRegistered = JSON.parse(fs.readFileSync(MAP_FILE, "utf-8"));
    }

    const matchedUserIds = new Set(matches.map((m) => m.discordId));

    // Add "Not On List" users explicitly
    for (const [discordId, aniUsername] of Object.entries(allRegistered)) {
        if (!matchedUserIds.has(discordId)) {
            if (!statusMap["NOT_ON_LIST"]) statusMap["NOT_ON_LIST"] = [];
            statusMap["NOT_ON_LIST"].push({
                discordId,
                aniUsername,
                listName: "",
                score: 0,
                progress: 0,
                repeat: 0,
                status: "NOT_ON_LIST",
            });
        }
    }

    for (const status of displayOrder) {
        const matchesForStatus = statusMap[status];
        if (!matchesForStatus) continue;

        const users = matchesForStatus.map((match) => {
            switch (status) {
                case "CURRENT":
                case "PAUSED":
                case "DROPPED":
                    // return ` ${match.aniUsername} ${match.score > 0 ? `[${match.progress}] **${match.score}**` : `[${match.progress}]`}`;
                    let str = `${match.aniUsername}`;
                    if (match.progress > 0) {
                        str += ` [${match.progress}]`;
                    }
                    if (match.score > 0) {
                        str += `  **${match.score}**`;
                    }
                    if (match.repeat > 0) {
                        str += ` (R${match.repeat})`;
                    }
                    return str;
                case "COMPLETED":
                    //return `${match.aniUsername} ${match.score > 0 ? `**${match.score}**` : ""}`;
                    let strC = `${match.aniUsername}`;
                    if (match.score > 0) {
                        strC += `  **${match.score}**`;
                    }
                    if (match.repeat > 0) {
                        strC += ` (R${match.repeat})`;
                    }
                    return strC;
                case "PLANNING":
                case "NOT_ON_LIST":
                    return `${match.aniUsername} ${match.score > 0 ? `**${match.score}**` : ""}`;
                default:
                    return `${match.aniUsername}`;
            }
        });

        if (users.length > 0) {
            let label = (status === "NOT_ON_LIST") 
            ? "Not On List"
            : status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
            userScores += `**${label}**: ${users.join(" | ")}\n`;
        }
    }

    embed.addField("User Scores", userScores, false);
    const eTime = performance.now();
    embed.setFooter(`Execution took ${Math.round(eTime - sTime)}ms`);

    return embed;
}
