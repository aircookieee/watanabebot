import { Events, Interaction, Client, CommandInteraction } from 'discord.js';
import { getAnimeInfoWithScores, registerUser, unregisterUser, updateAllUserData, isUpdateInProgress } from '../services/anilist';
import { defineCommand, pickerCommand, yousoroCommand } from '../commands/index';
import { createAnimeEmbed } from './anilistHelper';

const commands: Record<string, (interaction: CommandInteraction) => Promise<void>> = {
    '/anime': async (interaction: CommandInteraction) => {
        const query = (interaction as any).options.getString('query');
        
        if (isUpdateInProgress) {
            await interaction.reply({ content: 'Anilist data is currently being updated. Please wait a moment and try again.', flags: 64 });
            return;
        }
        
        const sTime = performance.now();
        
        await interaction.deferReply();
        
        const result = await getAnimeInfoWithScores(query, 'ANIME');
        
        if (!result) {
            await interaction.editReply(`No anime found for "${query}"`);
            return;
        }
        
        const embed = createAnimeEmbed(result, sTime);
        await interaction.editReply({ embeds: [embed] });
    },
    '/manga': async (interaction: CommandInteraction) => {
        const query = (interaction as any).options.getString('query');
        
        if (isUpdateInProgress) {
            await interaction.reply({ content: 'Anilist data is currently being updated. Please wait a moment and try again.', flags: 64 });
            return;
        }
        
        const sTime = performance.now();
        
        await interaction.deferReply();
        
        const result = await getAnimeInfoWithScores(query, 'MANGA');
        
        if (!result) {
            await interaction.editReply(`No manga found for "${query}"`);
            return;
        }
        
        const embed = createAnimeEmbed(result, sTime, 'MANGA');
        await interaction.editReply({ embeds: [embed] });
    },
    '/anilist': async (interaction: CommandInteraction) => {
        const subcommand = (interaction as any).options.getSubcommand();
        
        switch (subcommand) {
            case 'register': {
                const username = (interaction as any).options.getString('username');
                await interaction.deferReply();
                const success = await registerUser(interaction.user.id, username);
                if (success) {
                    await interaction.editReply(`Registered \`${username}\` to <@${interaction.user.id}>.`);
                } else {
                    await interaction.editReply(`Anilist username \`${username}\` is already registered to another user.`);
                }
                break;
            }
            case 'unregister': {
                const success = unregisterUser(interaction.user.id);
                if (success) {
                    await interaction.reply(`Unregistered <@${interaction.user.id}>.`);
                } else {
                    await interaction.reply(`Could not unregister <@${interaction.user.id}>.`);
                }
                break;
            }
            case 'update': {
                await interaction.deferReply();
                const startTime = performance.now();
                await updateAllUserData();
                const endTime = performance.now();
                await interaction.editReply(`Anilist data updated, took ${Math.round((endTime - startTime) / 1000)}s.`);
                break;
            }
        }
    },
};

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction, client: Client): Promise<void> {
    if (!interaction.isCommand()) return;

    const commandName = `/${interaction.commandName}`;

    if (commands[commandName]) {
        await commands[commandName](interaction);
        return;
    }

    if (commandName === '/define') {
        await defineCommand.execute(interaction);
        return;
    }

    if (commandName === '/pick') {
        await pickerCommand.execute(interaction);
        return;
    }

    if (commandName === '/yousoro') {
        await yousoroCommand.execute(interaction);
        return;
    }
}
