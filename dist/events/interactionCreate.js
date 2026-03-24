"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const anilist_1 = require("../services/anilist");
const index_1 = require("../commands/index");
const anilistHelper_1 = require("./anilistHelper");
const commands = {
    '/anime': async (interaction) => {
        const query = interaction.options.getString('query');
        if (anilist_1.isUpdateInProgress) {
            await interaction.reply({ content: 'Anilist data is currently being updated. Please wait a moment and try again.', flags: 64 });
            return;
        }
        const sTime = performance.now();
        await interaction.deferReply();
        const result = await (0, anilist_1.getAnimeInfoWithScores)(query, 'ANIME');
        if (!result) {
            await interaction.editReply(`No anime found for "${query}"`);
            return;
        }
        const embed = (0, anilistHelper_1.createAnimeEmbed)(result, sTime);
        await interaction.editReply({ embeds: [embed] });
    },
    '/manga': async (interaction) => {
        const query = interaction.options.getString('query');
        if (anilist_1.isUpdateInProgress) {
            await interaction.reply({ content: 'Anilist data is currently being updated. Please wait a moment and try again.', flags: 64 });
            return;
        }
        const sTime = performance.now();
        await interaction.deferReply();
        const result = await (0, anilist_1.getAnimeInfoWithScores)(query, 'MANGA');
        if (!result) {
            await interaction.editReply(`No manga found for "${query}"`);
            return;
        }
        const embed = (0, anilistHelper_1.createAnimeEmbed)(result, sTime, 'MANGA');
        await interaction.editReply({ embeds: [embed] });
    },
    '/anilist': async (interaction) => {
        const subcommand = interaction.options.getSubcommand();
        switch (subcommand) {
            case 'register': {
                const username = interaction.options.getString('username');
                await interaction.deferReply();
                const success = await (0, anilist_1.registerUser)(interaction.user.id, username);
                if (success) {
                    await interaction.editReply(`Registered \`${username}\` to <@${interaction.user.id}>.`);
                }
                else {
                    await interaction.editReply(`Anilist username \`${username}\` is already registered to another user.`);
                }
                break;
            }
            case 'unregister': {
                const success = (0, anilist_1.unregisterUser)(interaction.user.id);
                if (success) {
                    await interaction.reply(`Unregistered <@${interaction.user.id}>.`);
                }
                else {
                    await interaction.reply(`Could not unregister <@${interaction.user.id}>.`);
                }
                break;
            }
            case 'update': {
                await interaction.deferReply();
                const startTime = performance.now();
                await (0, anilist_1.updateAllUserData)();
                const endTime = performance.now();
                await interaction.editReply(`Anilist data updated, took ${Math.round((endTime - startTime) / 1000)}s.`);
                break;
            }
        }
    },
    '/define': async (interaction) => {
        await index_1.defineCommand.execute(interaction);
    },
    '/pick': async (interaction) => {
        await index_1.pickerCommand.execute(interaction);
    },
    '/yousoro': async (interaction) => {
        await index_1.yousoroCommand.execute(interaction);
    },
};
exports.name = discord_js_1.Events.InteractionCreate;
async function execute(interaction, client) {
    if (!interaction.isCommand())
        return;
    const commandName = `/${interaction.commandName}`;
    const handler = commands[commandName];
    if (handler) {
        await handler(interaction);
    }
}
//# sourceMappingURL=interactionCreate.js.map