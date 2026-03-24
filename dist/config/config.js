"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
exports.config = {
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
        dataDir: path_1.default.resolve(__dirname, '../../data'),
        databasePath: path_1.default.resolve(__dirname, '../../data/watanabebot.db'),
    },
    reactions: {
        watashiEmoji: '1247638024372621442',
        smolWatashiEmoji: '1247638021482872944',
        yesWatanabeEmoji: '1247638018949644298',
    },
    pluralKitUid: '466378653216014359',
};
exports.default = exports.config;
//# sourceMappingURL=config.js.map