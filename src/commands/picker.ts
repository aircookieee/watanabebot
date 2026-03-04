import { CommandInteraction } from 'discord.js';

export const pickerCommand = {
    data: {
        name: 'pick',
        description: 'Randomly pick from a list of options',
    },
    async execute(interaction: CommandInteraction) {
        const optionsStr = (interaction as any).options?.get('options')?.value as string;

        if (!optionsStr) {
            await interaction.reply('Usage: /pick option1, option2, option3');
            return;
        }

        const options = optionsStr
            .split(',')
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0);

        if (options.length < 2) {
            await interaction.reply('Please provide at least two options, separated by commas.');
            return;
        }

        const choice = options[Math.floor(Math.random() * options.length)];
        await interaction.reply(`I pick: ${choice}`);
    },
};
