import config from '../config/config';

export type UserRole = 'user' | 'operator' | 'admin';

export function getUserRole(userId: string): UserRole {
    if (userId === config.admin.userId) return 'admin';
    if (userId === config.tournament.operatorId) return 'operator';
    return 'user';
}

export function canManageTournaments(userId: string): boolean {
    return userId === config.tournament.operatorId || userId === config.admin.userId;
}

export function canUseAdminTools(userId: string): boolean {
    return userId === config.admin.userId;
}
