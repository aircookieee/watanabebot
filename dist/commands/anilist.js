"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.anilistCommand = exports.mangaCommand = exports.animeCommand = void 0;
const discord_js_1 = require("discord.js");
exports.animeCommand = new discord_js_1.SlashCommandBuilder()
    .setName('anime')
    .setDescription('Search for anime on Anilist')
    .addStringOption((option) => option.setName('query')
    .setDescription('Anime name to search for')
    .setRequired(true));
exports.mangaCommand = new discord_js_1.SlashCommandBuilder()
    .setName('manga')
    .setDescription('Search for manga on Anilist')
    .addStringOption((option) => option.setName('query')
    .setDescription('Manga name to search for')
    .setRequired(true));
exports.anilistCommand = new discord_js_1.SlashCommandBuilder()
    .setName('anilist')
    .setDescription('Manage your Anilist connection')
    .addSubcommand((subcommand) => subcommand
    .setName('register')
    .setDescription('Register your Anilist username')
    .addStringOption((option) => option.setName('username')
    .setDescription('Your Anilist username')
    .setRequired(true)))
    .addSubcommand((subcommand) => subcommand
    .setName('unregister')
    .setDescription('Unregister your Anilist username'))
    .addSubcommand((subcommand) => subcommand
    .setName('refresh')
    .setDescription('Refresh your Anilist data from the server'))
    .addSubcommand((subcommand) => subcommand
    .setName('update')
    .setDescription('Update Anilist data for all users (admin only)'));
//# sourceMappingURL=anilist.js.map