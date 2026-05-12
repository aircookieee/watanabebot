import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, User } from 'discord.js';
import { getBalance, getLeaderboard, setBalance, addCurrency, spendCurrency, transferCurrency } from '../database/db';
import config from '../config/config';

export const currencyCommand = {
    data: new SlashCommandBuilder()
        .setName('mugcoin')
        .setDescription('Manage your MugCoins')
        .addSubcommand(sub =>
            sub.setName('balance')
                .setDescription('Check your MugCoin balance')
                .addUserOption(opt => opt.setName('user').setDescription('User to check (optional)'))
        )
        .addSubcommand(sub =>
            sub.setName('leaderboard')
                .setDescription('View the top 10 richest users')
        )
        .addSubcommand(sub =>
            sub.setName('pay')
                .setDescription('Pay MugCoins to another user')
                .addUserOption(opt => opt.setName('user').setDescription('User to pay').setRequired(true))
                .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to pay').setRequired(true))
        )
        .addSubcommandGroup(group =>
            group.setName('admin')
                .setDescription('Admin commands')
                .addSubcommand(sub =>
                    sub.setName('set')
                        .setDescription('Set a user\'s balance')
                        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
                        .addIntegerOption(opt => opt.setName('amount').setDescription('New balance').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('give')
                        .setDescription('Give MugCoins to a user')
                        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
                        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to give').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub.setName('take')
                        .setDescription('Take MugCoins from a user')
                        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
                        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to take').setRequired(true))
                )
        ),
    execute: async (interaction: CommandInteraction) => {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        if (interaction.guild.id !== config.currency.guildId) {
            await interaction.reply({ content: 'MugCoins cannot be used in this server.', ephemeral: true });
            return;
        }

        const options = (interaction as any).options;
        const group = options.getSubcommandGroup(false);
        const subcommand = options.getSubcommand();

        if (group === 'admin') {
            if (interaction.user.id !== config.admin.userId) {
                await interaction.reply({ content: 'You do not have permission to use admin commands.', ephemeral: true });
                return;
            }

            const targetUser = options.getUser('user') as User;
            const amount = options.getInteger('amount') as number;

            if (subcommand === 'set') {
                if (amount < 0) {
                    await interaction.reply({ content: 'Balance cannot be negative.', ephemeral: true });
                    return;
                }
                setBalance(targetUser.id, interaction.guild.id, amount, 'admin_set');
                await interaction.reply(`Set ${targetUser.username}'s balance to **${amount}** MugCoins.`);
            } else if (subcommand === 'give') {
                if (amount <= 0) {
                    await interaction.reply({ content: 'Amount must be positive.', ephemeral: true });
                    return;
                }
                addCurrency(targetUser.id, interaction.guild.id, amount, 'admin_give');
                await interaction.reply(`Gave **${amount}** MugCoins to ${targetUser.username}.`);
            } else if (subcommand === 'take') {
                if (amount <= 0) {
                    await interaction.reply({ content: 'Amount must be positive.', ephemeral: true });
                    return;
                }
                const success = spendCurrency(targetUser.id, interaction.guild.id, amount, 'admin_take');
                if (success) {
                    await interaction.reply(`Took **${amount}** MugCoins from ${targetUser.username}.`);
                } else {
                    await interaction.reply({ content: `${targetUser.username} does not have enough MugCoins.`, ephemeral: true });
                }
            }
            return;
        }

        if (subcommand === 'balance') {
            const targetUser = options.getUser('user') || interaction.user;
            const balance = getBalance(targetUser.id, interaction.guild.id);

            const embed = new EmbedBuilder()
                .setColor(0x00bfff) // You Watanabe color
                .setTitle(`${targetUser.username}'s Wallet`)
                .setDescription(`**Balance:** ${balance} MugCoins`)
                .setThumbnail(targetUser.displayAvatarURL());

            await interaction.reply({ embeds: [embed] });
        } else if (subcommand === 'leaderboard') {
            const leaderboard = getLeaderboard(interaction.guild.id, 10);

            if (leaderboard.length === 0) {
                await interaction.reply('No users have MugCoins yet.');
                return;
            }

            let description = '';
            for (let i = 0; i < leaderboard.length; i++) {
                const entry = leaderboard[i];
                description += `**${i + 1}.** <@${entry.userId}> — ${entry.balance} MugCoins\n`;
            }

            const embed = new EmbedBuilder()
                .setColor(0x00bfff)
                .setTitle('MugCoin Leaderboard')
                .setDescription(description);

            await interaction.reply({ embeds: [embed] });
        } else if (subcommand === 'pay') {
            const targetUser = options.getUser('user') as User;
            const amount = options.getInteger('amount') as number;

            if (targetUser.id === interaction.user.id) {
                await interaction.reply({ content: 'You cannot send MugCoins to yourself.', ephemeral: true });
                return;
            }

            if (amount <= 0) {
                await interaction.reply({ content: 'Amount must be greater than 0.', ephemeral: true });
                return;
            }

            if (targetUser.bot) {
                await interaction.reply({ content: 'You cannot send MugCoins to bots.', ephemeral: true });
                return;
            }

            const success = transferCurrency(interaction.user.id, targetUser.id, interaction.guild.id, amount);
            if (!success) {
                await interaction.reply({ content: 'Insufficient funds.', ephemeral: true });
                return;
            }

            await interaction.reply(`**${interaction.user.username}** has sent **${amount}** MugCoins to **${targetUser.username}**!`);
        }
    }
};
