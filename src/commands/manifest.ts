import { SlashCommandBuilder } from 'discord.js';

export async function getSlashCommands() {
    return [
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
        (await import('./currency')).currencyCommand.data,
        (await import('./tournament')).tournamentCommand.data,
    ].map(command => command.toJSON());
}
