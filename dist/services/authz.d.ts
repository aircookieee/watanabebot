export type UserRole = 'user' | 'operator' | 'admin';
export declare function getUserRole(userId: string): UserRole;
export declare function canManageTournaments(userId: string): boolean;
export declare function canUseAdminTools(userId: string): boolean;
//# sourceMappingURL=authz.d.ts.map