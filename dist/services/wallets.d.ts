export declare function getWalletSummary(userId: string, guildId: string): {
    userId: string;
    guildId: string;
    balance: number;
};
export declare function getWalletLeaderboard(guildId: string, limit?: number): {
    userId: string;
    balance: number;
}[];
export declare function payUser(senderId: string, receiverId: string, guildId: string, amount: number): boolean;
export declare function adminSetUserBalance(actorUserId: string, targetUserId: string, guildId: string, amount: number): boolean;
export declare function adminGiveUserBalance(actorUserId: string, targetUserId: string, guildId: string, amount: number): boolean;
export declare function adminTakeUserBalance(actorUserId: string, targetUserId: string, guildId: string, amount: number): boolean;
//# sourceMappingURL=wallets.d.ts.map