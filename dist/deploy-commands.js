"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployCommands = deployCommands;
const discord_js_1 = require("discord.js");
const manifest_1 = require("./commands/manifest");
const config_1 = __importDefault(require("./config/config"));
async function deployCommands() {
    const rest = new discord_js_1.REST({ version: '10' }).setToken(config_1.default.discord.token);
    const commands = await (0, manifest_1.getSlashCommands)();
    console.log('Deploying slash commands...');
    if (config_1.default.discord.guildId) {
        await rest.put(discord_js_1.Routes.applicationGuildCommands(config_1.default.discord.clientId, config_1.default.discord.guildId), { body: commands });
        console.log('Guild commands deployed');
        await rest.put(discord_js_1.Routes.applicationCommands(config_1.default.discord.clientId), { body: [] });
        console.log('Cleared global commands to avoid duplicates with guild commands');
        return;
    }
    await rest.put(discord_js_1.Routes.applicationCommands(config_1.default.discord.clientId), { body: commands });
    console.log('Global commands deployed');
}
if (require.main === module) {
    deployCommands().catch(error => {
        console.error('Error deploying commands:', error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=deploy-commands.js.map