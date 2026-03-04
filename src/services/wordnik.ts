import { EmbedBuilder } from 'discord.js';
import config from '../config/config';

interface WordnikDefinition {
    word: string;
    partOfSpeech: string;
    text: string;
    sourceDictionary: string;
    wordnikUrl: string;
}

export async function getWordDefinitions(word: string): Promise<WordnikDefinition[] | null> {
    try {
        const lowerWord = word.toLowerCase();
        const response = await fetch(
            `https://api.wordnik.com/v4/word.json/${encodeURIComponent(lowerWord)}/definitions?limit=50&includeRelated=false&useCanonical=true&api_key=${config.wordnik.apiKey}`
        );

        if (!response.ok) {
            console.error(`Wordnik API error: ${response.status}`);
            return null;
        }

        const data = await response.json() as WordnikDefinition[];
        return data.filter(def => def.text && def.text.trim().length > 0);
    } catch (error) {
        console.error('Failed to fetch word definitions:', error);
        return null;
    }
}

export function createWordEmbed(wordData: WordnikDefinition[]): EmbedBuilder | null {
    if (!wordData || wordData.length === 0) {
        return null;
    }

    const definitions = wordData.filter((def) => def.text && def.text.trim().length > 0);

    if (definitions.length === 0) {
        return null;
    }

    const seenParts = new Set<string>();
    const selected: WordnikDefinition[] = [];

    for (const def of definitions) {
        const part = def.partOfSpeech || 'Other';
        if (!seenParts.has(part)) {
            selected.push(def);
            seenParts.add(part);
        }
        if (selected.length === 3) break;
    }

    if (selected.length < 3) {
        for (const def of definitions) {
            if (!selected.includes(def)) {
                selected.push(def);
                if (selected.length === 3) break;
            }
        }
    }

    const embed = new EmbedBuilder()
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
