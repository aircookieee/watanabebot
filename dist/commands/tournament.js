"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tournamentCommand = void 0;
exports.handleSelectMatch = handleSelectMatch;
exports.handleContestantPick = handleContestantPick;
exports.handleBetSubmit = handleBetSubmit;
const discord_js_1 = require("discord.js");
const db_1 = require("../database/db");
const config_1 = __importDefault(require("../config/config"));
const axios_1 = __importDefault(require("axios"));
exports.tournamentCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('tournament')
        .setDescription('Anime Tournament Betting')
        .addSubcommand(sub => sub.setName('open')
        .setDescription('Create a tournament from a JSON bracket file')
        .addStringOption(opt => opt.setName('name').setDescription('Tournament Name').setRequired(true))
        .addAttachmentOption(opt => opt.setName('bracket_file').setDescription('JSON file with matches').setRequired(true)))
        .addSubcommand(sub => sub.setName('status')
        .setDescription('Show current tournament status'))
        .addSubcommand(sub => sub.setName('bet')
        .setDescription('Open the interactive betting panel'))
        .addSubcommand(sub => sub.setName('mybets')
        .setDescription('Show your active bets'))
        .addSubcommand(sub => sub.setName('close')
        .setDescription('Close betting for one or all matches')
        .addIntegerOption(opt => opt.setName('match_number').setDescription('Match Number (e.g. 1)').setRequired(false))
        .addBooleanOption(opt => opt.setName('all').setDescription('Close all open matches').setRequired(false)))
        .addSubcommand(sub => sub.setName('resolve')
        .setDescription('Resolve a match')
        .addIntegerOption(opt => opt.setName('match_number').setDescription('Match Number (e.g. 1)').setRequired(true))
        .addStringOption(opt => opt.setName('winner').setDescription('Winner name (exact match)').setRequired(true)))
        .addSubcommand(sub => sub.setName('end')
        .setDescription('End the current tournament')),
    execute: async (interaction) => {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }
        if (interaction.guild.id !== config_1.default.currency.guildId) {
            await interaction.reply({ content: 'Tournaments are not available in this server.', ephemeral: true });
            return;
        }
        const options = interaction.options;
        const subcommand = options.getSubcommand();
        // Operator commands
        if (['open', 'resolve', 'end', 'close'].includes(subcommand)) {
            if (interaction.user.id !== config_1.default.tournament.operatorId) {
                await interaction.reply({ content: 'You do not have permission to manage tournaments.', ephemeral: true });
                return;
            }
        }
        const activeTournament = (0, db_1.getActiveTournament)(interaction.guild.id);
        if (subcommand === 'open') {
            if (activeTournament) {
                await interaction.reply({ content: `A tournament is already active: **${activeTournament.name}**. End it first.`, ephemeral: true });
                return;
            }
            const name = options.getString('name');
            const file = options.getAttachment('bracket_file');
            if (!file.name?.endsWith('.json')) {
                await interaction.reply({ content: 'File must be a .json file.', ephemeral: true });
                return;
            }
            await interaction.deferReply();
            try {
                const response = await axios_1.default.get(file.url);
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
                const tournamentId = (0, db_1.createTournament)(interaction.guild.id, name);
                if (!tournamentId)
                    throw new Error('Database error creating tournament.');
                let matchNum = 1;
                for (const match of data) {
                    (0, db_1.addTournamentMatch)(tournamentId, matchNum, match.a, match.b);
                    matchNum++;
                }
                await interaction.editReply(`Successfully opened tournament **${name}** with ${data.length} matches. Betting is now open!`);
            }
            catch (err) {
                await interaction.editReply(`Error parsing bracket JSON: ${err.message}`);
            }
            return;
        }
        if (!activeTournament) {
            await interaction.reply({ content: 'No active tournament.', ephemeral: true });
            return;
        }
        if (subcommand === 'status') {
            const matches = (0, db_1.getTournamentMatches)(activeTournament.id);
            if (matches.length === 0) {
                await interaction.reply('No matches found for this tournament.');
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0xffaa00)
                .setTitle(`Tournament: ${activeTournament.name}`);
            let desc = '';
            for (const m of matches) {
                const status = m.winner ? `🏆 Winner: ${m.winner}` : (m.bettingOpen ? '🟢 Betting Open' : '🔴 Betting Closed');
                desc += `**Match #${m.matchNumber}**: ${m.contestantA} vs ${m.contestantB}\n└ Status: ${status}\n`;
                const bets = (0, db_1.getBetsForMatch)(activeTournament.id, m.id);
                desc += `└ Bets Placed: **${bets.length}**\n\n`;
            }
            embed.setDescription(desc);
            await interaction.reply({ embeds: [embed] });
        }
        else if (subcommand === 'bet') {
            const matches = (0, db_1.getTournamentMatches)(activeTournament.id).filter(m => m.bettingOpen);
            if (matches.length === 0) {
                await interaction.reply({ content: 'There are currently no open matches to bet on.', ephemeral: true });
                return;
            }
            const balance = (0, db_1.getBalance)(interaction.user.id, interaction.guild.id);
            const select = new discord_js_1.StringSelectMenuBuilder()
                .setCustomId('tournament_bet_select_match')
                .setPlaceholder('Select a match to bet on');
            for (const m of matches) {
                select.addOptions({
                    label: `Match #${m.matchNumber}: ${m.contestantA} vs ${m.contestantB}`,
                    value: m.id.toString(),
                });
            }
            const row = new discord_js_1.ActionRowBuilder().addComponents(select);
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0x00bfff)
                .setTitle(`Betting Panel: ${activeTournament.name}`)
                .setDescription(`Your balance: **${balance} MugCoins**\n\nSelect a match from the dropdown below to view odds and place your bet.`);
            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }
        else if (subcommand === 'mybets') {
            const bets = (0, db_1.getUserBets)(activeTournament.id, interaction.user.id);
            if (bets.length === 0) {
                await interaction.reply({ content: 'You have no active bets in this tournament.', ephemeral: true });
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle(`Your Bets: ${activeTournament.name}`)
                .setThumbnail(interaction.user.displayAvatarURL());
            let desc = '';
            for (const b of bets) {
                let statusInfo = '';
                if (b.status === 'pending')
                    statusInfo = '🕒 Pending';
                else if (b.status === 'won')
                    statusInfo = `✅ Won (+${b.payout})`;
                else if (b.status === 'lost')
                    statusInfo = '❌ Lost';
                else if (b.status === 'refunded')
                    statusInfo = '↩️ Refunded';
                desc += `**Match #${b.matchNumber}**: ${b.contestantA} vs ${b.contestantB}\n`;
                desc += `└ Picked: **${b.picked}** | Amount: **${b.amount}** | ${statusInfo}\n\n`;
            }
            embed.setDescription(desc);
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        else if (subcommand === 'close') {
            const matchNumber = options.getInteger('match_number');
            const closeAll = options.getBoolean('all');
            if (!matchNumber && !closeAll) {
                await interaction.reply({ content: 'You must specify either a match_number or set all to true.', ephemeral: true });
                return;
            }
            if (closeAll) {
                await interaction.deferReply();
                const matches = (0, db_1.getTournamentMatches)(activeTournament.id);
                let closedCount = 0;
                for (const m of matches) {
                    if (m.bettingOpen) {
                        (0, db_1.closeBettingForMatch)(m.id);
                        closedCount++;
                    }
                }
                await interaction.editReply(`🔒 Betting has been **closed** for all ${closedCount} open matches! No more bets can be placed.`);
                return;
            }
            const match = (0, db_1.getMatchByNumber)(activeTournament.id, matchNumber);
            if (!match) {
                await interaction.reply({ content: 'Match not found in the current tournament.', ephemeral: true });
                return;
            }
            if (!match.bettingOpen) {
                await interaction.reply({ content: 'Betting is already closed for this match.', ephemeral: true });
                return;
            }
            await interaction.deferReply();
            (0, db_1.closeBettingForMatch)(match.id);
            await interaction.editReply(`🔒 Betting has been **closed** for Match #${match.matchNumber} (${match.contestantA} vs ${match.contestantB})! No more bets can be placed.`);
        }
        else if (subcommand === 'resolve') {
            const matchNumber = options.getInteger('match_number');
            const winnerRaw = options.getString('winner');
            const match = (0, db_1.getMatchByNumber)(activeTournament.id, matchNumber);
            if (!match) {
                await interaction.reply({ content: 'Match not found in the current tournament.', ephemeral: true });
                return;
            }
            if (match.winner) {
                await interaction.reply({ content: 'Match is already resolved.', ephemeral: true });
                return;
            }
            let winner = null;
            if (winnerRaw.toLowerCase() === match.contestantA.toLowerCase())
                winner = match.contestantA;
            else if (winnerRaw.toLowerCase() === match.contestantB.toLowerCase())
                winner = match.contestantB;
            if (!winner) {
                await interaction.reply({ content: `Invalid winner. Must be exactly "${match.contestantA}" or "${match.contestantB}".`, ephemeral: true });
                return;
            }
            await interaction.deferReply();
            const summary = (0, db_1.resolveMatch)(activeTournament.id, match.id, winner);
            if (!summary) {
                await interaction.editReply('Error resolving match.');
                return;
            }
            const bets = (0, db_1.getBetsForMatch)(activeTournament.id, match.id);
            let poolA = 0;
            let poolB = 0;
            for (const b of bets) {
                if (b.picked === match.contestantA)
                    poolA += b.amount;
                else if (b.picked === match.contestantB)
                    poolB += b.amount;
            }
            const totalPool = poolA + poolB;
            const payoutA = totalPool > 0 && poolA > 0 ? (totalPool / poolA).toFixed(2) : '1.00';
            const payoutB = totalPool > 0 && poolB > 0 ? (totalPool / poolB).toFixed(2) : '1.00';
            const pctA = totalPool > 0 ? Math.round((poolA / totalPool) * 100) : 0;
            const pctB = totalPool > 0 ? Math.round((poolB / totalPool) * 100) : 0;
            let desc = `**Match #${match.matchNumber}**: ${match.contestantA} vs ${match.contestantB}\n`;
            desc += `🏆 **Winner: ${winner}**\n\n`;
            desc += `**Final Pool Breakdown:**\n`;
            desc += `**${match.contestantA}**: ${poolA} (${pctA}%) — final payout: **${payoutA}x**\n`;
            desc += `**${match.contestantB}**: ${poolB} (${pctB}%) — final payout: **${payoutB}x**\n`;
            desc += `Total Pool: **${summary.totalPool}** MugCoins\n`;
            if (summary.payouts.length > 0) {
                desc += `\n**Top Payouts:**\n`;
                const sorted = summary.payouts.sort((a, b) => b.payout - a.payout).slice(0, 5);
                for (const p of sorted) {
                    desc += `<@${p.userId}>: +${p.payout} MugCoins\n`;
                }
                if (summary.payouts.length > 5) {
                    desc += `*...and ${summary.payouts.length - 5} more winners*`;
                }
            }
            else {
                desc += '\n*No one bet on the winner.*';
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0xffcc00)
                .setTitle(`Match Resolved!`)
                .setDescription(desc);
            await interaction.editReply({ embeds: [embed] });
            // Auto-end tournament if all matches are resolved
            const allMatches = (0, db_1.getTournamentMatches)(activeTournament.id);
            const allResolved = allMatches.every(m => m.winner !== null);
            if (allResolved) {
                (0, db_1.endTournament)(activeTournament.id);
                await interaction.followUp(`**All matches have been resolved!** The tournament **${activeTournament.name}** has automatically ended.`);
            }
        }
        else if (subcommand === 'end') {
            await interaction.deferReply();
            (0, db_1.endTournament)(activeTournament.id);
            await interaction.editReply(`Tournament **${activeTournament.name}** has been marked as completed. Pending bets have been refunded.`);
        }
    }
};
// Component Interaction Handlers
async function handleSelectMatch(interaction) {
    const matchId = parseInt(interaction.values[0], 10);
    const match = (0, db_1.getMatch)(matchId);
    if (!match) {
        await interaction.update({ content: 'Match not found.', components: [] });
        return;
    }
    if (!match.bettingOpen) {
        await interaction.update({ content: 'Betting is closed for this match.', components: [] });
        return;
    }
    const activeTournament = (0, db_1.getActiveTournament)(interaction.guildId);
    if (!activeTournament || activeTournament.id !== match.tournamentId) {
        await interaction.update({ content: 'Tournament is no longer active.', components: [] });
        return;
    }
    const balance = (0, db_1.getBalance)(interaction.user.id, interaction.guildId);
    const bets = (0, db_1.getBetsForMatch)(activeTournament.id, matchId);
    let poolA = 0;
    let poolB = 0;
    let userAlreadyBet = false;
    for (const b of bets) {
        if (b.userId === interaction.user.id)
            userAlreadyBet = true;
        if (b.picked === match.contestantA)
            poolA += b.amount;
        else if (b.picked === match.contestantB)
            poolB += b.amount;
    }
    if (userAlreadyBet) {
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle(`Betting Panel: ${activeTournament.name}`)
            .setDescription(`You have already placed a bet on Match #${match.matchNumber}. You cannot change it.`);
        await interaction.update({ embeds: [embed], components: [] });
        return;
    }
    let desc = `**Match #${match.matchNumber}**: ${match.contestantA} vs ${match.contestantB}\n\n`;
    desc += `Your balance: **${balance}** MugCoins\n\n`;
    desc += `*Odds and pool sizes are hidden until the match is resolved.*`;
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x00bfff)
        .setTitle(`Betting Panel: ${activeTournament.name}`)
        .setDescription(desc);
    const btnA = new discord_js_1.ButtonBuilder()
        .setCustomId(`tournament_bet_pick_a:${matchId}`)
        .setLabel(`${match.contestantA}`)
        .setStyle(discord_js_1.ButtonStyle.Primary);
    const btnB = new discord_js_1.ButtonBuilder()
        .setCustomId(`tournament_bet_pick_b:${matchId}`)
        .setLabel(`${match.contestantB}`)
        .setStyle(discord_js_1.ButtonStyle.Danger);
    const row = new discord_js_1.ActionRowBuilder().addComponents(btnA, btnB);
    await interaction.update({ embeds: [embed], components: [row] });
}
async function handleContestantPick(interaction) {
    const customId = interaction.customId;
    const [action, matchIdStr] = customId.split(':');
    const matchId = parseInt(matchIdStr, 10);
    const match = (0, db_1.getMatch)(matchId);
    if (!match || !match.bettingOpen) {
        await interaction.reply({ content: 'Match not found or betting is closed.', ephemeral: true });
        return;
    }
    const pickedContestant = action === 'tournament_bet_pick_a' ? match.contestantA : match.contestantB;
    const balance = (0, db_1.getBalance)(interaction.user.id, interaction.guildId);
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId(`tournament_bet_modal:${matchId}:${action === 'tournament_bet_pick_a' ? 'a' : 'b'}`)
        .setTitle(`Bet on ${pickedContestant}`);
    const amountInput = new discord_js_1.TextInputBuilder()
        .setCustomId('amountInput')
        .setLabel(`Amount to bet (Balance: ${balance})`)
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(true);
    const row = new discord_js_1.ActionRowBuilder().addComponents(amountInput);
    modal.addComponents(row);
    await interaction.showModal(modal);
}
async function handleBetSubmit(interaction) {
    const customId = interaction.customId;
    const [prefix, matchIdStr, pickLetter] = customId.split(':');
    const matchId = parseInt(matchIdStr, 10);
    const match = (0, db_1.getMatch)(matchId);
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
    const activeTournament = (0, db_1.getActiveTournament)(interaction.guildId);
    if (!activeTournament) {
        await interaction.reply({ content: 'No active tournament.', ephemeral: true });
        return;
    }
    const pickedContestant = pickLetter === 'a' ? match.contestantA : match.contestantB;
    const success = (0, db_1.placeBet)(activeTournament.id, matchId, interaction.user.id, interaction.guildId, pickedContestant, amount);
    if (!success) {
        await interaction.reply({ content: 'Bet failed. You may not have enough MugCoins, or you already placed a bet on this match.', ephemeral: true });
        return;
    }
    const balance = (0, db_1.getBalance)(interaction.user.id, interaction.guildId);
    let desc = `✅ **Bet Placed!**\n\n`;
    desc += `**Match #${match.matchNumber}**: ${match.contestantA} vs ${match.contestantB}\n`;
    desc += `Your pick: **${pickedContestant}**\n`;
    desc += `Amount: **${amount}** MugCoins\n`;
    desc += `Remaining balance: **${balance}** MugCoins\n\n`;
    desc += `*Note: Final odds will be revealed when the match is resolved.*`;
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(`Betting Receipt: ${activeTournament.name}`)
        .setDescription(desc);
    // If the original interaction message is accessible (it should be since it's ephemeral), 
    // it's best to update it to avoid multiple ephemeral messages.
    // However, showModal() already acknowledged the interaction.
    // We can use interaction.update() if we triggered this modal from a message component.
    await interaction.update({ embeds: [embed], components: [] });
}
//# sourceMappingURL=tournament.js.map