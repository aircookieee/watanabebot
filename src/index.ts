import { Client, GatewayIntentBits } from 'discord.js';
import config from './config/config';
import { initDatabase } from './database/db';
import { deployCommands } from './deploy-commands';
import * as ready from './events/ready';
import * as messageCreate from './events/messageCreate';
import * as interactionCreate from './events/interactionCreate';
import { startWebServer } from './web/server';

export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
});

client.once(ready.name, ready.execute as any);
client.on(messageCreate.name, messageCreate.execute as any);
client.on(interactionCreate.name, interactionCreate.execute as any);

async function main() {
    console.log('Initializing database...');
    await initDatabase();

    await startWebServer(client);

    await deployCommands();

    console.log('Logging in...');
    await client.login(config.discord.token);
}

main();
