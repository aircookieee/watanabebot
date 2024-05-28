# Mugcord's you-chan!
![You-chan](https://files.catbox.moe/5fvr0c.png)

It's a ~~dumb~~ cute Discord bot I fixed and modified (I added features too!) to work with one very specific discord server. Modifying the code is probably needed if you want to host this yourself.
Reacts with various emojis of You Watanabe from Love Live! Sunshine!! if someone accidentally summons her.

# Usage

Will automatically react to summons in all channels by default.

You can set the bot to only respond in a certain channel by saying `!yousoro here` in the channel. Say `!yousoro everywhere` to have the bot respond in all channels again.

_NOTE: If you don't have the Administrator permission, these commands will not work and You will not be happy. Invalid commands will also make You unhappy._

Type `!yousoro` for the list of commands.

# Installation

  

1. Install [Node.js](https://nodejs.org/en/)

2. Pull the repository

3. Create a [Discord application](https://discordapp.com/developers/applications)

4. Create a bot from the left sidebar

5. Put your token in `auth.json`

6. Run `npm install; npm run tsc`

7. Copy `auth.json` to `build/`

8. Copy `resources/` to `build/`

9. Create `twitter.txt` in `build/` and write `false` in it

10. Run `npm build/bot.js`

11. Join the bot to your server

~~haha, 98~~

# Credits
[README art](https://x.com/i/web/status/1150801061872930816) by wasteman800
Thanks to stuff#6454 for the small You neso picture and feature inspiration
