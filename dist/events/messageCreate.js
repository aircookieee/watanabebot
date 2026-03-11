"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const anilist_1 = require("../services/anilist");
const db_1 = require("../database/db");
const anilistHelper_1 = require("./anilistHelper");
const config_1 = __importDefault(require("../config/config"));
const index_1 = require("../index");
const watashiSearch = /(?<![a-zA-Z])You(?!\s*\(not [Ww]atanabe\)|[a-zA-Z])/gm;
const smolWatashiSearch = /(?<![a-zA-Z])you-chan(?!\s*\(not [Ww]atanabe\)|[a-zA-Z])/gm;
const yesWatanabeSearch = /\(yes [Ww]atanabe\)/gm;
const twitterLinkNew = /(https:\/\/((x.com)|(twitter.com))\/(\w+)(\/(\w+)\/(\w+))?)/gi;
const nitterLinkNew = /(https:\/\/nitter\.net\/(\w+)(\/(\w+)\/(\w+))?)/gi;
const commandSearch = /^!yousoro(?:$| (.+))/;
const animeBracketSearch = /\(\(+.+?\)\)/gm;
const mangaBracketSearch = /\[\[+.+?\]\]/gm;
exports.name = discord_js_1.Events.MessageCreate;
async function execute(message) {
    if (message.author.bot && !message.webhookId)
        return;
    const channel = message.channel;
    if (!(channel instanceof discord_js_1.TextChannel) && !(channel instanceof discord_js_1.DMChannel))
        return;
    const content = message.content;
    if (content.includes('https://x.com/') || content.includes('https://twitter.com/') || content.includes('https://nitter.net/')) {
        const twitterEnabled = (0, db_1.getSetting)('twitter_enabled');
        if (twitterEnabled === 'true') {
            await fixTwitterEmbeds(channel, message);
        }
    }
    const command = content.match(commandSearch);
    if (command) {
        if (channel instanceof discord_js_1.DMChannel) {
            await channel.send({
                content: 'Yousor- hey, wait a sec, this isn\'t a Discord server...',
                files: [{ attachment: 'resources/dms.png' }],
            });
            return;
        }
        if (command[0] === '!yousoro') {
            await channel.send({
                content: 'Yousoro, sailor!\n\n' +
                    '`!yousoro here` makes me react only in this channel\n' +
                    '`!yousoro everywhere` makes me react in all channels\n' +
                    '`!yousoro twitter <on/off>` will turn the twitter link replacement feature on or off.',
                files: [{ attachment: 'resources/ohayousoro.png' }],
            });
        }
        else if (command[1]) {
            const arg = command[1];
            if (arg === 'here') {
                if (!message.guild)
                    return;
                (0, db_1.setGuildConfig)(message.guild.id, channel.id, 'here');
                await channel.send({
                    content: 'Yousoro~!',
                    files: [{ attachment: 'resources/yousoroHere.png' }],
                });
            }
            else if (arg === 'everywhere') {
                if (!message.guild)
                    return;
                (0, db_1.setGuildConfig)(message.guild.id, '', 'everywhere');
                await channel.send({
                    content: 'Zensokuzenshin... Yousoro~!',
                    files: [{ attachment: 'resources/yousoroEverywhere.jpg' }],
                });
            }
            else if (arg === 'twitter on') {
                (0, db_1.setSetting)('twitter_enabled', 'true');
                await channel.send('Twitter Link Replacement is **ON**');
            }
            else if (arg === 'twitter off') {
                (0, db_1.setSetting)('twitter_enabled', 'false');
                await channel.send('Twitter Link Replacement is **OFF**');
            }
            else {
                await channel.send({
                    files: [{ attachment: 'resources/nosoro.gif' }],
                });
            }
        }
        return;
    }
    if (content.startsWith('!define')) {
        const args = content.trim().split(' ').slice(1);
        if (args.length === 0) {
            await channel.send('Usage: `!define <word>`');
            return;
        }
        const word = args.join(' ');
        const { getWordDefinitions, createWordEmbed } = await Promise.resolve().then(() => __importStar(require('../services/wordnik')));
        try {
            const data = await getWordDefinitions(word);
            if (!data || data.length === 0) {
                await channel.send(`No definitions found for "${word}"`);
                return;
            }
            const embed = createWordEmbed(data);
            if (embed) {
                await channel.send({ embeds: [embed] });
            }
            else {
                await channel.send(`No definitions found for "${word}"`);
            }
        }
        catch (error) {
            console.error('Error fetching definitions:', error);
            await channel.send('Something went wrong while fetching definitions');
        }
        return;
    }
    if (content.startsWith('!pick')) {
        const raw = content.slice(5).trim();
        if (!raw) {
            await channel.send('Usage: `!pick option1, option2, option3`');
            return;
        }
        const options = raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
        if (options.length < 2) {
            await channel.send('Please provide at least two options, separated by commas.');
            return;
        }
        const choice = options[Math.floor(Math.random() * options.length)];
        await channel.send(`I pick: ${choice}`);
        return;
    }
    let mediaType = 'ANIME';
    let animeMatch = content.match(animeBracketSearch);
    let mangaMatch = content.match(mangaBracketSearch);
    if (content.startsWith('!al') || content.startsWith('!alm') || animeMatch || mangaMatch) {
        let searchQuery = content;
        if (mangaMatch) {
            const mangaName = mangaMatch[0].replace(/[\[\]]/gm, '').trim();
            searchQuery = `!alm ${mangaName}`;
            mediaType = 'MANGA';
        }
        else if (animeMatch) {
            const animeName = animeMatch[0].replace(/[()]/gm, '').trim();
            searchQuery = `!al ${animeName}`;
            mediaType = 'ANIME';
        }
        if (searchQuery.startsWith('!alm')) {
            mediaType = 'MANGA';
        }
        const args = searchQuery.trim().split(' ').slice(1);
        const sub = args[0]?.toLowerCase();
        const rest = args.slice(1).join(' ');
        const fullQuery = [sub, rest].filter(Boolean).join(' ');
        if (sub === 'register' && args[1]) {
            await (0, anilist_1.registerUser)(message.author.id, args[1]);
            await channel.send(`Registered \`${args[1]}\` to <@${message.author.id}>.`);
            return;
        }
        if (sub === 'unregister') {
            const success = (0, anilist_1.unregisterUser)(message.author.id);
            if (success) {
                await channel.send(`Unregistered <@${message.author.id}>.`);
            }
            else {
                await channel.send(`Could not unregister <@${message.author.id}>.`);
            }
            return;
        }
        if (sub === 'update') {
            const msg = await channel.send('Updating Anilist data...');
            const startTime = performance.now();
            await (0, anilist_1.updateAllUserData)();
            const endTime = performance.now();
            await msg.edit(`Anilist data updated, took ${Math.round((endTime - startTime) / 1000)}s.`);
            return;
        }
        if (fullQuery.length > 0) {
            const sTime = performance.now();
            const result = await (0, anilist_1.getAnimeInfoWithScores)(fullQuery, mediaType, message.author.id);
            if (!result) {
                await channel.send(`No ${mediaType.toLowerCase()} found for "${fullQuery}"`);
                return;
            }
            const embed = (0, anilistHelper_1.createAnimeEmbed)(result, sTime, mediaType);
            await channel.send({ embeds: [embed] });
            return;
        }
        await channel.send('Usage:\n' +
            '• `!al <anime name>` or `((anime name))`\n' +
            '• `!alm <manga name>` or `[[manga name]]`\n' +
            '• `!al register <Anilist username>`\n' +
            '• `!al unregister`\n' +
            '• `!al update`');
        return;
    }
    if (message.author.id === index_1.client.user?.id)
        return;
    const guildConfig = message.guild ? (0, db_1.getGuildConfig)(message.guild.id) : null;
    const shouldRespond = !message.guild ||
        !guildConfig ||
        guildConfig.mode === 'everywhere' ||
        guildConfig.channelId === channel.id;
    if (shouldRespond) {
        if (content.search(watashiSearch) > -1) {
            if (content.search(yesWatanabeSearch) > -1) {
                await message.react(config_1.default.reactions.yesWatanabeEmoji);
            }
            else {
                await message.react(config_1.default.reactions.watashiEmoji);
            }
        }
        else if (content.search(smolWatashiSearch) > -1) {
            await message.react(config_1.default.reactions.smolWatashiEmoji);
        }
    }
    if (message.mentions.has(index_1.client.user)) {
        await message.react(config_1.default.reactions.watashiEmoji);
    }
    if (message.webhookId === config_1.default.channels.musicartWebhookId) {
        await translateWebhookMessage(channel, message);
    }
}
async function fixTwitterEmbeds(channel, message) {
    if (message.webhookId && (!message.author || message.author.id !== config_1.default.pluralKitUid))
        return;
    let finalMessage = '';
    const twitterMatches = message.content.match(twitterLinkNew) || [];
    const nitterMatches = message.content.match(nitterLinkNew) || [];
    const allMatches = [...twitterMatches, ...nitterMatches];
    for (const link of allMatches) {
        if (link.includes('vxtwitter') || link.includes('fxtwitter')) {
            continue;
        }
        let fixedLink = '';
        if (link.includes('https://x.com/')) {
            fixedLink = link.replace('x.com', 'vxtwitter.com');
        }
        else if (link.includes('https://twitter.com/')) {
            fixedLink = link.replace('twitter.com', 'vxtwitter.com');
        }
        else if (link.includes('https://nitter.net/')) {
            fixedLink = link.replace('nitter.net', 'vxtwitter.com');
        }
        if (fixedLink && !finalMessage.includes(fixedLink)) {
            finalMessage += fixedLink + '\n';
        }
    }
    if (finalMessage) {
        await channel.send(finalMessage).catch(console.error);
    }
}
const genai_1 = require("@google/genai");
async function translateWebhookMessage(channel, message) {
    console.log('Webhook translation triggered', { webhookId: message.webhookId, expectedWebhookId: config_1.default.channels.musicartWebhookId, content: message.content });
    const apiKey = config_1.default.google.geminiApiKey;
    if (!apiKey) {
        console.error('Gemini API key not configured');
        return;
    }
    const content = message.content;
    console.log('Message content:', content);
    if (!content || content.trim().length === 0) {
        console.log('Empty content, skipping');
        return;
    }
    try {
        const ai = new genai_1.GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Translate this tweet from Japanese to English. Keep any eventual emojis and maintain the original tone. Only respond with the translation:\n\n${content}`,
            config: {
                temperature: 0.1,
                maxOutputTokens: 2048,
            }
        });
        const translatedText = response.text;
        console.log('Translated:', translatedText);
        if (translatedText && translatedText.trim().length > 0) {
            await channel.send(translatedText).catch(console.error);
        }
    }
    catch (err) {
        console.error('Error translating webhook message:', err);
    }
}
//# sourceMappingURL=messageCreate.js.map