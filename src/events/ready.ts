import { Events, Client, EmbedBuilder } from 'discord.js';
import { getGuildConfig, setGuildConfig, getAllAnilistMappings } from '../database/db';
import config from '../config/config';
import { getUserLists, getUserFavorites, setUpdateInProgress, updateAllUserData } from '../services/anilist';
import { getPlaylistTracks, getRandomTrack, formatTrackForEmbed } from '../services/spotify';
import { postDailyFact } from '../services/facts';
import cron from 'node-cron';

export const name = Events.ClientReady;

export async function execute(client: Client): Promise<void> {
    console.log('Connected');
    console.log(`Logged in as: ${client.user?.username} - (${client.user?.id})`);
    console.log(`You-chan started at ${new Date()}`);

    for (const [id, guild] of client.guilds.cache) {
        const existingConfig = getGuildConfig(id);
        if (!existingConfig) {
            setGuildConfig(id, '', 'everywhere');
        }
    }

    const mappings = getAllAnilistMappings();
    const userIds = Object.keys(mappings);
    if (userIds.length > 0) {
        setUpdateInProgress(true);
        console.log(`Pre-warming Anilist cache for ${userIds.length} users...`);
        for (const discordId of userIds) {
            await getUserLists(discordId, true);
            await getUserFavorites(discordId, true);
            await new Promise(r => setTimeout(r, 4000));
        }
        setUpdateInProgress(false);
        console.log('Anilist cache pre-warmed');
    }

    setupScheduledTasks(client);
}

function setupScheduledTasks(client: Client): void {

    cron.schedule('5 4 * * *', async () => {
        console.log('Love Live time!');
        const channelId = config.channels.loveLiveMusicChannelId;
        const channel = await client.channels.fetch(channelId);
        
        if (channel && channel.isTextBased()) {
            await postLoveLive(channel);
        }
    });

    cron.schedule('0 */3 * * *', async () => {
        console.log(`[${new Date().toISOString()}] Auto-updating Anilist data...`);
        try {
            await updateAllUserData();
            console.log(`[${new Date().toISOString()}] Anilist data updated successfully.`);
        } catch (e) {
            console.error(`[${new Date().toISOString()}] Failed to update Anilist data:`, e);
        }
    });

    cron.schedule('5 9 * * *', async () => {
        console.log(`[${new Date().toISOString()}] Posting daily fact...`);
        try {
            const factChannelId = config.channels.dailyFactsChannelId;
            const channel = await client.channels.fetch(factChannelId);
            
            if (channel && channel.isTextBased()) {
                await postDailyFact(channel as any);
            }
        } catch (e) {
            console.error(`[${new Date().toISOString()}] Failed to post daily fact:`, e);
        }
    });

    cron.schedule('0 0 * * *', async () => {
        console.log(`[${new Date().toISOString()}] Running daily cleanup...`);
        try {
            cleanupOldLogs();
        } catch (e) {
            console.error(`[${new Date().toISOString()}] Failed to cleanup logs:`, e);
        }
    });
}

function cleanupOldLogs(): void {
    const fs = require('fs');
    const pathMod = require('path');
    const failureDir = pathMod.join(__dirname, '../../data/anilist_failures');
    const maxAgeDays = 7;
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (!fs.existsSync(failureDir)) return;

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

async function postLoveLive(channel: any): Promise<void> {
    try {
        const tracks = await getPlaylistTracks();

        if (tracks.length === 0) {
            console.log('No tracks found in the playlist.');
            return;
        }

        const track = getRandomTrack(tracks);
        if (!track) return;

        const { fullName, appleMusicUrl, youtubeMusicUrl } = formatTrackForEmbed(track);

        const embed = new EmbedBuilder()
            .setColor(0xe4007f)
            .setTitle('Love Live time!')
            .setURL(track.link)
            .setDescription(
                `Today's song is:\n**${fullName}**\n\n` +
                `[Listen on Spotify](${track.link})\n` +
                `[Listen on Apple Music](https://music.apple.com/us/search?term=${appleMusicUrl})\n` +
                `[Listen on YouTube Music](https://music.youtube.com/search?q=${youtubeMusicUrl})`
            )
            .setImage(track.albumCover)
            .setFooter({ text: 'What the fuck did you just fucking say about μ\'s, you little bitch?' });

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error posting Love Live:', error);
    }
}
