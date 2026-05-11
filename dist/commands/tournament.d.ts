import { CommandInteraction, StringSelectMenuInteraction, ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
export declare const tournamentCommand: {
    data: import("discord.js").SlashCommandSubcommandsOnlyBuilder;
    execute: (interaction: CommandInteraction) => Promise<void>;
};
export declare function handleSelectMatch(interaction: StringSelectMenuInteraction): Promise<void>;
export declare function handleContestantPick(interaction: ButtonInteraction): Promise<void>;
export declare function handleBetSubmit(interaction: ModalSubmitInteraction): Promise<void>;
//# sourceMappingURL=tournament.d.ts.map