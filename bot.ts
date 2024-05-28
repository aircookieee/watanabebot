import Discord = require("discord.js");
import fs = require("fs");
import ts = require("typescript");
import axios from "axios";
import * as deepl from 'deepl-node';
import webhookIDs from './channelsID.json';

const auth = require("../auth.json");

let watashiSearch = /(?<![a-zA-Z])You(?!\s*\(not [Ww]atanabe\)|[a-zA-Z])/gm;
let smolWatashiSearch = /(?<![a-zA-Z])you-chan(?!\s*\(not [Ww]atanabe\)|[a-zA-Z])/gm;
let yesWatanabeSearch = /\(yes [Ww]atanabe\)/gm;
let twitterLinkNew = /(https:\/\/((x.com)|(twitter.com))\/(\w+)(\/(\w+)\/(\w+))?)/gi;
let nitterLinkNew = /(https:\/\/nitter\.net\/(\w+)(\/(\w+)\/(\w+))?)/gi;
let animeChannelID: {
  [guildID: string]: string;
};
let mentionSearch: RegExp;
let commandSearch = /^!yousoro(?:$| (.+))/;
let databasePath = "database.json";
let bot: Discord.Client;

let twitterGlobalToggle: string = String(fs.readFileSync("watanabebot/build/twitter.txt"));
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

function watashi(channel: Discord.TextChannel | Discord.DMChannel, message: Discord.Message): void {
  if (channel instanceof Discord.TextChannel && !canSend(channel)) return;
  message
    .react("1122673094750896228").catch(err => {channel.send("Nosoro :(")});
}

function smolWatashi(channel: Discord.TextChannel | Discord.DMChannel, message: Discord.Message): void {
  if (channel instanceof Discord.TextChannel && !canSend(channel)) return;
  message
    .react("853643607612325888").catch(err => {channel.send("Nosoro :(")});
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
        }
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

function yesWatanabe(channel: Discord.TextChannel | Discord.DMChannel, message: Discord.Message): void {
  if (channel instanceof Discord.TextChannel && !canSend(channel)) return;
  message
    .react("911047098236010566").catch(err => {channel.send("Nosoro :(")});
}

function canSend(channel: Discord.TextChannel): boolean {
  let ret: boolean | undefined;
  if (bot instanceof Discord.Client && bot.user)
    ret = channel.permissionsFor(bot.user)?.has("SEND_MESSAGES");

  return ret ? ret : false;
}

function writeDatabase(): void {
  fs.writeFileSync(databasePath, JSON.stringify(animeChannelID));
}

// function to replace twitter links with vxtwitter (now with more X!)
function fixTwitterEmbeds(channel: Discord.TextChannel | Discord.DMChannel, message: Discord.Message) {
  if (message.webhookID && message.application?.id != pluralKitUID) return;  // I hate everyone but pluralkit
  let vxLink = "";
  let finalMessage = "";
  let tmsg = message.content.match(twitterLinkNew)!;  // I fuckign HATE regex
  if (tmsg == null)
    tmsg = message.content.match(nitterLinkNew)!; // I fuckign HATE regex
  for (let i = 0; i < tmsg.length; i++) {
    if (tmsg[i].includes("vxtwitter") || tmsg[i].includes("fxtwitter")) continue;
    if (tmsg[i].includes("https://x.com/"))
      vxLink = tmsg[i].replace("x", "vxtwitter");
    else if (tmsg[i].includes("https://twitter.com/"))
      vxLink = tmsg[i].replace("twitter", "vxtwitter");
    else if (tmsg[i].includes("https://nitter.net/"))
      vxLink = tmsg[i].replace("nitter.net", "vxtwitter.com");
    if (finalMessage.includes(vxLink)) continue;
    finalMessage = finalMessage.concat(vxLink + "\n");
  }
  channel.send(finalMessage).catch(err => console.log("Exception occurred! " + err));
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
      "https://api.animethemes.moe/video/?q=" + animeString
    )
    return data;
  } catch(err){
    console.log(err);
  }
}

async function callAnimeThemes(arg: string, channel: Discord.TextChannel){
  const animeName = arg.slice(6);
  const animeThemesVideoData = await animeThemesVideo(animeName)
  try {
  channel.send("["+ animeThemesVideoData.videos['0'].filename + " (" + animeThemesVideoData.videos['0'].source +")]("+animeThemesVideoData.videos['0'].link+")");
  } catch(err){channel.send("No themes found, either the animethemes search sucks or you misspelled something.")}
}

async function requestTranslationData(messageEmbed: Discord.MessageEmbed): Promise<string> {
  const translator = new deepl.Translator(auth.deeplAuthKey);
  console.log("Translator created successfully");
  if (messageEmbed.description == null) {
    console.log("Embed description empty!");
    return "";
  }
  let tlTextResult = await translator.translateText(messageEmbed.description, 'ja', 'en-US'); // let's hope this never times out
  return tlTextResult.text;
}

async function translateEmbedData(message: Discord.Message) {
  let deeplOutput = await requestTranslationData(message.embeds[0]);
  console.log("Got translation data: " + deeplOutput);
  message.channel.send(deeplOutput);
}

// Initialize Discord Bot
bot = new Discord.Client();

bot.login(auth.token);

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
});

bot.on("guildCreate", (guild) => {
  animeChannelID[guild.id] = "";
  writeDatabase();
});

bot.on("guildDelete", (guild) => {
  delete animeChannelID[guild.id];
  writeDatabase();
});

bot.on("message", (message) => {
  let content = message.content;
  let command = content.match(commandSearch);
  let channel: Discord.TextChannel | Discord.DMChannel | undefined;

  // Check if user is bot and not a webhook, skip if both conditions are met
  if (message.author.bot && !message.webhookID) 
    return;

  if (
    message.channel instanceof Discord.TextChannel ||
    message.channel instanceof Discord.DMChannel
  )
    channel = message.channel;
  else return;

  // call deepl translation API on current message
  /* if (message.embeds[0] != null) 
    console.log(new Date() + " Embed found, expected " + webhookIDs.musicartWebhookID + ", got author ID " + message.author.id + " webhook ID " + message.webhookID); */
  if (message.author.id == webhookIDs.musicartWebhookID && message.embeds[0].description != "") {
    console.log("Called function on message " + message.id)
    translateEmbedData(message);
  }

  if (twitterGlobalToggle == "true")
    if (content.includes("https://x.com/") || content.includes("https://twitter.com/") || content.includes("https://nitter.net/")) 
      fixTwitterEmbeds(channel, message);
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
          fs.writeFileSync('build/twitter.txt', String(twitterGlobalToggle));
      } else if (arg == "twitter off") {
          twitterGlobalToggle = "false";
          channel.send("Twitter Link Replacement is **OFF**");
          fs.writeFileSync('build/twitter.txt', String(twitterGlobalToggle));
      }
    } else {
      nosoro(channel);
    }
  } else if (message.author.id != bot.user?.id) {
    if (
      !message.guild ||
      animeChannelID[message.guild.id] == "" ||
      animeChannelID[message.guild.id] == message.channel.id
    ) {
      if (content.search(watashiSearch) > -1) {
        if (content.search(yesWatanabeSearch) > -1) yesWatanabe(channel, message);
        else watashi(channel, message);
      } else if (content.search(smolWatashiSearch) > -1) {
        smolWatashi(channel, message);
      }
    }

    if (content.search(mentionSearch) > -1) {
      watashi(channel, message);
    }
  }
});