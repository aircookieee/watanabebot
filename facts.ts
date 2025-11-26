import axios from "axios";
import { TextChannel, MessageEmbed } from "discord.js";

const FACTS_API = "https://thefact.space/random";

export interface Fact {
  text: string;
  source?: string;
  source_url?: string;
  id?: string;
}

/**
 * Fetches a random fact from thefact.space API
 */
export async function getRandomFact(): Promise<Fact | null> {
  try {
    const response = await axios.get(FACTS_API);
    return {
      text: response.data.text || "",
      source: response.data.source || "Unknown",
      source_url: response.data.source || "",
      id: String(response.data.index || ""),
    };
  } catch (error) {
    console.error("Failed to fetch random fact:", error);
    return null;
  }
}

/**
 * Creates a Discord embed for the daily fact
 */
export function createFactEmbed(fact: Fact): MessageEmbed {
  const embed = new MessageEmbed()
    .setColor(0xf39c12)
    .setTitle(`Fact #${fact.id}`)
    .setDescription(fact.text)
    .setFooter(fact.source);

  if (fact.source_url) {
    embed.setURL(fact.source_url);
  }

  return embed;
}

/**
 * Posts the daily fact to a specified channel
 */
export async function postDailyFact(channel: TextChannel): Promise<void> {
  try {
    const fact = await getRandomFact();
    if (!fact) {
      console.error("Failed to get fact, skipping post");
      return;
    }

    const embed = createFactEmbed(fact);
    await channel.send(embed);
    console.log(`[${new Date().toISOString()}] Posted daily fact to ${channel.name}`);
  } catch (error) {
    console.error("Error posting daily fact:", error);
  }
}
