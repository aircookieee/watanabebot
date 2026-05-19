import {
    addTournamentMatch,
    addAuditLog,
    closeBettingForMatch,
    createTournament,
    createNextRoundFromWinners,
    endTournament,
    getActiveTournament,
    getBalance,
    getBetsForMatch,
    getCurrentRoundNumber,
    getMatch,
    getMatchByNumber,
    getTournamentMatches,
    getWalletTransactions,
    getUserBets,
    placeBet,
    resolveMatch,
} from '../database/db';
import { canManageTournaments, getUserRole, type UserRole } from './authz';

export interface TournamentSummary {
    id: number;
    name: string;
}

export interface TournamentMatchView {
    id: number;
    tournamentId: number;
    matchNumber: number;
    roundNumber: number;
    contestantA: string;
    contestantB: string;
    winner: string | null;
    bettingOpen: boolean;
    userBet?: {
        picked: string;
        amount: number;
        status: string;
        payout: number;
    } | null;
}

export interface TournamentOverview {
    tournament: TournamentSummary | null;
    role: UserRole;
    walletBalance: number;
    currentRoundNumber: number | null;
    matches: TournamentMatchView[];
}

export function openTournamentFromBracket(actorUserId: string, guildId: string, name: string, matches: Array<{ a: string; b: string }>): number {
    if (!canManageTournaments(actorUserId)) {
        throw new Error('You do not have permission to manage tournaments.');
    }

    const activeTournament = getActiveTournament(guildId);
    if (activeTournament) {
        throw new Error(`A tournament is already active: ${activeTournament.name}`);
    }

    if (!Array.isArray(matches) || matches.length === 0) {
        throw new Error('Bracket must contain at least one match.');
    }

    const tournamentId = createTournament(guildId, name);
    if (!tournamentId) {
        throw new Error('Failed to create tournament.');
    }

    matches.forEach((match, index) => {
        if (typeof match.a !== 'string' || typeof match.b !== 'string' || !match.a.trim() || !match.b.trim()) {
            throw new Error(`Invalid match at index ${index}.`);
        }

        addTournamentMatch(tournamentId, index + 1, match.a.trim(), match.b.trim());
    });

    addAuditLog(actorUserId, 'tournament_open', 'tournament', String(tournamentId), { guildId, name, matchCount: matches.length });

    return tournamentId;
}

export function getTournamentOverview(guildId: string, userId: string): TournamentOverview {
    const activeTournament = getActiveTournament(guildId);
    const role = getUserRole(userId);
    const walletBalance = getBalance(userId, guildId);

    if (!activeTournament) {
        return {
            tournament: null,
            role,
            walletBalance,
            currentRoundNumber: null,
            matches: [],
        };
    }

    const userBets = getUserBets(activeTournament.id, userId);
    const currentRoundNumber = getCurrentRoundNumber(activeTournament.id);
    const userBetsByMatchId = new Map(userBets.map(bet => [bet.matchId, bet]));
    const matches = getTournamentMatches(activeTournament.id).map(match => ({
        ...match,
        tournamentId: activeTournament.id,
        userBet: userBetsByMatchId.has(match.id)
            ? {
                picked: userBetsByMatchId.get(match.id)!.picked,
                amount: userBetsByMatchId.get(match.id)!.amount,
                status: userBetsByMatchId.get(match.id)!.status,
                payout: userBetsByMatchId.get(match.id)!.payout,
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

export function getCurrentUserBets(guildId: string, userId: string) {
    const activeTournament = getActiveTournament(guildId);
    if (!activeTournament) {
        return [];
    }

    return getUserBets(activeTournament.id, userId);
}

export function placeTournamentBet(guildId: string, userId: string, matchId: number, picked: string, amount: number): boolean {
    if (amount <= 0) {
        throw new Error('Amount must be greater than zero.');
    }

    const activeTournament = getActiveTournament(guildId);
    if (!activeTournament) {
        throw new Error('No active tournament.');
    }

    const match = getMatch(matchId);
    if (!match || match.tournamentId !== activeTournament.id) {
        throw new Error('Match not found in the active tournament.');
    }

    if (!match.bettingOpen) {
        throw new Error('Betting is closed for this match.');
    }

    if (picked !== match.contestantA && picked !== match.contestantB) {
        throw new Error('Invalid contestant selection.');
    }

    const success = placeBet(activeTournament.id, matchId, userId, guildId, picked, amount);
    if (!success) {
        throw new Error('Bet failed. You may not have enough MugCoins or you already placed a bet.');
    }

    return true;
}

export function closeTournamentMatch(actorUserId: string, guildId: string, matchNumber: number): TournamentMatchView {
    if (!canManageTournaments(actorUserId)) {
        throw new Error('You do not have permission to manage tournaments.');
    }

    const activeTournament = getActiveTournament(guildId);
    if (!activeTournament) {
        throw new Error('No active tournament.');
    }

    const match = getMatchByNumber(activeTournament.id, matchNumber);
    if (!match) {
        throw new Error('Match not found.');
    }

    if (!match.bettingOpen) {
        throw new Error('Betting is already closed for this match.');
    }

    closeBettingForMatch(match.id);
    addAuditLog(actorUserId, 'tournament_close_match', 'match', String(match.id), { guildId, matchNumber, tournamentId: activeTournament.id });
    return { ...match, tournamentId: activeTournament.id };
}

export function closeAllTournamentMatches(actorUserId: string, guildId: string): number {
    if (!canManageTournaments(actorUserId)) {
        throw new Error('You do not have permission to manage tournaments.');
    }

    const activeTournament = getActiveTournament(guildId);
    if (!activeTournament) {
        throw new Error('No active tournament.');
    }

    let closedCount = 0;
    for (const match of getTournamentMatches(activeTournament.id)) {
        if (match.bettingOpen) {
            closeBettingForMatch(match.id);
            closedCount++;
        }
    }

    addAuditLog(actorUserId, 'tournament_close_all', 'tournament', String(activeTournament.id), { guildId, closedCount });

    return closedCount;
}

export function resolveTournamentMatch(actorUserId: string, guildId: string, matchNumber: number, winnerRaw: string) {
    if (!canManageTournaments(actorUserId)) {
        throw new Error('You do not have permission to manage tournaments.');
    }

    const activeTournament = getActiveTournament(guildId);
    if (!activeTournament) {
        throw new Error('No active tournament.');
    }

    const match = getMatchByNumber(activeTournament.id, matchNumber);
    if (!match) {
        throw new Error('Match not found.');
    }

    if (match.winner) {
        throw new Error('Match is already resolved.');
    }

    let winner: string | null = null;
    if (winnerRaw.toLowerCase() === match.contestantA.toLowerCase()) winner = match.contestantA;
    if (winnerRaw.toLowerCase() === match.contestantB.toLowerCase()) winner = match.contestantB;

    if (!winner) {
        throw new Error(`Winner must be exactly ${match.contestantA} or ${match.contestantB}.`);
    }

    const summary = resolveMatch(activeTournament.id, match.id, winner);
    const bets = getBetsForMatch(activeTournament.id, match.id);
    const currentRound = getCurrentRoundNumber(activeTournament.id);
    const currentRoundMatches = getTournamentMatches(activeTournament.id, currentRound);
    const currentRoundResolved = currentRoundMatches.every(item => item.winner !== null);
    const isFinalRound = currentRoundMatches.length === 1;
    const tournamentEnded = currentRoundResolved && isFinalRound;

    if (tournamentEnded) {
        endTournament(activeTournament.id);
    }

    addAuditLog(actorUserId, 'tournament_resolve_match', 'match', String(match.id), { guildId, matchNumber, winner, tournamentId: activeTournament.id });

    return {
        match,
        winner,
        summary,
        bets,
        tournamentEnded,
        tournamentName: activeTournament.name,
    };
}

export function completeTournament(actorUserId: string, guildId: string): void {
    if (!canManageTournaments(actorUserId)) {
        throw new Error('You do not have permission to manage tournaments.');
    }

    const activeTournament = getActiveTournament(guildId);
    if (!activeTournament) {
        throw new Error('No active tournament.');
    }

    endTournament(activeTournament.id);
    addAuditLog(actorUserId, 'tournament_end', 'tournament', String(activeTournament.id), { guildId });
}

export function advanceTournamentRound(actorUserId: string, guildId: string): { roundNumber: number; matchCount: number } {
    if (!canManageTournaments(actorUserId)) {
        throw new Error('You do not have permission to manage tournaments.');
    }

    const activeTournament = getActiveTournament(guildId);
    if (!activeTournament) {
        throw new Error('No active tournament.');
    }

    return createNextRoundFromWinners(activeTournament.id);
}

export function getTournamentTransactions(guildId: string, userId?: string, limit = 50) {
    return getWalletTransactions(guildId, userId, limit);
}
