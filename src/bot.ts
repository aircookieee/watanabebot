import Discord = require("discord.js");
import fs = require("fs");

const auth = require("./auth.json");

let watashiSearch = /(?<![a-zA-Z])You(?!\s*\(not [Ww]atanabe\)|[a-zA-Z])/gm;
let smolWatashiSearch = /(?<![a-zA-Z])you-chan(?!\s*\(not [Ww]atanabe\)|[a-zA-Z])/gm;
let yesWatanabeSearch = /\(yes Watanabe\)/gm;
let animeChannelID: {
  [guildID: string]: string;
};
let mentionSearch: RegExp;
let commandSearch = /^!yousoro(?:$| (.+))/;
let databasePath = "database.json";
let bot: Discord.Client;

try {
  let database = fs.readFileSync(databasePath).toString();
  animeChannelID = JSON.parse(database);
} catch (err) {
  if ((err.code = "ENOENT")) {
    let fd = fs.openSync(databasePath, "w+");
    fs.closeSync(fd);
    animeChannelID = {};
  } else {
    throw err;
  }
}

function watashi(channel: Discord.TextChannel | Discord.DMChannel): void {
  if (channel instanceof Discord.TextChannel && !canSend(channel)) return;
  channel
    .send("Watashi?", {
      files: [
        {
          attachment: "resources/watashi.jpg",
        },
      ],
    })
    .catch();
}

function smolWatashi(channel: Discord.TextChannel | Discord.DMChannel): void {
  if (channel instanceof Discord.TextChannel && !canSend(channel)) return;
  channel
    .send("ʷᵃᵗᵃˢʰᶦˀ", {
      files: [
        {
          attachment: "resources/smolsoro.png",
        },
      ],
    })
    .catch();
}

function yousoroInfo(channel: Discord.TextChannel): void {
  if (canSend(channel)) {
    channel
      .send(
        "Yousoro, sailor!\n\nI can `!yousoro here` or `!yousoro everywhere`.",
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

function yesWatanabe(channel: Discord.TextChannel | Discord.DMChannel): void {
  if (channel instanceof Discord.TextChannel && !canSend(channel)) return;
  channel
    .send({
      files: [
        {
          attachment: "resources/yesWatanabe.png",
        },
      ],
    })
    .catch();
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

// Initialize Discord Bot
bot = new Discord.Client();

bot.login(auth.token);

bot.on("ready", () => {
  console.log("Connected");
  console.log("Logged in as: ");
  console.log(bot.user?.username + " - (" + bot.user?.id + ")");
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

  // Check if user is bot, skip if it is
  if (message.author.bot) return;

  if (
    message.channel instanceof Discord.TextChannel ||
    message.channel instanceof Discord.DMChannel
  )
    channel = message.channel;
  else return;

  if (command) {
    if (channel instanceof Discord.DMChannel) {
      yousoroDMs(channel);
    } else if (command[0] == "!yousoro") {
      yousoroInfo(channel);
    } else if (
      message.member?.hasPermission("ADMINISTRATOR") &&
      command.length >= 2
    ) {
      let arg = command[1];
      if (arg == "here") {
        yousoroHere(channel);
      } else if (arg == "everywhere") {
        yousoroEverywhere(channel);
      } else {
        nosoro(channel);
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
        if (content.search(yesWatanabeSearch) > -1) yesWatanabe(channel);
        else watashi(channel);
      } else if (content.search(smolWatashiSearch) > -1) {
        smolWatashi(channel);
      }
    }

    if (content.search(mentionSearch) > -1) {
      watashi(channel);
    }
  }
});
