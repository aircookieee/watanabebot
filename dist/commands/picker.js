"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickerCommand = void 0;
exports.pickerCommand = {
    data: {
        name: 'pick',
        description: 'Randomly pick from a list of options',
    },
    async execute(interaction) {
        const optionsStr = interaction.options?.get('options')?.value;
        if (!optionsStr) {
            await interaction.reply('Usage: /pick option1, option2, option3');
            return;
        }
        const options = optionsStr
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        if (options.length < 2) {
            await interaction.reply('Please provide at least two options, separated by commas.');
            return;
        }
        const choice = options[Math.floor(Math.random() * options.length)];
        await interaction.reply(`I pick: ${choice}`);
    },
};
//# sourceMappingURL=picker.js.map