import { type UserRole } from './authz';
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
export declare function openTournamentFromBracket(actorUserId: string, guildId: string, name: string, matches: Array<{
    a: string;
    b: string;
}>): number;
export declare function getTournamentOverview(guildId: string, userId: string): TournamentOverview;
export declare function getCurrentUserBets(guildId: string, userId: string): any[];
export declare function placeTournamentBet(guildId: string, userId: string, matchId: number, picked: string, amount: number): boolean;
export declare function closeTournamentMatch(actorUserId: string, guildId: string, matchNumber: number): TournamentMatchView;
export declare function closeAllTournamentMatches(actorUserId: string, guildId: string): number;
export declare function resolveTournamentMatch(actorUserId: string, guildId: string, matchNumber: number, winnerRaw: string): {
    match: any;
    winner: string;
    summary: any;
    bets: any[];
    tournamentEnded: boolean;
    tournamentName: string;
};
export declare function completeTournament(actorUserId: string, guildId: string): void;
export declare function advanceTournamentRound(actorUserId: string, guildId: string): {
    roundNumber: number;
    matchCount: number;
};
export declare function getTournamentTransactions(guildId: string, userId?: string, limit?: number): {
    id: number;
    userId: string;
    amount: number;
    reason: string;
    referenceId: string | null;
    balanceAfter: number;
    createdAt: string;
}[];
//# sourceMappingURL=tournaments.d.ts.map