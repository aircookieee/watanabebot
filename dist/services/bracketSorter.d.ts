export interface BracketEntry {
    originalNumber: number;
    name: string;
    originalIndex: number;
}
export interface SeededBracketEntry extends BracketEntry {
    seed: number;
}
export interface BracketMatch {
    matchNumber: number;
    a: string;
    b: string;
}
export interface BracketSortResult {
    size: 16 | 32;
    entries: SeededBracketEntry[];
    matches: BracketMatch[];
}
export declare function parseBracketInput(rawInput: string, size: 16 | 32): BracketEntry[];
export declare function sortBracketEntries(entries: BracketEntry[]): SeededBracketEntry[];
export declare function buildBracketMatches(entries: SeededBracketEntry[], size: 16 | 32): BracketMatch[];
export declare function sortBracket(rawInput: string, size: 16 | 32): BracketSortResult;
//# sourceMappingURL=bracketSorter.d.ts.map