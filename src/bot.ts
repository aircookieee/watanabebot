import Discord = require("discord.js");
import fs = require("fs");

const auth = require("./auth.json");

let watashiSearch = /(?<![a-zA-Z])You(?![a-zA-Z])/gm;
let animeChannelID: {
  [guildID: string]: string;
};
let mentionSearch: RegExp;
let commandSearch = /^!yousoro(?:$| (.+))/;
let databasePath = "database.json";

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

function watashi(channel: Discord.TextChannel | Discord.DMChannel) {
  channel.send("Watashi?", {
    files: [
      {
        attachment: "resources/watashi.jpg",
      },
    ],
  });
}

function yousoroInfo(channel: Discord.TextChannel) {
  channel.send(
    "Yousoro, sailor!\n\nI can `!yousoro here` or `!yousoro everywhere`.",
    {
      files: [
        {
          attachment: "resources/ohayousoro.png",
        },
      ],
    }
  );
}

function yousoroHere(channel: Discord.TextChannel) {
  animeChannelID[channel.guild.id] = channel.id;
  writeDatabase();
  channel.send("Yousoro~!", {
    files: [
      {
        attachment: "resources/yousoroHere.png",
      },
    ],
  });
}

function yousoroEverywhere(channel: Discord.TextChannel) {
  animeChannelID[channel.guild.id] = "";
  writeDatabase();
  channel.send("Zensokuzenshin... Yousoro~!", {
    files: [
      {
        attachment: "resources/yousoroEverywhere.jpg",
      },
    ],
  });
}

function yousoroDMs(channel: Discord.DMChannel) {
  channel.send("Yousor- hey, wait a sec, this isn't a Discord server...", {
    files: [
      {
        attachment: "resources/dms.png",
      },
    ],
  });
}

function nosoro(channel: Discord.TextChannel | Discord.DMChannel) {
  channel.send({
    files: [
      {
        attachment: "resources/nosoro.gif",
      },
    ],
  });
}

function writeDatabase() {
  fs.writeFileSync(databasePath, JSON.stringify(animeChannelID));
}

// Initialize Discord Bot
let bot = new Discord.Client();

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
    if (content.search(watashiSearch) > -1) {
      if (
        !message.guild ||
        animeChannelID[message.guild.id] == "" ||
        animeChannelID[message.guild.id] == message.channel.id
      ) {
        watashi(channel);
      }
    }

    if (content.search(mentionSearch) > -1) {
      watashi(channel);
    }
  }
});
