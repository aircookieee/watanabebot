import { REST, Routes } from 'discord.js';
import { getSlashCommands } from './commands/manifest';
import config from './config/config';

export async function deployCommands() {
    const rest = new REST({ version: '10' }).setToken(config.discord.token);
    const commands = await getSlashCommands();

    console.log('Deploying slash commands...');

    if (config.discord.guildId) {
        await rest.put(
            Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
            { body: commands }
        );
        console.log('Guild commands deployed');

        await rest.put(
            Routes.applicationCommands(config.discord.clientId),
            { body: [] }
        );
        console.log('Cleared global commands to avoid duplicates with guild commands');
        return;
    }

    await rest.put(
        Routes.applicationCommands(config.discord.clientId),
        { body: commands }
    );
    console.log('Global commands deployed');
}

if (require.main === module) {
    deployCommands().catch(error => {
        console.error('Error deploying commands:', error);
        process.exitCode = 1;
    });
}
