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
exports.client = void 0;
const discord_js_1 = require("discord.js");
const config_1 = __importDefault(require("./config/config"));
const db_1 = require("./database/db");
const ready = __importStar(require("./events/ready"));
const messageCreate = __importStar(require("./events/messageCreate"));
const interactionCreate = __importStar(require("./events/interactionCreate"));
exports.client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.DirectMessages,
    ],
});
exports.client.once(ready.name, ready.execute);
exports.client.on(messageCreate.name, messageCreate.execute);
exports.client.on(interactionCreate.name, interactionCreate.execute);
async function deployCommands() {
    const { REST, Routes } = await Promise.resolve().then(() => __importStar(require('discord.js')));
    const rest = new REST({ version: '10' }).setToken(config_1.default.discord.token);
    const commands = [
        new discord_js_1.SlashCommandBuilder()
            .setName('anime')
            .setDescription('Search for anime on Anilist')
            .addStringOption(opt => opt.setName('query').setDescription('Anime name').setRequired(true)),
        new discord_js_1.SlashCommandBuilder()
            .setName('manga')
            .setDescription('Search for manga on Anilist')
            .addStringOption(opt => opt.setName('query').setDescription('Manga name').setRequired(true)),
        new discord_js_1.SlashCommandBuilder()
            .setName('anilist')
            .setDescription('Manage Anilist connection')
            .addSubcommand(sub => sub.setName('register').setDescription('Register username').addStringOption(opt => opt.setName('username').setDescription('Anilist username').setRequired(true)))
            .addSubcommand(sub => sub.setName('unregister').setDescription('Unregister'))
            .addSubcommand(sub => sub.setName('update').setDescription('Update Anilist data for all users')),
        new discord_js_1.SlashCommandBuilder()
            .setName('define')
            .setDescription('Get word definitions')
            .addStringOption(opt => opt.setName('query').setDescription('Word to define').setRequired(true)),
        new discord_js_1.SlashCommandBuilder()
            .setName('pick')
            .setDescription('Random picker')
            .addStringOption(opt => opt.setName('options').setDescription('Comma-separated options').setRequired(true)),
        new discord_js_1.SlashCommandBuilder()
            .setName('yousoro')
            .setDescription('Yousoro~!')
            .addSubcommand(sub => sub.setName('info').setDescription('Show help'))
            .addSubcommand(sub => sub.setName('here').setDescription('React only here'))
            .addSubcommand(sub => sub.setName('everywhere').setDescription('React everywhere'))
            .addSubcommand(sub => sub.setName('twitter').setDescription('Twitter toggle').addStringOption(opt => opt.setName('toggle').setDescription('on/off').setRequired(true).addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' }))),
    ];
    try {
        console.log('Deploying slash commands...');
        if (config_1.default.discord.guildId) {
            await rest.put(Routes.applicationGuildCommands(config_1.default.discord.clientId, config_1.default.discord.guildId), { body: commands });
            console.log('Guild commands deployed');
        }
        else {
            await rest.put(Routes.applicationCommands(config_1.default.discord.clientId), { body: commands });
            console.log('Global commands deployed');
        }
    }
    catch (error) {
        console.error('Error deploying commands:', error);
    }
}
async function main() {
    console.log('Initializing database...');
    await (0, db_1.initDatabase)();
    await deployCommands();
    console.log('Logging in...');
    await exports.client.login(config_1.default.discord.token);
}
main();
//# sourceMappingURL=index.js.map