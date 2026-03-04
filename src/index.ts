import { Client, GatewayIntentBits, SlashCommandBuilder } from 'discord.js';
import config from './config/config';
import { initDatabase } from './database/db';
import * as ready from './events/ready';
import * as messageCreate from './events/messageCreate';
import * as interactionCreate from './events/interactionCreate';

export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
});

client.once(ready.name, ready.execute as any);
client.on(messageCreate.name, messageCreate.execute as any);
client.on(interactionCreate.name, interactionCreate.execute as any);

async function deployCommands() {
    const { REST, Routes } = await import('discord.js');
    const rest = new REST({ version: '10' }).setToken(config.discord.token);

    const commands = [
        new SlashCommandBuilder()
            .setName('anime')
            .setDescription('Search for anime on Anilist')
            .addStringOption(opt => opt.setName('query').setDescription('Anime name').setRequired(true)),
        new SlashCommandBuilder()
            .setName('manga')
            .setDescription('Search for manga on Anilist')
            .addStringOption(opt => opt.setName('query').setDescription('Manga name').setRequired(true)),
        new SlashCommandBuilder()
            .setName('anilist')
            .setDescription('Manage Anilist connection')
            .addSubcommand(sub => sub.setName('register').setDescription('Register username').addStringOption(opt => opt.setName('username').setDescription('Anilist username').setRequired(true)))
            .addSubcommand(sub => sub.setName('unregister').setDescription('Unregister'))
            .addSubcommand(sub => sub.setName('update').setDescription('Update Anilist data for all users')),
        new SlashCommandBuilder()
            .setName('define')
            .setDescription('Get word definitions')
            .addStringOption(opt => opt.setName('query').setDescription('Word to define').setRequired(true)),
        new SlashCommandBuilder()
            .setName('pick')
            .setDescription('Random picker')
            .addStringOption(opt => opt.setName('options').setDescription('Comma-separated options').setRequired(true)),
        new SlashCommandBuilder()
            .setName('yousoro')
            .setDescription('Yousoro~!')
            .addSubcommand(sub => sub.setName('info').setDescription('Show help'))
            .addSubcommand(sub => sub.setName('here').setDescription('React only here'))
            .addSubcommand(sub => sub.setName('everywhere').setDescription('React everywhere'))
            .addSubcommand(sub => sub.setName('twitter').setDescription('Twitter toggle').addStringOption(opt => opt.setName('toggle').setDescription('on/off').setRequired(true).addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' }))),
    ];

    try {
        console.log('Deploying slash commands...');
        
        if (config.discord.guildId) {
            await rest.put(
                Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
                { body: commands }
            );
            console.log('Guild commands deployed');
        } else {
            await rest.put(
                Routes.applicationCommands(config.discord.clientId),
                { body: commands }
            );
            console.log('Global commands deployed');
        }
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
}

async function main() {
    console.log('Initializing database...');
    await initDatabase();

    await deployCommands();

    console.log('Logging in...');
    await client.login(config.discord.token);
}

main();
