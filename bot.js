const Discord = require('discord.js');
const auth = require('./auth.json');
const fs = require('fs');

var watashiSearch = /(?<![a-zA-Z])You(?![a-zA-Z])/gm;
var animeChannelID;
var mentionSearch;
var commandSearch = /^!yousoro(?:$| (.+))/
var databasePath = 'database.json';

try {
    var database = fs.readFileSync(databasePath);
    animeChannelID = JSON.parse(database);
} catch (err) {
    if (err.code = 'ENOENT') {
        var fd = fs.openSync(databasePath, 'w+');
        fs.closeSync(fd);
        animeChannelID = {};
    } else {
        throw err;
    }
}

function watashi(channel) {
    channel.send("Watashi?", {
        files: [{
            attachment: "watashi.jpg"
        }]
    });
}

function yousoroInfo(channel) {
    channel.send("Yousoro, sailor!\n\nI can `!yousoro here` or `!yousoro everywhere`.", {
        files: [{
            attachment: "ohayousoro.png"
        }]
    });
}

function yousoroHere(channel) {
    animeChannelID[channel.guild.id] = channel.id;
    writeDatabase();
    channel.send("Yousoro~!", {
        files: [{
            attachment: "yousoroHere.png"
        }]
    });
}

function yousoroEverywhere(channel) {
    animeChannelID[channel.guild.id] = "";
    writeDatabase();
    channel.send("Zensokuzenshin... Yousoro~!", {
        files: [{
            attachment: "yousoroEverywhere.jpg"
        }]
    });
}

function yousoroDMs(channel) {
    channel.send("Yousor- hey, wait a sec, this isn't a Discord server...", {
        files: [{
            attachment: "dms.png"
        }]
    });
}

function nosoro(channel) {
    channel.send({
        files: [{
            attachment: "nosoro.gif"
        }]
    });
}

function writeDatabase() {
    fs.writeFileSync(databasePath, JSON.stringify(animeChannelID));
}

// Initialize Discord Bot
var bot = new Discord.Client();

bot.login(auth.token);

bot.on('ready', () => {
    console.log('Connected');
    console.log('Logged in as: ');
    console.log(bot.user.username + ' - (' + bot.user.id + ')');
    mentionSearch = new RegExp("@" + bot.user.id, 'gm');
    for (const guild of bot.guilds.array()) {
        if (animeChannelID[guild.id] == null) {
            animeChannelID[guild.id] = "";
            writeDatabase();
        }
    }
});

bot.on('guildCreate', guild => {
    animeChannelID[guild.id] = "";
    writeDatabase();
});

bot.on('guildDelete', guild => {
    delete animeChannelID[guild.id];
    writeDatabase();
})

bot.on('message', message => {
    var content = message.content;
    var command = content.match(commandSearch);
    var channel = message.channel;

    if (command != null) {
        if (message.guild == null) {
            yousoroDMs(channel);
        } else if (command[0] == "!yousoro") {
            yousoroInfo(channel);
        } else if (message.member.hasPermission('ADMINISTRATOR') && command.length >= 2) {
            var arg = command[1];
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
    } else if (message.author.id != bot.user.id) {
        if (content.search(watashiSearch) > -1) {
            if (message.guild == null || animeChannelID[message.guild.id] == "" || animeChannelID[message.guild.id] == message.channel.id) {
                watashi(channel);
            }
        }

        if (content.search(mentionSearch) > -1) {
            watashi(channel);
        }
    }
});
