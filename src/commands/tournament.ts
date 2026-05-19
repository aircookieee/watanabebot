import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, Attachment, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuInteraction, ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import { getActiveTournament, getTournamentMatches, getMatch, getMatchByNumber, getBetsForMatch, getUserBets, getBalance } from '../database/db';
import config from '../config/config';
import axios from 'axios';
import { openTournamentFromBracket, closeAllTournamentMatches, closeTournamentMatch, completeTournament, resolveTournamentMatch, placeTournamentBet, advanceTournamentRound } from '../services/tournaments';
import { canManageTournaments } from '../services/authz';

function formatMatchLabel(match: { roundNumber?: number; matchNumber: number; contestantA: string; contestantB: string }) {
    return `Round ${match.roundNumber ?? 1}, Match ${match.matchNumber}: ${match.contestantA} vs ${match.contestantB}`;
}

export const tournamentCommand = {
    data: new SlashCommandBuilder()
        .setName('tournament')
        .setDescription('Anime Tournament Betting')
        .addSubcommand(sub =>
            sub.setName('open')
                .setDescription('Create a tournament from a JSON bracket file')
                .addStringOption(opt => opt.setName('name').setDescription('Tournament Name').setRequired(true))
                .addAttachmentOption(opt => opt.setName('bracket_file').setDescription('JSON file with matches').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Show current tournament status')
        )
        .addSubcommand(sub =>
            sub.setName('bet')
                .setDescription('Open the interactive betting panel')
        )
        .addSubcommand(sub =>
            sub.setName('mybets')
                .setDescription('Show your active bets')
        )
        .addSubcommand(sub =>
            sub.setName('close')
                .setDescription('Close betting for one or all matches')
                .addIntegerOption(opt => opt.setName('match_number').setDescription('Match Number (e.g. 1)').setRequired(false))
                .addBooleanOption(opt => opt.setName('all').setDescription('Close all open matches').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('resolve')
                .setDescription('Resolve a match')
                .addIntegerOption(opt => opt.setName('match_number').setDescription('Match Number (e.g. 1)').setRequired(true))
                .addStringOption(opt => opt.setName('winner').setDescription('Winner name (exact match)').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('end')
                .setDescription('End the current tournament')
        )
        .addSubcommand(sub =>
            sub.setName('advance')
                .setDescription('Advance to the next round after all current matches are resolved')
        ),
    execute: async (interaction: CommandInteraction) => {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        if (interaction.guild.id !== config.currency.guildId) {
            await interaction.reply({ content: 'Tournaments are not available in this server.', ephemeral: true });
            return;
        }

        const options = (interaction as any).options;
        const subcommand = options.getSubcommand();

        // Tournament manager commands
        if (['open', 'resolve', 'end', 'close', 'advance'].includes(subcommand)) {
            if (!canManageTournaments(interaction.user.id)) {
                await interaction.reply({ content: 'You do not have permission to manage tournaments.', ephemeral: true });
                return;
            }
        }

        const activeTournament = getActiveTournament(interaction.guild.id);

        if (subcommand === 'open') {
            if (activeTournament) {
                await interaction.reply({ content: `A tournament is already active: **${activeTournament.name}**. End it first.`, ephemeral: true });
                return;
            }

            const name = options.getString('name');
            const file = options.getAttachment('bracket_file') as Attachment;

            if (!file.name?.endsWith('.json')) {
                await interaction.reply({ content: 'File must be a .json file.', ephemeral: true });
                return;
            }

            await interaction.deferReply();

            try {
                const response = await axios.get(file.url);
                const data = response.data;

                if (!Array.isArray(data)) {
                    throw new Error('JSON root must be an array of matches.');
                }

                if (data.length === 0) {
                    throw new Error('Bracket array is empty.');
                }

                for (const match of data) {
                    if (typeof match.a !== 'string' || typeof match.b !== 'string') {
                        throw new Error('Each match must have string fields "a" and "b".');
                    }
                }

                openTournamentFromBracket(interaction.user.id, interaction.guild.id, name, data);

                await interaction.editReply(`Successfully opened tournament **${name}** with ${data.length} matches. Betting is now open!`);
            } catch (err: any) {
                await interaction.editReply(`Error parsing bracket JSON: ${err.message}`);
            }
            return;
        }

        if (!activeTournament) {
            await interaction.reply({ content: 'No active tournament.', ephemeral: true });
            return;
        }

        if (subcommand === 'status') {
            const matches = getTournamentMatches(activeTournament.id);
            if (matches.length === 0) {
                await interaction.reply('No matches found for this tournament.');
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0xffaa00)
                .setTitle(`Tournament: ${activeTournament.name}`);

            let desc = '';
            for (const m of matches) {
                const status = m.winner ? `🏆 Winner: ${m.winner}` : (m.bettingOpen ? '🟢 Betting Open' : '🔴 Betting Closed');
                desc += `**${formatMatchLabel(m)}**\n└ Status: ${status}\n`;

                const bets = getBetsForMatch(activeTournament.id, m.id);
                desc += `└ Bets Placed: **${bets.length}**\n\n`;
            }

            embed.setDescription(desc);
            await interaction.reply({ embeds: [embed] });
        } else if (subcommand === 'bet') {
            const matches = getTournamentMatches(activeTournament.id).filter(m => m.bettingOpen);
            if (matches.length === 0) {
                await interaction.reply({ content: 'There are currently no open matches to bet on.', ephemeral: true });
                return;
            }

            const balance = getBalance(interaction.user.id, interaction.guild.id);

            const select = new StringSelectMenuBuilder()
                .setCustomId('tournament_bet_select_match')
                .setPlaceholder('Select a match to bet on');

            for (const m of matches) {
                select.addOptions({
                    label: formatMatchLabel(m).slice(0, 100),
                    value: m.id.toString(),
                });
            }

            const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

            const embed = new EmbedBuilder()
                .setColor(0x00bfff)
                .setTitle(`Betting Panel: ${activeTournament.name}`)
                .setDescription(`Your balance: **${balance} MugCoins**\n\nSelect a match from the dropdown below to view odds and place your bet.`);

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        } else if (subcommand === 'mybets') {
            const bets = getUserBets(activeTournament.id, interaction.user.id);
            if (bets.length === 0) {
                await interaction.reply({ content: 'You have no active bets in this tournament.', ephemeral: true });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle(`Your Bets: ${activeTournament.name}`)
                .setThumbnail(interaction.user.displayAvatarURL());

            let desc = '';
            for (const b of bets) {
                let statusInfo = '';
                if (b.status === 'pending') statusInfo = '🕒 Pending';
                else if (b.status === 'won') statusInfo = `✅ Won (+${b.payout})`;
                else if (b.status === 'lost') statusInfo = '❌ Lost';
                else if (b.status === 'refunded') statusInfo = '↩️ Refunded';

                desc += `**${formatMatchLabel(b)}**\n`;
                desc += `└ Picked: **${b.picked}** | Amount: **${b.amount}** | ${statusInfo}\n\n`;
            }

            embed.setDescription(desc);
            await interaction.reply({ embeds: [embed], ephemeral: true });
        } else if (subcommand === 'close') {
            const matchNumber = options.getInteger('match_number');
            const closeAll = options.getBoolean('all');

            if (!matchNumber && !closeAll) {
                await interaction.reply({ content: 'You must specify either a match_number or set all to true.', ephemeral: true });
                return;
            }

            if (closeAll) {
                await interaction.deferReply();
                const closedCount = closeAllTournamentMatches(interaction.user.id, interaction.guild.id);
                await interaction.editReply(`🔒 Betting has been **closed** for all ${closedCount} open matches! No more bets can be placed.`);
                return;
            }

            await interaction.deferReply();
            const match = closeTournamentMatch(interaction.user.id, interaction.guild.id, matchNumber);
            await interaction.editReply(`🔒 Betting has been **closed** for ${formatMatchLabel(match)}! No more bets can be placed.`);
        } else if (subcommand === 'resolve') {
            const matchNumber = options.getInteger('match_number');
            const winnerRaw = options.getString('winner');
            await interaction.deferReply();
            const result = resolveTournamentMatch(interaction.user.id, interaction.guild.id, matchNumber, winnerRaw!);
            await interaction.editReply(`🏆 ${formatMatchLabel(result.match)} resolved. Winner: **${result.winner}**.`);
            if (result.tournamentEnded) {
                await interaction.followUp(`**All matches have been resolved!** The tournament **${result.tournamentName}** has automatically ended.`);
            }
        } else if (subcommand === 'end') {
            await interaction.deferReply();
            completeTournament(interaction.user.id, interaction.guild.id);
            await interaction.editReply(`Tournament **${activeTournament.name}** has been marked as completed. Pending bets have been refunded.`);
        } else if (subcommand === 'advance') {
            await interaction.deferReply();
            const result = advanceTournamentRound(interaction.user.id, interaction.guild.id);
            await interaction.editReply(`Advanced to round **${result.roundNumber}** with **${result.matchCount}** matches.`);
        }
    }
};

// Component Interaction Handlers

export async function handleSelectMatch(interaction: StringSelectMenuInteraction) {
    const matchId = parseInt(interaction.values[0], 10);
    const match = getMatch(matchId);

    if (!match) {
        await interaction.update({ content: 'Match not found.', components: [] });
        return;
    }

    if (!match.bettingOpen) {
        await interaction.update({ content: 'Betting is closed for this match.', components: [] });
        return;
    }

    const activeTournament = getActiveTournament(interaction.guildId!);
    if (!activeTournament || activeTournament.id !== match.tournamentId) {
        await interaction.update({ content: 'Tournament is no longer active.', components: [] });
        return;
    }

    const balance = getBalance(interaction.user.id, interaction.guildId!);
    const bets = getBetsForMatch(activeTournament.id, matchId);

    let poolA = 0;
    let poolB = 0;
    let userAlreadyBet = false;

    for (const b of bets) {
        if (b.userId === interaction.user.id) userAlreadyBet = true;
        if (b.picked === match.contestantA) poolA += b.amount;
        else if (b.picked === match.contestantB) poolB += b.amount;
    }

    if (userAlreadyBet) {
        const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle(`Betting Panel: ${activeTournament.name}`)
            .setDescription(`You have already placed a bet on ${formatMatchLabel(match)}. You cannot change it.`);
        await interaction.update({ embeds: [embed], components: [] });
        return;
    }

    let desc = `**${formatMatchLabel(match)}**\n\n`;
    desc += `Your balance: **${balance}** MugCoins\n\n`;
    desc += `*Odds and pool sizes are hidden until the match is resolved.*`;

    const embed = new EmbedBuilder()
        .setColor(0x00bfff)
        .setTitle(`Betting Panel: ${activeTournament.name}`)
        .setDescription(desc);

    const btnA = new ButtonBuilder()
        .setCustomId(`tournament_bet_pick_a:${matchId}`)
        .setLabel(`${match.contestantA}`)
        .setStyle(ButtonStyle.Primary);

    const btnB = new ButtonBuilder()
        .setCustomId(`tournament_bet_pick_b:${matchId}`)
        .setLabel(`${match.contestantB}`)
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(btnA, btnB);

    await interaction.update({ embeds: [embed], components: [row] });
}

export async function handleContestantPick(interaction: ButtonInteraction) {
    const customId = interaction.customId;
    const [action, matchIdStr] = customId.split(':');
    const matchId = parseInt(matchIdStr, 10);
    const match = getMatch(matchId);

    if (!match || !match.bettingOpen) {
        await interaction.reply({ content: 'Match not found or betting is closed.', ephemeral: true });
        return;
    }

    const pickedContestant = action === 'tournament_bet_pick_a' ? match.contestantA : match.contestantB;
    const balance = getBalance(interaction.user.id, interaction.guildId!);

    const modal = new ModalBuilder()
        .setCustomId(`tournament_bet_modal:${matchId}:${action === 'tournament_bet_pick_a' ? 'a' : 'b'}`)
        .setTitle(`Bet on ${pickedContestant}`);

    const amountInput = new TextInputBuilder()
        .setCustomId('amountInput')
        .setLabel(`Amount to bet (Balance: ${balance})`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
}

export async function handleBetSubmit(interaction: ModalSubmitInteraction) {
    const customId = interaction.customId;
    const [prefix, matchIdStr, pickLetter] = customId.split(':');
    const matchId = parseInt(matchIdStr, 10);
    const match = getMatch(matchId);

    if (!match || !match.bettingOpen) {
        await interaction.reply({ content: 'Match not found or betting is closed.', ephemeral: true });
        return;
    }

    const amountStr = interaction.fields.getTextInputValue('amountInput');
    const amount = parseInt(amountStr, 10);

    if (isNaN(amount) || amount <= 0) {
        await interaction.reply({ content: 'Please enter a valid positive number.', ephemeral: true });
        return;
    }

    const activeTournament = getActiveTournament(interaction.guildId!);
    if (!activeTournament) {
        await interaction.reply({ content: 'No active tournament.', ephemeral: true });
        return;
    }

    const pickedContestant = pickLetter === 'a' ? match.contestantA : match.contestantB;

    try {
        placeTournamentBet(interaction.guildId!, interaction.user.id, matchId, pickedContestant, amount);
    } catch {
        await interaction.reply({ content: 'Bet failed. You may not have enough MugCoins, or you already placed a bet on this match.', ephemeral: true });
        return;
    }

    const balance = getBalance(interaction.user.id, interaction.guildId!);
    let desc = `✅ **Bet Placed!**\n\n`;
    desc += `**${formatMatchLabel(match)}**\n`;
    desc += `Your pick: **${pickedContestant}**\n`;
    desc += `Amount: **${amount}** MugCoins\n`;
    desc += `Remaining balance: **${balance}** MugCoins\n\n`;
    desc += `*Note: Final odds will be revealed when the match is resolved.*`;

    const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(`Betting Receipt: ${activeTournament.name}`)
        .setDescription(desc);

    // If the original interaction message is accessible (it should be since it's ephemeral), 
    // it's best to update it to avoid multiple ephemeral messages.
    // However, showModal() already acknowledged the interaction.
    // We can use interaction.update() if we triggered this modal from a message component.
    await (interaction as any).update({ embeds: [embed], components: [] });
}
