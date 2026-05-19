"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWalletSummary = getWalletSummary;
exports.getWalletLeaderboard = getWalletLeaderboard;
exports.payUser = payUser;
exports.adminSetUserBalance = adminSetUserBalance;
exports.adminGiveUserBalance = adminGiveUserBalance;
exports.adminTakeUserBalance = adminTakeUserBalance;
const db_1 = require("../database/db");
const db_2 = require("../database/db");
const authz_1 = require("./authz");
function getWalletSummary(userId, guildId) {
    return {
        userId,
        guildId,
        balance: (0, db_1.getBalance)(userId, guildId),
    };
}
function getWalletLeaderboard(guildId, limit = 10) {
    return (0, db_1.getLeaderboard)(guildId, limit);
}
function payUser(senderId, receiverId, guildId, amount) {
    if (amount <= 0)
        return false;
    return (0, db_1.transferCurrency)(senderId, receiverId, guildId, amount);
}
function adminSetUserBalance(actorUserId, targetUserId, guildId, amount) {
    if (!(0, authz_1.canUseAdminTools)(actorUserId) || amount < 0)
        return false;
    (0, db_1.setBalance)(targetUserId, guildId, amount, 'admin_set');
    (0, db_2.addAuditLog)(actorUserId, 'wallet_set', 'wallet', targetUserId, { guildId, amount });
    return true;
}
function adminGiveUserBalance(actorUserId, targetUserId, guildId, amount) {
    if (!(0, authz_1.canUseAdminTools)(actorUserId) || amount <= 0)
        return false;
    (0, db_1.addCurrency)(targetUserId, guildId, amount, 'admin_give');
    (0, db_2.addAuditLog)(actorUserId, 'wallet_give', 'wallet', targetUserId, { guildId, amount });
    return true;
}
function adminTakeUserBalance(actorUserId, targetUserId, guildId, amount) {
    if (!(0, authz_1.canUseAdminTools)(actorUserId) || amount <= 0)
        return false;
    const ok = (0, db_1.spendCurrency)(targetUserId, guildId, amount, 'admin_take');
    if (ok)
        (0, db_2.addAuditLog)(actorUserId, 'wallet_take', 'wallet', targetUserId, { guildId, amount });
    return ok;
}
//# sourceMappingURL=wallets.js.map