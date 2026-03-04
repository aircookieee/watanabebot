"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRandomFact = getRandomFact;
exports.postDailyFact = postDailyFact;
const axios_1 = __importDefault(require("axios"));
const FACTS_API = 'https://thefact.space/random';
async function getRandomFact() {
    try {
        const response = await axios_1.default.get(FACTS_API);
        return {
            text: response.data.text || '',
            source: response.data.source || 'Unknown',
            source_url: response.data.source || '',
            id: String(response.data.index || ''),
        };
    }
    catch (error) {
        console.error('Failed to fetch random fact:', error);
        return null;
    }
}
async function postDailyFact(channel) {
    try {
        const fact = await getRandomFact();
        if (!fact) {
            console.error('Failed to get fact, skipping post');
            return;
        }
        const { EmbedBuilder } = await Promise.resolve().then(() => __importStar(require('discord.js')));
        const embed = new EmbedBuilder()
            .setColor(0xf39c12)
            .setTitle(`Fact #${fact.id}`)
            .setDescription(fact.text)
            .setFooter({ text: fact.source || 'Unknown' });
        if (fact.source_url && fact.source_url.length > 0) {
            embed.setURL(fact.source_url);
        }
        await channel.send({ embeds: [embed] });
        console.log(`[${new Date().toISOString()}] Posted daily fact to ${channel.name}`);
    }
    catch (error) {
        console.error('Error posting daily fact:', error);
    }
}
//# sourceMappingURL=facts.js.map