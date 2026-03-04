import { CommandInteraction } from 'discord.js';
import { getWordDefinitions, createWordEmbed } from '../services/wordnik';

export const defineCommand = {
    data: {
        name: 'define',
        description: 'Get word definitions from Wordnik',
    },
    async execute(interaction: CommandInteraction) {
        const query = (interaction as any).options?.get('query')?.value as string;

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
