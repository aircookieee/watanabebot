import { CommandInteraction } from 'discord.js';
import { getGuildConfig, setGuildConfig, getSetting, setSetting } from '../database/db';

export const yousoroCommand = {
    data: {
        name: 'yousoro',
        description: 'Yousoro~! Configure reaction settings',
    },
    async execute(interaction: CommandInteraction) {
        const subcommand = (interaction as any).options?.getSubcommand();

        switch (subcommand) {
            case 'info': {
                await interaction.reply({
                    content: 'Yousoro, sailor!\n\n' +
                        '`/yousoro here` - makes me react only in this channel\n' +
                        '`/yousoro everywhere` - makes me react in all channels\n' +
                        '`/yousoro twitter on/off` - turn twitter link replacement on or off',
                    files: [{ attachment: 'resources/ohayousoro.png' }],
                });
                break;
            }
            case 'here': {
                if (!interaction.guild || !interaction.channel) {
                    await interaction.reply('This command must be used in a server.');
                    return;
                }

                setGuildConfig(interaction.guild.id, interaction.channel.id, 'here');
                await interaction.reply({
                    content: 'Yousoro~!',
                    files: [{ attachment: 'resources/yousoroHere.png' }],
                });
                break;
            }
            case 'everywhere': {
                if (!interaction.guild) {
                    await interaction.reply('This command must be used in a server.');
                    return;
                }

                setGuildConfig(interaction.guild.id, '', 'everywhere');
                await interaction.reply({
                    content: 'Zensokuzenshin... Yousoro~!',
                    files: [{ attachment: 'resources/yousoroEverywhere.jpg' }],
                });
                break;
            }
            case 'twitter': {
                const toggle = (interaction as any).options?.getString('toggle');
                const twitterEnabled = toggle === 'on';
                setSetting('twitter_enabled', twitterEnabled.toString());

                await interaction.reply(`Twitter Link Replacement is **${twitterEnabled ? 'ON' : 'OFF'}**`);
                break;
            }
        }
    },
};
