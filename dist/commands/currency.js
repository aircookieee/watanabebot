"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.currencyCommand = void 0;
const discord_js_1 = require("discord.js");
const db_1 = require("../database/db");
const config_1 = __importDefault(require("../config/config"));
exports.currencyCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('youcoin')
        .setDescription('Manage your YouCoins')
        .addSubcommand(sub => sub.setName('balance')
        .setDescription('Check your YouCoin balance')
        .addUserOption(opt => opt.setName('user').setDescription('User to check (optional)')))
        .addSubcommand(sub => sub.setName('leaderboard')
        .setDescription('View the top 10 richest users'))
        .addSubcommand(sub => sub.setName('pay')
        .setDescription('Pay YouCoins to another user')
        .addUserOption(opt => opt.setName('user').setDescription('User to pay').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to pay').setRequired(true)))
        .addSubcommandGroup(group => group.setName('admin')
        .setDescription('Admin commands')
        .addSubcommand(sub => sub.setName('set')
        .setDescription('Set a user\'s balance')
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('New balance').setRequired(true)))
        .addSubcommand(sub => sub.setName('give')
        .setDescription('Give YouCoins to a user')
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to give').setRequired(true)))
        .addSubcommand(sub => sub.setName('take')
        .setDescription('Take YouCoins from a user')
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to take').setRequired(true)))),
    execute: async (interaction) => {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }
        if (interaction.guild.id !== config_1.default.currency.guildId) {
            await interaction.reply({ content: 'YouCoins cannot be used in this server.', ephemeral: true });
            return;
        }
        const options = interaction.options;
        const group = options.getSubcommandGroup(false);
        const subcommand = options.getSubcommand();
        if (group === 'admin') {
            if (interaction.user.id !== config_1.default.admin.userId) {
                await interaction.reply({ content: 'You do not have permission to use admin commands.', ephemeral: true });
                return;
            }
            const targetUser = options.getUser('user');
            const amount = options.getInteger('amount');
            if (subcommand === 'set') {
                if (amount < 0) {
                    await interaction.reply({ content: 'Balance cannot be negative.', ephemeral: true });
                    return;
                }
                (0, db_1.setBalance)(targetUser.id, interaction.guild.id, amount, 'admin_set');
                await interaction.reply(`Set ${targetUser.username}'s balance to **${amount}** YouCoins.`);
            }
            else if (subcommand === 'give') {
                if (amount <= 0) {
                    await interaction.reply({ content: 'Amount must be positive.', ephemeral: true });
                    return;
                }
                (0, db_1.addCurrency)(targetUser.id, interaction.guild.id, amount, 'admin_give');
                await interaction.reply(`Gave **${amount}** YouCoins to ${targetUser.username}.`);
            }
            else if (subcommand === 'take') {
                if (amount <= 0) {
                    await interaction.reply({ content: 'Amount must be positive.', ephemeral: true });
                    return;
                }
                const success = (0, db_1.spendCurrency)(targetUser.id, interaction.guild.id, amount, 'admin_take');
                if (success) {
                    await interaction.reply(`Took **${amount}** YouCoins from ${targetUser.username}.`);
                }
                else {
                    await interaction.reply({ content: `${targetUser.username} does not have enough YouCoins.`, ephemeral: true });
                }
            }
            return;
        }
        if (subcommand === 'balance') {
            const targetUser = options.getUser('user') || interaction.user;
            const balance = (0, db_1.getBalance)(targetUser.id, interaction.guild.id);
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0x00bfff) // You Watanabe color
                .setTitle(`${targetUser.username}'s Wallet`)
                .setDescription(`**Balance:** ${balance} YouCoins`)
                .setThumbnail(targetUser.displayAvatarURL());
            await interaction.reply({ embeds: [embed] });
        }
        else if (subcommand === 'leaderboard') {
            const leaderboard = (0, db_1.getLeaderboard)(interaction.guild.id, 10);
            if (leaderboard.length === 0) {
                await interaction.reply('No users have YouCoins yet.');
                return;
            }
            let description = '';
            for (let i = 0; i < leaderboard.length; i++) {
                const entry = leaderboard[i];
                description += `**${i + 1}.** <@${entry.userId}> — ${entry.balance} YouCoins\n`;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0x00bfff)
                .setTitle('YouCoin Leaderboard')
                .setDescription(description);
            await interaction.reply({ embeds: [embed] });
        }
        else if (subcommand === 'pay') {
            const targetUser = options.getUser('user');
            const amount = options.getInteger('amount');
            if (targetUser.id === interaction.user.id) {
                await interaction.reply({ content: 'You cannot send YouCoins to yourself.', ephemeral: true });
                return;
            }
            if (amount <= 0) {
                await interaction.reply({ content: 'Amount must be greater than 0.', ephemeral: true });
                return;
            }
            if (targetUser.bot) {
                await interaction.reply({ content: 'You cannot send YouCoins to bots.', ephemeral: true });
                return;
            }
            const success = (0, db_1.transferCurrency)(interaction.user.id, targetUser.id, interaction.guild.id, amount);
            if (!success) {
                await interaction.reply({ content: 'Insufficient funds.', ephemeral: true });
                return;
            }
            await interaction.reply(`💸 **${interaction.user.username}** has sent **${amount}** YouCoins to **${targetUser.username}**!`);
        }
    }
};
//# sourceMappingURL=currency.js.map