import Discord, { Collection, DMChannel, Message, NewsChannel, PermissionResolvable, TextChannel } from "discord.js";
import * as fs from "fs";
import FeedEmitter from 'rss-feed-emitter';
import Turndown from "turndown";
const feeder = new FeedEmitter();
const turndown = new Turndown({emDelimiter: "*", codeBlockStyle: "fenced"});
import log from "./log";

let cfg: {prefix: string, channels: string[], token: string, visitedLinks: string[], rssUrl: string} = JSON.parse(fs.readFileSync("./config.json", { encoding: 'utf8' }));
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
            if (cfg.channels.includes(message.channel.id)) {
                let index = cfg.channels.indexOf(message.channel.id);
                cfg.channels.splice(index, 1);
                message.channel.send("Du hast die EMA-Neuigkeiten für diesen Kanal abbestellt.")
            } else {
                cfg.channels.push(message.channel.id);
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
    for (let id of cfg.channels) {
        let channel = await client.channels.fetch(id);
        if (channel instanceof TextChannel || channel instanceof DMChannel || channel instanceof NewsChannel) {
            channel.send("@everyone",new Discord.MessageEmbed({author: {}, title: item.title, description: text.length > 2048 ? text.substr(0,2045) + "..." : text, timestamp: item.date, url: item.link, footer: {text: item.author}}));
            log.info(`Sent to ${channel.id}`);
        }
    }
})