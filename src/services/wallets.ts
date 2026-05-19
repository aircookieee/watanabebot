import { addCurrency, getBalance, getLeaderboard, setBalance, spendCurrency, transferCurrency } from '../database/db';
import { addAuditLog } from '../database/db';
import { canUseAdminTools } from './authz';

export function getWalletSummary(userId: string, guildId: string) {
    return {
        userId,
        guildId,
        balance: getBalance(userId, guildId),
    };
}

export function getWalletLeaderboard(guildId: string, limit = 10) {
    return getLeaderboard(guildId, limit);
}

export function payUser(senderId: string, receiverId: string, guildId: string, amount: number): boolean {
    if (amount <= 0) return false;
    return transferCurrency(senderId, receiverId, guildId, amount);
}

export function adminSetUserBalance(actorUserId: string, targetUserId: string, guildId: string, amount: number): boolean {
    if (!canUseAdminTools(actorUserId) || amount < 0) return false;
    setBalance(targetUserId, guildId, amount, 'admin_set');
    addAuditLog(actorUserId, 'wallet_set', 'wallet', targetUserId, { guildId, amount });
    return true;
}

export function adminGiveUserBalance(actorUserId: string, targetUserId: string, guildId: string, amount: number): boolean {
    if (!canUseAdminTools(actorUserId) || amount <= 0) return false;
    addCurrency(targetUserId, guildId, amount, 'admin_give');
    addAuditLog(actorUserId, 'wallet_give', 'wallet', targetUserId, { guildId, amount });
    return true;
}

export function adminTakeUserBalance(actorUserId: string, targetUserId: string, guildId: string, amount: number): boolean {
    if (!canUseAdminTools(actorUserId) || amount <= 0) return false;
    const ok = spendCurrency(targetUserId, guildId, amount, 'admin_take');
    if (ok) addAuditLog(actorUserId, 'wallet_take', 'wallet', targetUserId, { guildId, amount });
    return ok;
}
