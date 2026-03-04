import { SlashCommandBuilder } from 'discord.js';

export const defineCommand = {
    data: new SlashCommandBuilder()
        .setName('define')
        .setDescription('Get word definitions')
        .addStringOption((option) =>
            option.setName('query')
                .setDescription('The word to define')
                .setRequired(true)
        ),
    execute: async (interaction: any) => {
        const { getWordDefinitions, createWordEmbed } = await import('../services/wordnik');
        const query = interaction.options.getString('query');

        if (!query) {
            await interaction.reply('Please provide a word to define.');
            return;
        }

        await interaction.deferReply();

        try {
            const definitions = await getWordDefinitions(query);

            if (!definitions || definitions.length === 0) {
                await interaction.editReply(`No definitions found for "${query}"`);
                return;
            }

            const embed = createWordEmbed(definitions);

            if (!embed) {
                await interaction.editReply(`No definitions found for "${query}"`);
                return;
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching definitions:', error);
            await interaction.editReply('Something went wrong while fetching definitions.');
        }
    },
};

export const pickerCommand = {
    data: new SlashCommandBuilder()
        .setName('pick')
        .setDescription('Randomly pick from a list of options')
        .addStringOption((option) =>
            option.setName('options')
                .setDescription('Comma-separated options')
                .setRequired(true)
        ),
    execute: async (interaction: any) => {
        const optionsStr = interaction.options.getString('options');

        if (!optionsStr) {
            await interaction.reply('Usage: /pick option1, option2, option3');
            return;
        }

        const options = optionsStr
            .split(',')
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0);

        if (options.length < 2) {
            await interaction.reply('Please provide at least two options, separated by commas.');
            return;
        }

        const choice = options[Math.floor(Math.random() * options.length)];
        await interaction.reply(`I pick: ${choice}`);
    },
};

export const yousoroCommand = {
    data: new SlashCommandBuilder()
        .setName('yousoro')
        .setDescription('Yousoro~! Configure reaction settings')
        .addSubcommand((sub) =>
            sub.setName('info').setDescription('Show yousoro help')
        )
        .addSubcommand((sub) =>
            sub.setName('here').setDescription('React only in this channel')
        )
        .addSubcommand((sub) =>
            sub.setName('everywhere').setDescription('React in all channels')
        )
        .addSubcommand((sub) =>
            sub.setName('twitter')
                .setDescription('Toggle Twitter link replacement')
                .addStringOption((opt) =>
                    opt.setName('toggle')
                        .setDescription('on or off')
                        .setRequired(true)
                        .addChoices(
                            { name: 'on', value: 'on' },
                            { name: 'off', value: 'off' }
                        )
                )
        ),
    execute: async (interaction: any) => {
        const { getGuildConfig, setGuildConfig, getSetting, setSetting } = await import('../database/db');
        
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'info': {
                await interaction.reply({
                    content: 'Yousoro, sailor!\n\n' +
                        '`/yousoro here` - makes me react only in this channel\n' +
                        '`/yousoro everywhere` - makes me react in all channels\n' +
                        '`/yousoro twitter on/off` - turn twitter link replacement on or off',
                    files: [{ attachment: 'resources/ohayousoro.png' }],
                });
                break;
            }
            case 'here': {
                if (!interaction.guild || !interaction.channel) {
                    await interaction.reply('This command must be used in a server.');
                    return;
                }

                setGuildConfig(interaction.guild.id, interaction.channel.id, 'here');
                await interaction.reply({
                    content: 'Yousoro~!',
                    files: [{ attachment: 'resources/yousoroHere.png' }],
                });
                break;
            }
            case 'everywhere': {
                if (!interaction.guild) {
                    await interaction.reply('This command must be used in a server.');
                    return;
                }

                setGuildConfig(interaction.guild.id, '', 'everywhere');
                await interaction.reply({
                    content: 'Zensokuzenshin... Yousoro~!',
                    files: [{ attachment: 'resources/yousoroEverywhere.jpg' }],
                });
                break;
            }
            case 'twitter': {
                const toggle = interaction.options.getString('toggle');
                const twitterEnabled = toggle === 'on';
                setSetting('twitter_enabled', twitterEnabled.toString());

                await interaction.reply(`Twitter Link Replacement is **${twitterEnabled ? 'ON' : 'OFF'}**`);
                break;
            }
        }
    },
};
