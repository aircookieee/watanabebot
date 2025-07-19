import { MessageEmbed } from "discord.js";
import { Word, WordnikAPI } from "wordnik-api";

export function initWordnik(apiKey: string): WordnikAPI {
    return new WordnikAPI(apiKey);
}

export async function getWordData(api: WordnikAPI, word: string): Promise<any> {
    try {
        const data = await api.getDefinitions(word, 50);
        const hasDefinition = Array.isArray(data) && data.some((def: any) => def.text && def.text.trim().length > 0);
        if (!hasDefinition) {
            return { error: `No definitions found for "${word}"` };
        }
        return data;
    } catch (e) {
        console.error(`Error fetching data for "${word}":`, e);
        return { error: `Something brokey <@551162527070027777>` };
    }
}

function stripHtmlTags(text: string): string {
    return text.replace(/<[^>]*>/g, "");
}

export function makeDiscordEmbed(wordData: Word[]): MessageEmbed {
    const definitions = wordData.filter((def: any) => def.text && def.text.trim().length > 0);

    if (!definitions || definitions.length === 0) {
        return new MessageEmbed().setTitle("No definitions found for the provided word.");
    }

    const seenParts = new Set<string>();
    const selected: any[] = [];

    for (const def of definitions) {
        const part = def.partOfSpeech || "Other";
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

    const embed = new MessageEmbed()
        .setColor(0x00ff00)
        .setTitle(`Definitions for "${definitions[0].word}"`)
        .setURL(definitions[0].wordnikUrl || "");

    selected.forEach((def: any) => {
        embed.addField(
            def.partOfSpeech || "Definition",
            stripHtmlTags(def.text),
            false
        );
    });

    return embed;
}