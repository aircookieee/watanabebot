import axios from 'axios';
import { TextChannel } from 'discord.js';
import { Fact } from '../types';

const FACTS_API = 'https://thefact.space/random';

export async function getRandomFact(): Promise<Fact | null> {
    try {
        const response = await axios.get(FACTS_API);
        return {
            text: response.data.text || '',
            source: response.data.source || 'Unknown',
            source_url: response.data.source || '',
            id: String(response.data.index || ''),
        };
    } catch (error) {
        console.error('Failed to fetch random fact:', error);
        return null;
    }
}

export async function postDailyFact(channel: TextChannel): Promise<void> {
    try {
        const fact = await getRandomFact();
        if (!fact) {
            console.error('Failed to get fact, skipping post');
            return;
        }

        const { EmbedBuilder } = await import('discord.js');
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
    } catch (error) {
        console.error('Error posting daily fact:', error);
    }
}
