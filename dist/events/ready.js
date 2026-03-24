"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const db_1 = require("../database/db");
const config_1 = __importDefault(require("../config/config"));
const anilist_1 = require("../services/anilist");
const spotify_1 = require("../services/spotify");
const facts_1 = require("../services/facts");
const node_cron_1 = __importDefault(require("node-cron"));
exports.name = discord_js_1.Events.ClientReady;
async function execute(client) {
    console.log('Connected');
    console.log(`Logged in as: ${client.user?.username} - (${client.user?.id})`);
    console.log(`You-chan started at ${new Date()}`);
    for (const [id, guild] of client.guilds.cache) {
        const existingConfig = (0, db_1.getGuildConfig)(id);
        if (!existingConfig) {
            (0, db_1.setGuildConfig)(id, '', 'everywhere');
        }
    }
    const mappings = (0, db_1.getAllAnilistMappings)();
    const userIds = Object.keys(mappings);
    if (userIds.length > 0) {
        (0, anilist_1.setUpdateInProgress)(true);
        console.log(`Pre-warming Anilist cache for ${userIds.length} users...`);
        for (const discordId of userIds) {
            await (0, anilist_1.getUserLists)(discordId, true);
            await (0, anilist_1.getUserFavorites)(discordId, true);
            await new Promise(r => setTimeout(r, 4000));
        }
        (0, anilist_1.setUpdateInProgress)(false);
        console.log('Anilist cache pre-warmed');
    }
    setupScheduledTasks(client);
}
function setupScheduledTasks(client) {
    node_cron_1.default.schedule('5 4 * * *', async () => {
        console.log('Love Live time!');
        const channelId = config_1.default.channels.loveLiveMusicChannelId;
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
            await postLoveLive(channel);
        }
    });
    node_cron_1.default.schedule('0 */3 * * *', async () => {
        console.log(`[${new Date().toISOString()}] Auto-updating Anilist data...`);
        try {
            await (0, anilist_1.updateAllUserData)();
            console.log(`[${new Date().toISOString()}] Anilist data updated successfully.`);
        }
        catch (e) {
            console.error(`[${new Date().toISOString()}] Failed to update Anilist data:`, e);
        }
    });
    node_cron_1.default.schedule('5 9 * * *', async () => {
        console.log(`[${new Date().toISOString()}] Posting daily fact...`);
        try {
            const factChannelId = config_1.default.channels.dailyFactsChannelId;
            const channel = await client.channels.fetch(factChannelId);
            if (channel && channel.isTextBased()) {
                await (0, facts_1.postDailyFact)(channel);
            }
        }
        catch (e) {
            console.error(`[${new Date().toISOString()}] Failed to post daily fact:`, e);
        }
    });
    node_cron_1.default.schedule('0 0 * * *', async () => {
        console.log(`[${new Date().toISOString()}] Running daily cleanup...`);
        try {
            cleanupOldLogs();
        }
        catch (e) {
            console.error(`[${new Date().toISOString()}] Failed to cleanup logs:`, e);
        }
    });
}
function cleanupOldLogs() {
    const fs = require('fs');
    const pathMod = require('path');
    const failureDir = pathMod.join(__dirname, '../../data/anilist_failures');
    const maxAgeDays = 7;
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    if (!fs.existsSync(failureDir))
        return;
    const files = fs.readdirSync(failureDir);
    let deletedCount = 0;
    for (const file of files) {
        const filePath = pathMod.join(failureDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
            fs.unlinkSync(filePath);
            deletedCount++;
        }
    }
    console.log(`[${new Date().toISOString()}] Cleaned up ${deletedCount} old log files`);
}
async function postLoveLive(channel) {
    try {
        const tracks = await (0, spotify_1.getPlaylistTracks)();
        if (tracks.length === 0) {
            console.log('No tracks found in the playlist.');
            return;
        }
        const track = (0, spotify_1.getRandomTrack)(tracks);
        if (!track)
            return;
        const { fullName, appleMusicUrl, youtubeMusicUrl } = (0, spotify_1.formatTrackForEmbed)(track);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xe4007f)
            .setTitle('Love Live time!')
            .setURL(track.link)
            .setDescription(`Today's song is:\n**${fullName}**\n\n` +
            `[Listen on Spotify](${track.link})\n` +
            `[Listen on Apple Music](https://music.apple.com/us/search?term=${appleMusicUrl})\n` +
            `[Listen on YouTube Music](https://music.youtube.com/search?q=${youtubeMusicUrl})`)
            .setImage(track.albumCover)
            .setFooter({ text: 'What the fuck did you just fucking say about μ\'s, you little bitch?' });
        await channel.send({ embeds: [embed] });
    }
    catch (error) {
        console.error('Error posting Love Live:', error);
    }
}
//# sourceMappingURL=ready.js.map