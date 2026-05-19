"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserRole = getUserRole;
exports.canManageTournaments = canManageTournaments;
exports.canUseAdminTools = canUseAdminTools;
const config_1 = __importDefault(require("../config/config"));
function getUserRole(userId) {
    if (userId === config_1.default.admin.userId)
        return 'admin';
    if (userId === config_1.default.tournament.operatorId)
        return 'operator';
    return 'user';
}
function canManageTournaments(userId) {
    return userId === config_1.default.tournament.operatorId || userId === config_1.default.admin.userId;
}
function canUseAdminTools(userId) {
    return userId === config_1.default.admin.userId;
}
//# sourceMappingURL=authz.js.map