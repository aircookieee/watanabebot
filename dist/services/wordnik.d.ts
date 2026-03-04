import { EmbedBuilder } from 'discord.js';
interface WordnikDefinition {
    word: string;
    partOfSpeech: string;
    text: string;
    sourceDictionary: string;
    wordnikUrl: string;
}
export declare function getWordDefinitions(word: string): Promise<WordnikDefinition[] | null>;
export declare function createWordEmbed(wordData: WordnikDefinition[]): EmbedBuilder | null;
export {};
//# sourceMappingURL=wordnik.d.ts.map