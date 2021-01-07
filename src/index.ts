import Discord, { Collection, DMChannel, Message, NewsChannel, PermissionResolvable, TextChannel } from "discord.js";
import * as fs from "fs";
import FeedEmitter from 'rss-feed-emitter';
import Turndown from "turndown";
const feeder = new FeedEmitter({userAgent: "Mozilla/3.0"});
const turndown = new Turndown({emDelimiter: "*", codeBlockStyle: "fenced"});
import log from "./log";

let cfg: {prefix: string, channels: {id: string, ping: string}[], token: string, visitedLinks: string[], rssUrl: string} = JSON.parse(fs.readFileSync("./config.json", { encoding: 'utf8' }));
function saveCfg() {
    fs.writeFile("./config.json", JSON.stringify(cfg, null, 2), ()=>{});
}

const client = new Discord.Client();
client.login(cfg.token).then(()=>{log.info("Ready.")});

client.on('message', message => {
    if (!message.content.startsWith(cfg.prefix) || message.author.bot) return;
    const args = message.content.slice(cfg.prefix.length).split(/ +/);
    const commandCall = args.shift().toLowerCase();

    switch (commandCall) {
        case "prefix": {
            cfg.prefix = args[0];
            saveCfg();
            break;
        }
        case "subscribe": {
            if (!cfg.channels) cfg.channels = [];
            let index = cfg.channels.findIndex((item)=>item.id == message.channel.id);
            if (index >= 0) {
                cfg.channels.splice(index, 1);
                message.channel.send("Du hast die EMA-Neuigkeiten für diesen Kanal abbestellt.")
            } else {
                cfg.channels.push({id: message.channel.id, ping: args[0] || "@everyone"});
                message.channel.send("Dieser Kanal erhält nun EMA-Neuigkeiten!");
            }
            saveCfg();
        }
    }
});

feeder.add({
    url: cfg.rssUrl,
    refresh: 120000
});

turndown.addRule('img', {
    filter: ["img"],
    replacement: (content) => {
        return "";
    }
})

feeder.on('new-item', async (item)=>{
    if (cfg.visitedLinks.includes(item.link)) return;
    cfg.visitedLinks.push(item.link);
    let text = turndown.turndown(item.description);

    saveCfg();
    log.info(`New RSS Item: ${item.title}`);
    for (let ch of cfg.channels) {
        let channel = await client.channels.fetch(ch.id);
        if (channel instanceof TextChannel || channel instanceof DMChannel || channel instanceof NewsChannel) {
            channel.send(ch.ping,new Discord.MessageEmbed({author: {name: "Neuer Beitrag auf ema-bonn.de"}, title: item.title, description: text.length > 2048 ? text.substr(0,2045) + "..." : text, timestamp: item.date, url: item.link, footer: {text: item.author}}));
            log.info(`Sent to ${channel.id}`);
        }
    }
})