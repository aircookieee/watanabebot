const Discord = require('discord.js');
const auth = require('./auth.json');

var watashiSearch = /(?<![a-zA-Z])You(?![a-zA-Z])/gm;
var animeChannelID = "259185701294178304";
var mentionSearch;
var commandSearch = /^!yousoro(?:$| (.+))/

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
    animeChannelID = channel.id;
    channel.send("Yousoro~!", {
        files: [{
            attachment: "yousoroHere.png"
        }]
    });
}

function yousoroEverywhere(channel) {
    animeChannelID = "";
    channel.send("Zensokuzenshin... Yousoro~!", {
        files: [{
            attachment: "yousoroEverywhere.jpg"
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

// Initialize Discord Bot
var bot = new Discord.Client();

bot.login(auth.token);

bot.on('ready', () => {
    console.log('Connected');
    console.log('Logged in as: ');
    console.log(bot.user.username + ' - (' + bot.user.id + ')');
    mentionSearch = new RegExp("@" + bot.user.id, 'gm');
});

bot.on('message', message => {
    var content = message.content;
    var command = content.match(commandSearch);
    var channel= message.channel;

    if (command != null) {
        if (command[0] == "!yousoro") {
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
            if (animeChannelID == "" || channel.id == animeChannelID) {
                watashi(channel);
            }
        }

        if (content.search(mentionSearch) > -1) {
            watashi(channel);
        }
    }
});