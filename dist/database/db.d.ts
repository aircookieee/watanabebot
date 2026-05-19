export declare function initDatabase(): Promise<void>;
export declare function registerAnilistUser(discordId: string, anilistUsername: string): boolean;
export declare function unregisterAnilistUser(discordId: string): boolean;
export declare function getAnilistUsername(discordId: string): string | null;
export declare function getAllAnilistMappings(): Record<string, string>;
export declare function getAnilistUserCount(): number;
export declare function saveUserMediaBatch(discordId: string, entries: {
    mediaId: number;
    mediaType: string;
    entryData: string;
}[]): void;
export declare function clearUserMediaList(discordId: string, mediaType?: string): void;
export declare function getUserMediaList(discordId: string, mediaType?: string): {
    mediaId: number;
    mediaType: string;
    entryData: string;
}[];
export declare function getUserMediaById(discordId: string, mediaId: number): string | null;
export declare function saveUserFavorites(discordId: string, mediaIds: number[]): void;
export declare function getUserFavorites(discordId: string): number[];
export declare function getLastRefreshTime(discordId: string): {
    lists?: string;
    favorites?: string;
} | null;
export declare function updateRefreshLog(discordId: string, refreshType: 'lists' | 'favorites'): void;
export declare function getGuildConfig(guildId: string): {
    channelId: string;
    mode: string;
} | null;
export declare function setGuildConfig(guildId: string, channelId: string, mode: string): void;
export declare function getSetting(key: string): string | null;
export declare function setSetting(key: string, value: string): void;
export declare function getOrCreateWallet(userId: string, guildId: string): {
    balance: number;
    totalEarned: number;
    totalSpent: number;
};
export declare function getBalance(userId: string, guildId: string): number;
export declare function addCurrency(userId: string, guildId: string, amount: number, reason: string, refId?: string | null): void;
export declare function spendCurrency(userId: string, guildId: string, amount: number, reason: string, refId?: string | null): boolean;
export declare function setBalance(userId: string, guildId: string, amount: number, reason: string): void;
export declare function transferCurrency(senderId: string, receiverId: string, guildId: string, amount: number): boolean;
export declare function getLeaderboard(guildId: string, limit: number): {
    userId: string;
    balance: number;
}[];
export declare function getWalletTransactions(guildId: string, userId?: string, limit?: number): {
    id: number;
    userId: string;
    amount: number;
    reason: string;
    referenceId: string | null;
    balanceAfter: number;
    createdAt: string;
}[];
export declare function addAuditLog(actorUserId: string, action: string, targetType: string, targetId?: string | null, metadata?: Record<string, unknown>): void;
export declare function getAuditLogs(limit?: number): {
    id: number;
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string | null;
    metadata: string | null;
    createdAt: string;
}[];
export declare function saveWebSession(sid: string, userId: string, username: string, guildMember: boolean, csrfToken: string, bracketPreview?: string | null): void;
export declare function getWebSession(sid: string): {
    userId: string;
    username: string;
    guildMember: boolean;
    csrfToken: string;
    bracketPreview: string | null;
} | null;
export declare function deleteWebSession(sid: string): void;
export declare function createTournament(guildId: string, name: string): number | null;
export declare function addTournamentMatch(tournamentId: number, matchNum: number, contestantA: string, contestantB: string, roundNumber?: number): void;
export declare function getActiveTournament(guildId: string): {
    id: number;
    name: string;
} | null;
export declare function getTournamentMatches(tournamentId: number, roundNumber?: number): any[];
export declare function getMatch(matchId: number): any | null;
export declare function getMatchByNumber(tournamentId: number, matchNumber: number): any | null;
export declare function getCurrentRoundNumber(tournamentId: number): number;
export declare function createNextRoundFromWinners(tournamentId: number): {
    roundNumber: number;
    matchCount: number;
};
export declare function closeBettingForMatch(matchId: number): void;
export declare function placeBet(tournamentId: number, matchId: number, userId: string, guildId: string, picked: string, amount: number): boolean;
export declare function getBetsForMatch(tournamentId: number, matchId: number): any[];
export declare function getUserBets(tournamentId: number, userId: string): any[];
export declare function resolveMatch(tournamentId: number, matchId: number, winner: string): any;
export declare function endTournament(tournamentId: number): void;
export declare function closeDatabase(): void;
//# sourceMappingURL=db.d.ts.map