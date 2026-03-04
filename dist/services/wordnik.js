"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWordDefinitions = getWordDefinitions;
exports.createWordEmbed = createWordEmbed;
const discord_js_1 = require("discord.js");
const config_1 = __importDefault(require("../config/config"));
async function getWordDefinitions(word) {
    try {
        const lowerWord = word.toLowerCase();
        const response = await fetch(`https://api.wordnik.com/v4/word.json/${encodeURIComponent(lowerWord)}/definitions?limit=50&includeRelated=false&useCanonical=true&api_key=${config_1.default.wordnik.apiKey}`);
        if (!response.ok) {
            console.error(`Wordnik API error: ${response.status}`);
            return null;
        }
        const data = await response.json();
        return data.filter(def => def.text && def.text.trim().length > 0);
    }
    catch (error) {
        console.error('Failed to fetch word definitions:', error);
        return null;
    }
}
function createWordEmbed(wordData) {
    if (!wordData || wordData.length === 0) {
        return null;
    }
    const definitions = wordData.filter((def) => def.text && def.text.trim().length > 0);
    if (definitions.length === 0) {
        return null;
    }
    const seenParts = new Set();
    const selected = [];
    for (const def of definitions) {
        const part = def.partOfSpeech || 'Other';
        if (!seenParts.has(part)) {
            selected.push(def);
            seenParts.add(part);
        }
        if (selected.length === 3)
            break;
    }
    if (selected.length < 3) {
        for (const def of definitions) {
            if (!selected.includes(def)) {
                selected.push(def);
                if (selected.length === 3)
                    break;
            }
        }
    }
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x62ACE4)
        .setTitle(`Definitions for "${definitions[0].word}"`)
        .setURL(definitions[0].wordnikUrl || '');
    for (const def of selected) {
        const cleanText = def.text.replace(/<[^>]*>/g, '');
        embed.addFields([
            { name: def.partOfSpeech || 'Definition', value: cleanText, inline: false },
        ]);
    }
    return embed;
}
//# sourceMappingURL=wordnik.js.map