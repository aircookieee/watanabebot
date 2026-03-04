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
Object.defineProperty(exports, "__esModule", { value: true });
exports.yousoroCommand = exports.pickerCommand = exports.defineCommand = void 0;
const discord_js_1 = require("discord.js");
exports.defineCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('define')
        .setDescription('Get word definitions')
        .addStringOption((option) => option.setName('query')
        .setDescription('The word to define')
        .setRequired(true)),
    execute: async (interaction) => {
        const { getWordDefinitions, createWordEmbed } = await Promise.resolve().then(() => __importStar(require('../services/wordnik')));
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
        }
        catch (error) {
            console.error('Error fetching definitions:', error);
            await interaction.editReply('Something went wrong while fetching definitions.');
        }
    },
};
exports.pickerCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('pick')
        .setDescription('Randomly pick from a list of options')
        .addStringOption((option) => option.setName('options')
        .setDescription('Comma-separated options')
        .setRequired(true)),
    execute: async (interaction) => {
        const optionsStr = interaction.options.getString('options');
        if (!optionsStr) {
            await interaction.reply('Usage: /pick option1, option2, option3');
            return;
        }
        const options = optionsStr
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        if (options.length < 2) {
            await interaction.reply('Please provide at least two options, separated by commas.');
            return;
        }
        const choice = options[Math.floor(Math.random() * options.length)];
        await interaction.reply(`I pick: ${choice}`);
    },
};
exports.yousoroCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('yousoro')
        .setDescription('Yousoro~! Configure reaction settings')
        .addSubcommand((sub) => sub.setName('info').setDescription('Show yousoro help'))
        .addSubcommand((sub) => sub.setName('here').setDescription('React only in this channel'))
        .addSubcommand((sub) => sub.setName('everywhere').setDescription('React in all channels'))
        .addSubcommand((sub) => sub.setName('twitter')
        .setDescription('Toggle Twitter link replacement')
        .addStringOption((opt) => opt.setName('toggle')
        .setDescription('on or off')
        .setRequired(true)
        .addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' }))),
    execute: async (interaction) => {
        const { getGuildConfig, setGuildConfig, getSetting, setSetting } = await Promise.resolve().then(() => __importStar(require('../database/db')));
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
//# sourceMappingURL=index.js.map