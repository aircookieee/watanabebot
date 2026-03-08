import { Events, Message, TextChannel, DMChannel } from 'discord.js';
import { getAnimeInfoWithScores, registerUser, unregisterUser, updateAllUserData } from '../services/anilist';
import { getGuildConfig, setGuildConfig, getSetting, setSetting } from '../database/db';
import { createAnimeEmbed } from './anilistHelper';
import config from '../config/config';
import { client } from '../index';

const watashiSearch = /(?<![a-zA-Z])You(?!\s*\(not [Ww]atanabe\)|[a-zA-Z])/gm;
const smolWatashiSearch = /(?<![a-zA-Z])you-chan(?!\s*\(not [Ww]atanabe\)|[a-zA-Z])/gm;
const yesWatanabeSearch = /\(yes [Ww]atanabe\)/gm;
const twitterLinkNew = /(https:\/\/((x.com)|(twitter.com))\/(\w+)(\/(\w+)\/(\w+))?)/gi;
const nitterLinkNew = /(https:\/\/nitter\.net\/(\w+)(\/(\w+)\/(\w+))?)/gi;
const commandSearch = /^!yousoro(?:$| (.+))/;
const animeBracketSearch = /\(\(+.+?\)\)/gm;
const mangaBracketSearch = /\[\[+.+?\]\]/gm;

export const name = Events.MessageCreate;

export async function execute(message: Message): Promise<void> {
    if (message.author.bot && !message.webhookId) return;

    const channel = message.channel;
    if (!(channel instanceof TextChannel) && !(channel instanceof DMChannel)) return;

    const content = message.content;

    if (content.includes('https://x.com/') || content.includes('https://twitter.com/') || content.includes('https://nitter.net/')) {
        const twitterEnabled = getSetting('twitter_enabled');
        if (twitterEnabled === 'true') {
            await fixTwitterEmbeds(channel, message);
        }
    }

    const command = content.match(commandSearch);
    if (command) {
        if (channel instanceof DMChannel) {
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
        } else if (command[1]) {
            const arg = command[1];
            if (arg === 'here') {
                if (!message.guild) return;
                setGuildConfig(message.guild.id, channel.id, 'here');
                await channel.send({
                    content: 'Yousoro~!',
                    files: [{ attachment: 'resources/yousoroHere.png' }],
                });
            } else if (arg === 'everywhere') {
                if (!message.guild) return;
                setGuildConfig(message.guild.id, '', 'everywhere');
                await channel.send({
                    content: 'Zensokuzenshin... Yousoro~!',
                    files: [{ attachment: 'resources/yousoroEverywhere.jpg' }],
                });
            } else if (arg === 'twitter on') {
                setSetting('twitter_enabled', 'true');
                await channel.send('Twitter Link Replacement is **ON**');
            } else if (arg === 'twitter off') {
                setSetting('twitter_enabled', 'false');
                await channel.send('Twitter Link Replacement is **OFF**');
            } else {
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
        
        const { getWordDefinitions, createWordEmbed } = await import('../services/wordnik');
        
        try {
            const data = await getWordDefinitions(word);
            if (!data || data.length === 0) {
                await channel.send(`No definitions found for "${word}"`);
                return;
            }
            const embed = createWordEmbed(data);
            if (embed) {
                await channel.send({ embeds: [embed] });
            } else {
                await channel.send(`No definitions found for "${word}"`);
            }
        } catch (error) {
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

    let mediaType: 'ANIME' | 'MANGA' = 'ANIME';
    let animeMatch = content.match(animeBracketSearch);
    let mangaMatch = content.match(mangaBracketSearch);

    if (content.startsWith('!al') || content.startsWith('!alm') || animeMatch || mangaMatch) {
        let searchQuery = content;

        if (mangaMatch) {
            const mangaName = mangaMatch[0].replace(/[\[\]]/gm, '').trim();
            searchQuery = `!alm ${mangaName}`;
            mediaType = 'MANGA';
        } else if (animeMatch) {
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
            await registerUser(message.author.id, args[1]);
            await channel.send(`Registered \`${args[1]}\` to <@${message.author.id}>.`);
            return;
        }

        if (sub === 'unregister') {
            const success = unregisterUser(message.author.id);
            if (success) {
                await channel.send(`Unregistered <@${message.author.id}>.`);
            } else {
                await channel.send(`Could not unregister <@${message.author.id}>.`);
            }
            return;
        }

        if (sub === 'update') {
            const msg = await channel.send('Updating Anilist data...');
            const startTime = performance.now();
            await updateAllUserData();
            const endTime = performance.now();
            await msg.edit(`Anilist data updated, took ${Math.round((endTime - startTime) / 1000)}s.`);
            return;
        }

        if (fullQuery.length > 0) {
            const sTime = performance.now();
            const result = await getAnimeInfoWithScores(fullQuery, mediaType, message.author.id);

            if (!result) {
                await channel.send(`No ${mediaType.toLowerCase()} found for "${fullQuery}"`);
                return;
            }

            const embed = createAnimeEmbed(result, sTime, mediaType);
            await channel.send({ embeds: [embed] });
            return;
        }

        await channel.send(
            'Usage:\n' +
            '• `!al <anime name>` or `((anime name))`\n' +
            '• `!alm <manga name>` or `[[manga name]]`\n' +
            '• `!al register <Anilist username>`\n' +
            '• `!al unregister`\n' +
            '• `!al update`'
        );
        return;
    }

    if (message.author.id === client.user?.id) return;

    const guildConfig = message.guild ? getGuildConfig(message.guild.id) : null;
    const shouldRespond = !message.guild || 
        !guildConfig || 
        guildConfig.mode === 'everywhere' || 
        guildConfig.channelId === channel.id;

    if (shouldRespond) {
        if (content.search(watashiSearch) > -1) {
            if (content.search(yesWatanabeSearch) > -1) {
                await message.react(config.reactions.yesWatanabeEmoji);
            } else {
                await message.react(config.reactions.watashiEmoji);
            }
        } else if (content.search(smolWatashiSearch) > -1) {
            await message.react(config.reactions.smolWatashiEmoji);
        }
    }

    if (message.mentions.has(client.user!)) {
        await message.react(config.reactions.watashiEmoji);
    }

    if (message.webhookId === config.channels.musicartWebhookId) {
        await translateWebhookMessage(channel, message);
    }
}

async function fixTwitterEmbeds(channel: TextChannel | DMChannel, message: Message): Promise<void> {
    if (message.webhookId && (!message.author || message.author.id !== config.pluralKitUid)) return;

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
        } else if (link.includes('https://twitter.com/')) {
            fixedLink = link.replace('twitter.com', 'vxtwitter.com');
        } else if (link.includes('https://nitter.net/')) {
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

async function translateWebhookMessage(channel: TextChannel | DMChannel, message: Message): Promise<void> {
    const apiKey = config.google.geminiApiKey;
    if (!apiKey) {
        console.error('Gemini API key not configured');
        return;
    }

    const content = message.content;
    if (!content || content.trim().length === 0) return;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Translate the following message to English. Only respond with the translation, nothing else:\n\n${content}` }] }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 2048,
                }
            })
        });

        if (!response.ok) {
            console.error('Gemini API error:', response.status, await response.text());
            return;
        }

        const json = await response.json() as any;
        const translatedText = json.candidates?.[0]?.content?.parts?.[0]?.text;

        if (translatedText && translatedText.trim().length > 0) {
            await channel.send(translatedText).catch(console.error);
        }
    } catch (err) {
        console.error('Error translating webhook message:', err);
    }
}
