import Discord = require("discord.js");
import fs = require("fs");
import ts = require("typescript");
import axios from "axios";
import * as deepl from "deepl-node";
import channelIDs from "./channelsID.json";
import SpotifyWebApi from "spotify-web-api-node";
import * as path from "path";
import * as AniList from "./anilist";
import { createAnimeEmbed } from "./commands";
import * as wordnik from "./words";
import cron from "node-cron";

const auth = require("../auth.json");

let watashiSearch = /(?<![a-zA-Z])You(?!\s*\(not [Ww]atanabe\)|[a-zA-Z])/gm;
let smolWatashiSearch =
  /(?<![a-zA-Z])you-chan(?!\s*\(not [Ww]atanabe\)|[a-zA-Z])/gm;
let yesWatanabeSearch = /\(yes [Ww]atanabe\)/gm;
let twitterLinkNew =
  /(https:\/\/((x.com)|(twitter.com))\/(\w+)(\/(\w+)\/(\w+))?)/gi;
let nitterLinkNew = /(https:\/\/nitter\.net\/(\w+)(\/(\w+)\/(\w+))?)/gi;
let animeChannelID: {
  [guildID: string]: string;
};
let mentionSearch: RegExp;
let commandSearch = /^!yousoro(?:$| (.+))/;
let databasePath = "database.json";
let bot: Discord.Client;

let twitterDir = "./twitter.txt";
if (!fs.existsSync(twitterDir)) {
  fs.writeFileSync(twitterDir, "false");
}
let twitterGlobalToggle: string = String(fs.readFileSync(twitterDir));
let pluralKitUID = "466378653216014359";

try {
  let database = fs.readFileSync(databasePath).toString();
  animeChannelID = JSON.parse(database);
} catch (err: any) {
  if ((err.code = "ENOENT")) {
    let fd = fs.openSync(databasePath, "w+");
    fs.closeSync(fd);
    animeChannelID = {};
  } else {
    throw err;
  }
}

function watashi(
  channel: Discord.TextChannel | Discord.DMChannel,
  message: Discord.Message,
): void {
  if (channel instanceof Discord.TextChannel && !canSend(channel)) return;
  message
    .react("1247638024372621442").catch((err) => {
      console.log("Couldn't react to message " + message.id);
    });
}

function smolWatashi(
  channel: Discord.TextChannel | Discord.DMChannel,
  message: Discord.Message,
): void {
  if (channel instanceof Discord.TextChannel && !canSend(channel)) return;
  message
    .react("1247638021482872944").catch((err) => {
      console.log("Couldn't react to message " + message.id);
    });
}

function yousoroInfo(channel: Discord.TextChannel): void {
  if (canSend(channel)) {
    channel
      .send(
        "Yousoro, sailor!\n\n`!yousoro here` makes me react only in this channel\n`!yousoro everywhere` makes me react in all channels\n`!yousoro theme <anime name>` will make me reply with the first animethemes link of your chosen anime (note: this is a bit broken)\n`!yousoro twitter <on/off>` will turn the twitter link replacement feature on or off.",
        {
          files: [
            {
              attachment: "resources/ohayousoro.png",
            },
          ],
        },
      )
      .catch();
  }
}

function yousoroHere(channel: Discord.TextChannel): void {
  if (canSend(channel)) {
    animeChannelID[channel.guild.id] = channel.id;
    writeDatabase();
    channel
      .send("Yousoro~!", {
        files: [
          {
            attachment: "resources/yousoroHere.png",
          },
        ],
      })
      .catch();
  }
}

function yousoroEverywhere(channel: Discord.TextChannel): void {
  if (canSend(channel)) {
    animeChannelID[channel.guild.id] = "";
    writeDatabase();
    channel
      .send("Zensokuzenshin... Yousoro~!", {
        files: [
          {
            attachment: "resources/yousoroEverywhere.jpg",
          },
        ],
      })
      .catch();
  }
}

function yousoroDMs(channel: Discord.DMChannel): void {
  channel
    .send("Yousor- hey, wait a sec, this isn't a Discord server...", {
      files: [
        {
          attachment: "resources/dms.png",
        },
      ],
    })
    .catch();
}

function nosoro(channel: Discord.TextChannel | Discord.DMChannel): void {
  if (channel instanceof Discord.TextChannel && !canSend(channel)) return;
  channel
    .send({
      files: [
        {
          attachment: "resources/nosoro.gif",
        },
      ],
    })
    .catch();
}

function yesWatanabe(
  channel: Discord.TextChannel | Discord.DMChannel,
  message: Discord.Message,
): void {
  if (channel instanceof Discord.TextChannel && !canSend(channel)) return;
  message
    .react("1247638018949644298").catch((err) => {
      console.log("Couldn't react to message " + message.id);
    });
}

function canSend(channel: Discord.TextChannel): boolean {
  let ret: boolean | undefined;
  if (bot instanceof Discord.Client && bot.user) {
    ret = channel.permissionsFor(bot.user)?.has("SEND_MESSAGES");
  }

  return ret ? ret : false;
}

function writeDatabase(): void {
  fs.writeFileSync(databasePath, JSON.stringify(animeChannelID));
}

// function to replace twitter links with vxtwitter (now with more X!)
function fixTwitterEmbeds(
  channel: Discord.TextChannel | Discord.DMChannel,
  message: Discord.Message,
) {
  if (message.webhookID && message.application?.id != pluralKitUID) return; // I hate everyone but pluralkit
  let vxLink = "";
  let finalMessage = "";
  let tmsg = message.content.match(twitterLinkNew)!; // I fuckign HATE regex
  if (tmsg == null) {
    tmsg = message.content.match(nitterLinkNew)!; // I fuckign HATE regex
  }
  for (let i = 0; i < tmsg.length; i++) {
    if (tmsg[i].includes("vxtwitter") || tmsg[i].includes("fxtwitter")) {
      continue;
    }
    if (tmsg[i].includes("https://x.com/")) {
      vxLink = tmsg[i].replace("x", "vxtwitter");
    } else if (tmsg[i].includes("https://twitter.com/")) {
      vxLink = tmsg[i].replace("twitter", "vxtwitter");
    } else if (tmsg[i].includes("https://nitter.net/")) {
      vxLink = tmsg[i].replace("nitter.net", "vxtwitter.com");
    }
    if (finalMessage.includes(vxLink)) continue;
    finalMessage = finalMessage.concat(vxLink + "\n");
  }
  channel.send(finalMessage).catch((err) =>
    console.log("Exception occurred! " + err)
  );
}

/* function buildAnimeThemesEmbed(animeThemesGeneralData: any, themeType: string) {
  console.log("https://v.animethemes.moe/" + animeThemesGeneralData.anime.slug + "-" + themeType + ".webm")
  const animeThemesEmbed = new Discord.MessageEmbed()
    .setColor(0x0099FF)
    .setTitle(String(animeThemesGeneralData.anime.name))
    .setURL("https://animethemes.moe/anime/" + animeThemesGeneralData.anime.slug)
    .setAuthor({name: "You-chan's Magic Cannon", iconURL: "https://files.catbox.moe/jr6tkw.jpg"})
    .setVideo = ("https://v.animethemes.moe/" + animeThemesGeneralData.anime.slug + "-" + themeType + ".webm")
  return animeThemesEmbed;
}

async function sendAnimeThemesWebhook(channel: Discord.TextChannel) {
  let webhook = await channel.createWebhook("You-chan's Magic Cannon", {avatar: "https://files.catbox.moe/jr6tkw.jpg"})
  await webhook.send(embed);
  webhook.delete();
} */

async function animeThemesVideo(animeString: string) {
  try {
    let { data } = await axios.get(
      "https://api.animethemes.moe/video/?q=" + animeString,
    );
    return data;
  } catch (err) {
    console.log(err);
  }
}

async function callAnimeThemes(arg: string, channel: Discord.TextChannel) {
  const animeName = arg.slice(6);
  const animeThemesVideoData = await animeThemesVideo(animeName);
  try {
    channel.send(
      "[" + animeThemesVideoData.videos["0"].filename + " (" +
      animeThemesVideoData.videos["0"].source + ")](" +
      animeThemesVideoData.videos["0"].link + ")",
    );
  } catch (err) {
    channel.send(
      "No themes found, either the animethemes search sucks or you misspelled something.",
    );
  }
}

async function requestTranslationData(
  messageEmbed: Discord.MessageEmbed,
): Promise<string> {
  const translator = new deepl.Translator(auth.deeplAuthKey);
  console.log("Translator created successfully");
  if (messageEmbed.description == null) {
    console.log("Embed description empty!");
    return "";
  }
  let tlTextResult = await translator.translateText(
    messageEmbed.description,
    "ja",
    "en-US",
  ); // let's hope this never times out
  return tlTextResult.text;
}

async function translateEmbedData(message: Discord.Message) {
  let deeplOutput = await requestTranslationData(message.embeds[0]);
  console.log("Got translation data: " + deeplOutput);
  message.channel.send(deeplOutput);
}

// SPOTIFY RANDOM SONG PICKER


// Set up the Spotify API client with credentials
const spotifyApi = new SpotifyWebApi({
  clientId: auth.spotifyID,
  clientSecret: auth.spotifySecret,
});

// Authenticate (OAuth flow, user login or client credentials)
async function authenticate() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body["access_token"]);
    console.log("Access token retrieved successfully");
  } catch (error) {
    console.error("Failed to authenticate", error);
  }
}


// Fetch tracks from Spotify
async function getPlaylistTracks(
  playlistId: string,
): Promise<
  {
    title: string;
    link: string;
    uri: string;
    albumCover: string;
    artists: string;
  }[]
> {
  let trackData: {
    title: string;
    link: string;
    uri: string;
    albumCover: string;
    artists: string;
  }[] = [];
  let offset = 0;
  const limit = 100;

  try {
    let response;
    do {
      response = await spotifyApi.getPlaylistTracks(playlistId, {
        offset,
        limit,
        fields:
          "items.track.name,items.track.uri,items.track.external_urls.spotify,items.track.album.images,items.track.artists,total",
      });

      const tracks = response.body.items
        .filter((item) => item.track !== null)
        .map((item) => ({
          title: item.track!.name,
          link: item.track!.external_urls.spotify,
          uri: item.track!.uri,
          albumCover: item.track!.album.images[0]?.url || "", // Get the largest album cover, fallback to empty string if not available
          artists: item.track!.artists.map((artist) => artist.name).join(", "), // Extract and join the artist names
        }));

      trackData.push(...tracks);
      offset += limit;
    } while (trackData.length < response.body.total);
  } catch (error) {
    console.error("Failed to fetch tracks", error);
  }
  return trackData;
}

// Shuffle and select tracks randomly
class PlaylistRandomizer {
  private tracks: {
    title: string;
    link: string;
    uri: string;
    albumCover: string;
    artists: string;
  }[];

  constructor(
    tracks: {
      title: string;
      link: string;
      uri: string;
      albumCover: string;
      artists: string;
    }[],
  ) {
    this.tracks = tracks;
  }

  private shuffleArray(
    array: {
      title: string;
      link: string;
      uri: string;
      albumCover: string;
      artists: string;
    }[],
  ): {
    title: string;
    link: string;
    uri: string;
    albumCover: string;
    artists: string;
  }[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  getNextTrack(): {
    title: string;
    link: string;
    albumCover: string;
    artists: string;
  } | null {

    let shuffledTracks = this.shuffleArray([...this.tracks]);
    for (let track of shuffledTracks) {
      return {
        title: track.title,
        link: track.link,
        albumCover: track.albumCover,
        artists: track.artists,
      };
    }

    return null;
  }
}

// Initialize Discord Bot
bot = new Discord.Client();

bot.login(auth.token);
var loveLiveChannel: Discord.Channel;
bot.on("ready", () => {
  console.log("Connected");
  console.log("Logged in as: ");
  console.log(bot.user?.username + " - (" + bot.user?.id + ")");
  console.log("You-chan started at " + new Date());
  // console.log("DeepL Auth Key: " + auth.deeplAuthKey);
  mentionSearch = new RegExp("<@!?" + bot.user?.id + ">", "gm");
  for (const [id, guild] of bot.guilds.cache) {
    if (!animeChannelID[id]) {
      animeChannelID[id] = "";
      writeDatabase();
    }
  }

  cron.schedule("5 4 * * *", () => {
    console.log("Love Live time!");
    const channelId = channelIDs.loveLiveMusicChannelID;
    bot.channels.fetch(channelId, true).then((channel) =>
      loveLiveChannel = channel
    );
    timeToLoveLive();
  });
  cron.schedule("0 */3 * * *", async () => {
    console.log(`[${new Date().toISOString()}] Auto-updating AniList data...`);
    try {
      await AniList.updateAniListData();
      await AniList.updateFavoritesData();
      console.log(
        `[${new Date().toISOString()}] AniList data updated successfully.`,
      );
    } catch (e) {
      console.error(
        `[${new Date().toISOString()}] Failed to update AniList data:`,
        e,
      );
    }
  });
});

bot.on("guildCreate", (guild) => {
  animeChannelID[guild.id] = "";
  writeDatabase();
});

bot.on("guildDelete", (guild) => {
  delete animeChannelID[guild.id];
  writeDatabase();
});

bot.on("message", async (message) => {
  let content = message.content;
  let command = content.match(commandSearch);
  let channel: Discord.TextChannel | Discord.DMChannel | undefined;

  // Check if user is bot and not a webhook, skip if both conditions are met
  if (message.author.bot && !message.webhookID) {
    return;
  }

  if (
    message.channel instanceof Discord.TextChannel ||
    message.channel instanceof Discord.DMChannel
  ) {
    channel = message.channel;
  } else return;

  // call deepl translation API on current message
  /* if (message.embeds[0] != null)
    console.log(new Date() + " Embed found, expected " + webhookIDs.musicartWebhookID + ", got author ID " + message.author.id + " webhook ID " + message.webhookID); */
  if (
    message.author.id == channelIDs.musicartWebhookID &&
    message.embeds[0].description != ""
  ) {
    console.log("Called function on message " + message.id);
    translateEmbedData(message);
  }

  if (twitterGlobalToggle == "true") {
    if (
      content.includes("https://x.com/") ||
      content.includes("https://twitter.com/") ||
      content.includes("https://nitter.net/")
    ) {
      fixTwitterEmbeds(channel, message);
    }
  }
  if (command) {
    if (channel instanceof Discord.DMChannel) {
      yousoroDMs(channel);
    } else if (command[0] == "!yousoro") {
      yousoroInfo(channel);
    } else if (command[1].slice(0, 5) == "theme") {
      callAnimeThemes(command[1], channel);
    } else if (
      message.member?.hasPermission("ADMINISTRATOR") &&
      command.length >= 2
    ) {
      let arg = command[1];
      if (arg == "here") {
        yousoroHere(channel);
      } else if (arg == "everywhere") {
        yousoroEverywhere(channel);
      } else if (arg == "twitter on") {
        twitterGlobalToggle = "true";
        channel.send("Twitter Link Replacement is **ON**");
        fs.writeFileSync(twitterDir, String(twitterGlobalToggle));
      } else if (arg == "twitter off") {
        twitterGlobalToggle = "false";
        channel.send("Twitter Link Replacement is **OFF**");
        fs.writeFileSync(twitterDir, String(twitterGlobalToggle));
      }
    } else {
      nosoro(channel);
    }
  } else if (content.startsWith("!define")) {
    const args = content.trim().split(" ").slice(1);
    if (args.length === 0) {
      channel.send("Usage: `!define <word>`");
      return;
    }
    const word = args.join(" ");
    try {
      const api = wordnik.initWordnik(auth.wordnikKey);
      const data = await wordnik.getWordData(api, word);
      if (data.error) {
        channel.send(data.error);
      } else {
        const embed = wordnik.makeDiscordEmbed(data);
        channel.send(embed);
      }
    } catch (error) {
      console.error("Error fetching definitions: ", error);
      channel.send("Something went wrong while fetching definitions");
    }
  } else if (content.startsWith("!al")) {
    const args = content.trim().split(" ").slice(1);
    const sub = args[0]?.toLowerCase();
    const rest = args.slice(1).join(" ");
    const fullQuery = [sub, rest].filter(Boolean).join(" ");

    // Register: !al register <username>
    if (sub === "register" && args[1]) {
      await AniList.registerUser(message.author.id, args[1]);
      channel.send(`Registered \`${args[1]}\` to <@${message.author.id}>.`);
    }
    else if (sub === "unregister") {
      if (await AniList.unregisterUser(message.author.id)) {
        channel.send(`Unregistered <@${message.author.id}>.`);
      } else {
        channel.send(`Could not unregister <@${message.author.id}>.`);
      }
    } // Update: !al update
    else if (sub === "update") {
      channel.send(`Updating AniList data...`).then(async msg => {
        const sTime = performance.now();
        await AniList.updateAniListData();
        await AniList.updateFavoritesData();
        const eTime = performance.now();
        msg.edit(`AniList data updated, took ${Math.round(eTime - sTime) / 1000}s.`);
      });
    } // Default: !al <anime name>
    else if (fullQuery.length > 0) {
      const sTime = performance.now();
      await AniList.updateUserAniList(message.author.id);
      let animeInfo;
      let retries = 2;
      while (retries > 0) {
        try {
          animeInfo = await AniList.getAnimeInfoWithScores(fullQuery);
          if (animeInfo) break;
        } catch (err) {
          console.error("AniList query failed, retrying...", err);
        }
        retries--;
        await new Promise(res => setTimeout(res, 1000));
      }
      if (!animeInfo) {
        channel.send("Failed to fetch anime info after multiple attempts.");
        return;
      }
      const embed = createAnimeEmbed(
        animeInfo.resolvedTitle,
        animeInfo.anilistURL,
        animeInfo.description,
        animeInfo.score,
        animeInfo.coverImage,
        animeInfo.matches,
        sTime,
      );
      channel.send(embed);
    }
    else {
      channel.send(
        "Usage:\n• `!al <anime name>`\n• `!al register <AniList username>`\n• `!al unregister`\n• `!al update`",
      );
    }
  } else if (message.author.id != bot.user?.id) {
    if (
      !message.guild ||
      animeChannelID[message.guild.id] == "" ||
      animeChannelID[message.guild.id] == message.channel.id
    ) {
      if (content.search(watashiSearch) > -1) {
        if (content.search(yesWatanabeSearch) > -1) {
          yesWatanabe(channel, message);
        } else watashi(channel, message);
      } else if (content.search(smolWatashiSearch) > -1) {
        smolWatashi(channel, message);
      }
    }

    if (content.search(mentionSearch) > -1) {
      watashi(channel, message);
    }
  }
});

async function timeToLoveLive() {
  await authenticate();

  const tracks = await getPlaylistTracks(channelIDs.playlistID);

  if (tracks.length === 0) {
    console.log("No tracks found in the playlist.");
    return;
  }

  const playlistRandomizer = new PlaylistRandomizer(tracks);

  const track = playlistRandomizer.getNextTrack();
  if (track) {
    const fullName = track.artists + " - " + track.title;
    const trackAppleMusic = fullName.replace(/ /gm, "%20");
    const trackYTMusic = fullName.replace(/ /gm, "+");
    const finishDate = new Date();
    if (loveLiveChannel && loveLiveChannel.isText()) {
      const embed = new Discord.MessageEmbed()
        .setColor("#e4007f") // RABURAIBU
        .setTitle(`Love Live time!`)
        .setURL(track.link)
        .setDescription(
          `Today's song is:\n**${fullName}**\n\n[Listen on Spotify](${track.link})\n[Listen on Apple Music](https://music.apple.com/us/search?term=${trackAppleMusic}})\n[Listen on YouTube Music](https://music.youtube.com/search?q=${trackYTMusic})`,
        )
        .setImage(track.albumCover) // Set the album cover as image
        .setFooter(
          `What the fuck did you just fucking say about μ's, you little bitch?`,
        );
      await loveLiveChannel.send(embed);
    } else {
      console.error(`Channel ${loveLiveChannel} not found or not text-based.`);
    }
  }
}
