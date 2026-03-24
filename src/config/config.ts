import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
    discord: {
        token: process.env.DISCORD_TOKEN || '',
        clientId: process.env.DISCORD_CLIENT_ID || '',
        guildId: process.env.DISCORD_GUILD_ID || '',
    },
    anilist: {
        apiUrl: 'https://graphql.anilist.co',
    },
    spotify: {
        clientId: process.env.SPOTIFY_CLIENT_ID || '',
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
        playlistId: process.env.SPOTIFY_PLAYLIST_ID || '',
    },
    wordnik: {
        apiKey: process.env.WORDNIK_API_KEY || '',
    },
    google: {
        geminiApiKey: process.env.GEMINI_API_KEY || '',
    },
    channels: {
        musicartWebhookId: process.env.CHANNEL_MUSICART_WEBHOOK_ID || '',
        loveLiveMusicChannelId: process.env.CHANNEL_LOVELIVE_MUSIC_ID || '',
        dailyFactsChannelId: process.env.CHANNEL_DAILY_FACTS_ID || '',
    },
    paths: {
        dataDir: path.resolve(__dirname, '../../data'),
        databasePath: path.resolve(__dirname, '../../data/watanabebot.db'),
    },
    reactions: {
        watashiEmoji: '1247638024372621442',
        smolWatashiEmoji: '1247638021482872944',
        yesWatanabeEmoji: '1247638018949644298',
    },
    pluralKitUid: '466378653216014359',
};

export default config;
