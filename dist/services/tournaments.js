"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openTournamentFromBracket = openTournamentFromBracket;
exports.getTournamentOverview = getTournamentOverview;
exports.getCurrentUserBets = getCurrentUserBets;
exports.placeTournamentBet = placeTournamentBet;
exports.closeTournamentMatch = closeTournamentMatch;
exports.closeAllTournamentMatches = closeAllTournamentMatches;
exports.resolveTournamentMatch = resolveTournamentMatch;
exports.completeTournament = completeTournament;
exports.advanceTournamentRound = advanceTournamentRound;
exports.getTournamentTransactions = getTournamentTransactions;
const db_1 = require("../database/db");
const authz_1 = require("./authz");
function openTournamentFromBracket(actorUserId, guildId, name, matches) {
    if (!(0, authz_1.canManageTournaments)(actorUserId)) {
        throw new Error('You do not have permission to manage tournaments.');
    }
    const activeTournament = (0, db_1.getActiveTournament)(guildId);
    if (activeTournament) {
        throw new Error(`A tournament is already active: ${activeTournament.name}`);
    }
    if (!Array.isArray(matches) || matches.length === 0) {
        throw new Error('Bracket must contain at least one match.');
    }
    const tournamentId = (0, db_1.createTournament)(guildId, name);
    if (!tournamentId) {
        throw new Error('Failed to create tournament.');
    }
    matches.forEach((match, index) => {
        if (typeof match.a !== 'string' || typeof match.b !== 'string' || !match.a.trim() || !match.b.trim()) {
            throw new Error(`Invalid match at index ${index}.`);
        }
        (0, db_1.addTournamentMatch)(tournamentId, index + 1, match.a.trim(), match.b.trim());
    });
    (0, db_1.addAuditLog)(actorUserId, 'tournament_open', 'tournament', String(tournamentId), { guildId, name, matchCount: matches.length });
    return tournamentId;
}
function getTournamentOverview(guildId, userId) {
    const activeTournament = (0, db_1.getActiveTournament)(guildId);
    const role = (0, authz_1.getUserRole)(userId);
    const walletBalance = (0, db_1.getBalance)(userId, guildId);
    if (!activeTournament) {
        return {
            tournament: null,
            role,
            walletBalance,
            currentRoundNumber: null,
            matches: [],
        };
    }
    const userBets = (0, db_1.getUserBets)(activeTournament.id, userId);
    const currentRoundNumber = (0, db_1.getCurrentRoundNumber)(activeTournament.id);
    const userBetsByMatchId = new Map(userBets.map(bet => [bet.matchId, bet]));
    const matches = (0, db_1.getTournamentMatches)(activeTournament.id).map(match => ({
        ...match,
        tournamentId: activeTournament.id,
        userBet: userBetsByMatchId.has(match.id)
            ? {
                picked: userBetsByMatchId.get(match.id).picked,
                amount: userBetsByMatchId.get(match.id).amount,
                status: userBetsByMatchId.get(match.id).status,
                payout: userBetsByMatchId.get(match.id).payout,
            }
            : null,
    }));
    return {
        tournament: activeTournament,
        role,
        walletBalance,
        currentRoundNumber,
        matches,
    };
}
function getCurrentUserBets(guildId, userId) {
    const activeTournament = (0, db_1.getActiveTournament)(guildId);
    if (!activeTournament) {
        return [];
    }
    return (0, db_1.getUserBets)(activeTournament.id, userId);
}
function placeTournamentBet(guildId, userId, matchId, picked, amount) {
    if (amount <= 0) {
        throw new Error('Amount must be greater than zero.');
    }
    const activeTournament = (0, db_1.getActiveTournament)(guildId);
    if (!activeTournament) {
        throw new Error('No active tournament.');
    }
    const match = (0, db_1.getMatch)(matchId);
    if (!match || match.tournamentId !== activeTournament.id) {
        throw new Error('Match not found in the active tournament.');
    }
    if (!match.bettingOpen) {
        throw new Error('Betting is closed for this match.');
    }
    if (picked !== match.contestantA && picked !== match.contestantB) {
        throw new Error('Invalid contestant selection.');
    }
    const success = (0, db_1.placeBet)(activeTournament.id, matchId, userId, guildId, picked, amount);
    if (!success) {
        throw new Error('Bet failed. You may not have enough MugCoins or you already placed a bet.');
    }
    return true;
}
function closeTournamentMatch(actorUserId, guildId, matchNumber) {
    if (!(0, authz_1.canManageTournaments)(actorUserId)) {
        throw new Error('You do not have permission to manage tournaments.');
    }
    const activeTournament = (0, db_1.getActiveTournament)(guildId);
    if (!activeTournament) {
        throw new Error('No active tournament.');
    }
    const match = (0, db_1.getMatchByNumber)(activeTournament.id, matchNumber);
    if (!match) {
        throw new Error('Match not found.');
    }
    if (!match.bettingOpen) {
        throw new Error('Betting is already closed for this match.');
    }
    (0, db_1.closeBettingForMatch)(match.id);
    (0, db_1.addAuditLog)(actorUserId, 'tournament_close_match', 'match', String(match.id), { guildId, matchNumber, tournamentId: activeTournament.id });
    return { ...match, tournamentId: activeTournament.id };
}
function closeAllTournamentMatches(actorUserId, guildId) {
    if (!(0, authz_1.canManageTournaments)(actorUserId)) {
        throw new Error('You do not have permission to manage tournaments.');
    }
    const activeTournament = (0, db_1.getActiveTournament)(guildId);
    if (!activeTournament) {
        throw new Error('No active tournament.');
    }
    let closedCount = 0;
    for (const match of (0, db_1.getTournamentMatches)(activeTournament.id)) {
        if (match.bettingOpen) {
            (0, db_1.closeBettingForMatch)(match.id);
            closedCount++;
        }
    }
    (0, db_1.addAuditLog)(actorUserId, 'tournament_close_all', 'tournament', String(activeTournament.id), { guildId, closedCount });
    return closedCount;
}
function resolveTournamentMatch(actorUserId, guildId, matchNumber, winnerRaw) {
    if (!(0, authz_1.canManageTournaments)(actorUserId)) {
        throw new Error('You do not have permission to manage tournaments.');
    }
    const activeTournament = (0, db_1.getActiveTournament)(guildId);
    if (!activeTournament) {
        throw new Error('No active tournament.');
    }
    const match = (0, db_1.getMatchByNumber)(activeTournament.id, matchNumber);
    if (!match) {
        throw new Error('Match not found.');
    }
    if (match.winner) {
        throw new Error('Match is already resolved.');
    }
    let winner = null;
    if (winnerRaw.toLowerCase() === match.contestantA.toLowerCase())
        winner = match.contestantA;
    if (winnerRaw.toLowerCase() === match.contestantB.toLowerCase())
        winner = match.contestantB;
    if (!winner) {
        throw new Error(`Winner must be exactly ${match.contestantA} or ${match.contestantB}.`);
    }
    const summary = (0, db_1.resolveMatch)(activeTournament.id, match.id, winner);
    const bets = (0, db_1.getBetsForMatch)(activeTournament.id, match.id);
    const currentRound = (0, db_1.getCurrentRoundNumber)(activeTournament.id);
    const currentRoundMatches = (0, db_1.getTournamentMatches)(activeTournament.id, currentRound);
    const currentRoundResolved = currentRoundMatches.every(item => item.winner !== null);
    const isFinalRound = currentRoundMatches.length === 1;
    const tournamentEnded = currentRoundResolved && isFinalRound;
    if (tournamentEnded) {
        (0, db_1.endTournament)(activeTournament.id);
    }
    (0, db_1.addAuditLog)(actorUserId, 'tournament_resolve_match', 'match', String(match.id), { guildId, matchNumber, winner, tournamentId: activeTournament.id });
    return {
        match,
        winner,
        summary,
        bets,
        tournamentEnded,
        tournamentName: activeTournament.name,
    };
}
function completeTournament(actorUserId, guildId) {
    if (!(0, authz_1.canManageTournaments)(actorUserId)) {
        throw new Error('You do not have permission to manage tournaments.');
    }
    const activeTournament = (0, db_1.getActiveTournament)(guildId);
    if (!activeTournament) {
        throw new Error('No active tournament.');
    }
    (0, db_1.endTournament)(activeTournament.id);
    (0, db_1.addAuditLog)(actorUserId, 'tournament_end', 'tournament', String(activeTournament.id), { guildId });
}
function advanceTournamentRound(actorUserId, guildId) {
    if (!(0, authz_1.canManageTournaments)(actorUserId)) {
        throw new Error('You do not have permission to manage tournaments.');
    }
    const activeTournament = (0, db_1.getActiveTournament)(guildId);
    if (!activeTournament) {
        throw new Error('No active tournament.');
    }
    return (0, db_1.createNextRoundFromWinners)(activeTournament.id);
}
function getTournamentTransactions(guildId, userId, limit = 50) {
    return (0, db_1.getWalletTransactions)(guildId, userId, limit);
}
//# sourceMappingURL=tournaments.js.map