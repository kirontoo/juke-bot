const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const axios = require('axios');
const fetchVideoInfo = require('youtube-info');
const token = process.env;

const bot = new Discord.Client();

var queue = [];
var nowPlaying = '';
var isPlaying = false;
var dispatcher = null;
var voiceChannel = null;
var stopStream = false;
var songsInQueue = [];

bot.login(token.bToken);

bot.on('ready', () => {
    console.log('bot logged in');
});

bot.on('message', (msg) => {
    if(!msg.guild) return;
    if(!msg.content.startsWith(token.prefix)) return;

    if(commands.hasOwnProperty(msg.content.toLowerCase().slice(token.prefix.length).split(' ')[0])) {
        if(msg.channel.id !== token.jukeboxText) return msg.reply('*scratches head* I thought this was supposed to work? I guess I\'ll try the jukebox text-channel.');
        commands[msg.content.toLowerCase().slice(token.prefix.length).split(' ')[0]](msg);
    } else {
        msg.reply("Sry. That command doesn't exist. Try one of these.");
        commands.help(msg);
    }
});

const commands = {
    'play': (msg) => {
        const song = msg.content.split(' ').slice(1).join(" ");

        if(!song && queue.length === 0) return msg.reply('Hey, I need a song first.');
        if(!msg.member.voiceChannel) return msg.reply('Dude, get in the jukebox voice channel.');
        if(msg.member.voiceChannel.name !== token.jukeboxVoice) return msg.reply('Hello? Jukebox voice channel.');
        if(!song && queue.length > 0) return playMusic(queue[0], msg);

        if(queue.length > 0 || isPlaying) {
            commands.add(msg, song);
        } else {
            getId(song).then( (id) => {
                playMusic(id, msg);
                msg.reply(`k. Give me a sec.`);
            }).catch( (err) => {
                console.log(err);
                msg.reply(`Sorry! Can\'t find ${song}.`);
            });
        }
    },

    'add': (msg, song) => {
        song = msg.content.split(' ').slice(1).join(" ");
        if(!song && queue.length > 0) return msg.reply('I can\'t add songs to the queue, if you dont\'t give me something to work with.');

        getId(song).then( (id) => {
            queue.push(id);
            fetchVideoInfo(id).then( (videoInfo) => {
                songsInQueue.push(videoInfo.title);
                msg.reply(`Added **${videoInfo.title}** to queue`);
            });
        }).catch( (err) => {
            msg.reply(`Sorry! Can\'t find ${song}.`);
        });
    },

    'song': (msg) => {
        if(!isPlaying) return msg.reply('Hm? Nothing\'s playing right now.');
        msg.reply(`Now playing **${nowPlaying}**`);
    },

    'stop': (msg) => {
        if(!isPlaying) return msg.reply('?? I\'m not streaming anything.');
        msg.channel.send('Fiiine. I\'ll stop streaming.');
        stopStream = true;
        isPlaying = false;
        dispatcher.end();
    },

    'pause': (msg) => {
        if(!isPlaying) return msg.reply('Sry, I can\'t pause life.');
        if(!dispatcher.paused){
            msg.channel.send('Alright, alright I\'ll pause the music.');
            dispatcher.pause();
            return;
        }
        msg.channel.send('Dude, I already paused the music.');
    },

    'resume': (msg) => {
        if(!isPlaying) return msg.reply('Resume? Resume what?');
        if(dispatcher.paused){
            msg.channel.send(`Woo! Continue playing **${nowPlaying}**.`);
            dispatcher.resume();
            return;
        }
        msg.channel.send('Did you mean \'!pause\'? Cus I\'m still playing music.');
    },

    'next': (msg) => {
        if(!isPlaying) return msg.reply('Uhh, I cant\'t skip if there\'s nothing playing. :p');
        if(queue.length > 0 || isPlaying) {
            msg.channel.send(`Aw, come on. It\'s a great song. Fine. Skipping the current song: **${nowPlaying}**`);
            dispatcher.end();
        }
    },

    'queue': (msg) => {
        if(!isPlaying) return msg.reply('I\'m not streaming right now.');
        if(songsInQueue.length === 0) return msg.reply(`Looks empty. Add a song with '!play' or '!add'.`);
        let songs = songsInQueue.join(', ');
        msg.reply(`Playing next: ${songs}`);
    },

    'time': (msg) => {
        if(!isPlaying) return msg.channel.send('0. I\'m not streaming.');
        msg.channel.send(`Time elapsed: ${Math.floor(dispatcher.time / 60000)}:${(dispatcher.time % 60000)/1000 <10 ? '0' + (dispatcher.time % 60000)/1000 : (dispatcher.time % 60000)/1000}`);
    },

    'help': (msg) => {
        msg.channel.send({embed: {
            "title": "Welcome to Juke-Bot commands!",
            "description": "These are the Juke-Bot commands. Use the prefix '!' to execute each command.",
            "color": 3447003,
            "footer": {
              "text": "Created by Kironto"
            },
            "author": {
              "name": bot.user.username,
              "icon_url": bot.user.avatarURL
            },
            "fields": [
              {
                  "name": "play",
                  "value": "Use '!play' followed by a song and artist or a youtube link to play the song."
              }, {
                  "name": "add",
                  "value": "Add a song to the queue. Remember to include a song or a youtube link.",
                  "inline": true
              }, {
                  "name": "next",
                  "value": "Play the next song.",
                  "inline": true
              }, {
                  "name": "stop",
                  "value": "Stop streaming music.",
                  "inline": true
              }, {
                "name": "pause",
                "value": "Pause the song.",
                "inline": true
              }, {
                "name": "resume",
                "value": "Continue playing the song.",
                "inline": true
              }, {
                  "name": "song",
                  "value": "Find out what song we're playing right now.",
                  "inline": true
              }, {
                "name": "queue",
                "value": "Find out what's in the queue.",
                "inline": true
              }, {
                "name": "time",
                "value": "Find out how long this song has been playing for.",
                "inline": true
              }, {
                "name": "help",
                "value": "View all commands.",
                "inline": true
            }
            ]
        }});
    }
};

const findVideo = async (song) => {
    try {
        const response = await axios.get(token.ytApi + encodeURIComponent(song) + `&key=${token.ytkey}`);
        const songId = response.data.items[0].id.videoId;
        if(songId) {
            return songId;
        } else {
            throw new Error();
        }
    } catch (err) {
        throw new Error(`Unable to find ${song}.`);
    }
};

const isYoutube = (str) =>  str.toLowerCase().indexOf('youtube.com') > -1;

const getYoutubeId = (song) => {
    return new Promise( (resolve, reject) => {
        const id = song.replace('https://www.youtube.com/watch?v=', '')

        if(id) {
            resolve(id);
        } else {
            reject('Unable to find youtube id.');
        }
    })
};

const getId = async (song) => {
    if(isYoutube(song)) {
        let id = await getYoutubeId(song);
        return id;
    }
    let id = await findVideo(song);
    return id;
};

const playMusic = (id, msg) => {
    voiceChannel = msg.member.voiceChannel;
    voiceChannel.join().then( (connection) => {
        const stream = ytdl(`https://www.youtube.com/watc?v=${id}`, {filter: 'audioonly'})
        dispatcher = connection.playStream(stream);
        dispatcher.on('start', () => {
            fetchVideoInfo(id).then((videoInfo) => {
                msg.channel.send(`Now playing: **${videoInfo.title}**`);
                nowPlaying = videoInfo.title;
                isPlaying = true;
                songsInQueue.shift();
                queue.shift();
            });
        });
        dispatcher.on('error', (e) => {
            console.log(e);
            msg.channel.send('Oops, there\'s been an error. Contact Amy.')
        });
        dispatcher.on('end', () => {
            if(queue.length === 0 || !isPlaying) {
                queue = [];
                songsInQueue = [];
                isPlaying = false;
                voiceChannel.leave();
                if(!stopStream) msg.channel.send('Oh, there\'s no more songs. Cya.');
                stopStream = false;
                return;
            } else {
                playMusic(queue[0], msg);
            }
        })
    }).catch(console.log);
};
