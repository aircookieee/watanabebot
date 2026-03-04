"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineCommand = void 0;
const wordnik_1 = require("../services/wordnik");
exports.defineCommand = {
    data: {
        name: 'define',
        description: 'Get word definitions from Wordnik',
    },
    async execute(interaction) {
        const query = interaction.options?.get('query')?.value;
        if (!query) {
            await interaction.reply('Please provide a word to define.');
            return;
        }
        await interaction.deferReply();
        try {
            const definitions = await (0, wordnik_1.getWordDefinitions)(query);
            if (!definitions || definitions.length === 0) {
                await interaction.editReply(`No definitions found for "${query}"`);
                return;
            }
            const embed = (0, wordnik_1.createWordEmbed)(definitions);
            if (!embed) {
                await interaction.editReply(`No definitions found for "${query}"`);
                return;
            }
            await interaction.editReply({ embeds: [embed] });
        }
        catch (error) {
            console.error('Error fetching definitions:', error);
            await interaction.editReply('Something went wrong while fetching definitions.');
        }
    },
};
//# sourceMappingURL=definition.js.map