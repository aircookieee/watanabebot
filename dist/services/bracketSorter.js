"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBracketInput = parseBracketInput;
exports.sortBracketEntries = sortBracketEntries;
exports.buildBracketMatches = buildBracketMatches;
exports.sortBracket = sortBracket;
const BRACKET_LAYOUTS = {
    16: [
        [1, 16],
        [8, 9],
        [5, 12],
        [4, 13],
        [6, 11],
        [3, 14],
        [7, 10],
        [2, 15],
    ],
    32: [
        [1, 32],
        [16, 17],
        [8, 25],
        [9, 24],
        [5, 28],
        [12, 21],
        [4, 29],
        [13, 20],
        [6, 27],
        [11, 22],
        [3, 30],
        [14, 19],
        [7, 26],
        [10, 23],
        [2, 31],
        [15, 18],
    ],
};
const BRACKET_LINE_PATTERN = /^\s*(\d+)\s*-\s*(.+?)\s*$/;
function parseBracketInput(rawInput, size) {
    const lines = rawInput
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
    if (lines.length !== size) {
        throw new Error(`Expected exactly ${size} entries, received ${lines.length}.`);
    }
    const entries = lines.map((line, index) => {
        const match = line.match(BRACKET_LINE_PATTERN);
        if (!match) {
            throw new Error(`Invalid line ${index + 1}. Expected format: "1014 - Beatrice [Re:Zero]".`);
        }
        const originalNumber = parseInt(match[1], 10);
        const name = match[2].trim();
        if (!name) {
            throw new Error(`Line ${index + 1} is missing a character name.`);
        }
        return {
            originalNumber,
            name,
            originalIndex: index,
        };
    });
    const loweredNames = new Set();
    for (const entry of entries) {
        const normalized = entry.name.toLocaleLowerCase();
        if (loweredNames.has(normalized)) {
            throw new Error(`Duplicate character name detected: "${entry.name}".`);
        }
        loweredNames.add(normalized);
    }
    return entries;
}
function sortBracketEntries(entries) {
    return [...entries]
        .sort((left, right) => {
        if (right.originalNumber !== left.originalNumber) {
            return right.originalNumber - left.originalNumber;
        }
        const nameCompare = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
        if (nameCompare !== 0) {
            return nameCompare;
        }
        return left.originalIndex - right.originalIndex;
    })
        .map((entry, index) => ({
        ...entry,
        seed: index + 1,
    }));
}
function buildBracketMatches(entries, size) {
    const entryBySeed = new Map(entries.map(entry => [entry.seed, entry]));
    return BRACKET_LAYOUTS[size].map(([seedA, seedB], index) => {
        const contestantA = entryBySeed.get(seedA);
        const contestantB = entryBySeed.get(seedB);
        if (!contestantA || !contestantB) {
            throw new Error('Bracket seeding failed. Missing seeded entrant.');
        }
        return {
            matchNumber: index + 1,
            a: contestantA.name,
            b: contestantB.name,
        };
    });
}
function sortBracket(rawInput, size) {
    const parsed = parseBracketInput(rawInput, size);
    const entries = sortBracketEntries(parsed);
    const matches = buildBracketMatches(entries, size);
    return { size, entries, matches };
}
//# sourceMappingURL=bracketSorter.js.map