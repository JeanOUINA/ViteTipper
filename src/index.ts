import Twit, {ETwitterStreamEvent, TweetEntitiesV1} from "twitter-api-v2"
import Command from "./command"
import { promises as fs } from "fs"
import { join } from "path"
import { Autohook } from "twitter-autohook"
import { fetchUser } from "./users"
import { isAuthorized, setAuthorized } from "./dmauthorization"
import events from "./events"
import { BURN_ADDRESS, init } from "./vite"
import dotenv from "dotenv"
import { convert, tokenNameToDisplayName, tokenTickers } from "./vite_tokens"
dotenv.config({
    path: join(__dirname, "../.env")
})

process.on("uncaughtException", (err, origin) => {
    console.error(err, origin)
})
process.on("unhandledRejection", (reason, promise) => {
    console.error(reason)
})

export const twitc = new Twit({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
})

export const commands = new Map<string, Command>()
export const rawCommands = [] as Command[]

export function replyTweet(reply_to: string, text: string){
    return twitc.v1.reply(text, reply_to)
}

// Broken typing on this because this payload won't work with normal Twitter, and needs twitc
export async function createDM(recipient_id: string, text: string):Promise<any>{
    return twitc.v1.sendDm({
        recipient_id: recipient_id,
        text: text
    })
}

export interface TwitterUser {
    id: string,
    name: string,
    screen_name: string,
    location: string,
    url: string,
    description: string,
    translator_type: string,
    protected: boolean,
    verified: boolean,
    followers_count: number,
    friends_count: number,
    listed_count: number,
    favourites_count: number,
    statuses_count: number,
    created_at: string,
    geo_enabled: boolean,
    lang: string,
    contributors_enabled: boolean,
    is_translator: boolean,
    profile_background_color: string,
    profile_background_image_url: string,
    profile_background_image_url_https: string,
    profile_background_tile: boolean,
    profile_link_color: string,
    profile_sidebar_border_color: string,
    profile_sidebar_fill_color: string,
    profile_text_color: string,
    profile_use_background_image: boolean,
    profile_image_url: string,
    profile_image_url_https: string,
    profile_banner_url: string,
    default_profile: boolean,
    default_profile_image: boolean
}

export interface DMMessage {
    id: string,
    text: string,
    user: TwitterUser,
    entities: TweetEntitiesV1
}

export const mention = "@vitetipper"
let nonce = 0

events.on("DepositEvent", async data => {
    // never dmed before
    // don't dm random people
    if(!await isAuthorized(data.user_id))return
    const user = await fetchUser(data.user_id)

    await createDM(user.id, `${
        convert(data.amount, "RAW", tokenTickers[data.token_id])
    } ${
        tokenNameToDisplayName(tokenTickers[data.token_id])
    } were deposited into your account's balance!
    
View transaction on vitescan: https://vitescan.io/tx/${data.hash}`)
})

events.on("TipEvent", async data => {
    if(!await isAuthorized(data.recipient_id))return
    const sender = await fetchUser(data.sender_id)

    await createDM(data.recipient_id, `You were tipped ${
        convert(data.amount, "RAW", tokenTickers[data.token_id])
    } ${
        tokenNameToDisplayName(tokenTickers[data.token_id])
    } by @${sender.username}!`)
})

events.on("WithdrawEvent", async data => {
    if(!await isAuthorized(data.user_id))return

    await createDM(data.user_id, `Your withdraw of ${
        convert(data.amount, "RAW", tokenTickers[data.token_id])
    } ${
        tokenNameToDisplayName(tokenTickers[data.token_id])
    } was processed!`)
})

events.on("AutomaticWithdrawalAddressChangeEvent", async data => {
    if(!await isAuthorized(data.user_id))return

    await createDM(data.user_id, `Your automatic withdraw address was changed!
    
New Address: ${data.addr === BURN_ADDRESS ? "None" : data.addr}`)
})

fs.readdir(join(__dirname, "commands"), {withFileTypes: true})
.then(async files => {
    for(const file of files){
        if(!file.isFile())continue
        if(!file.name.endsWith(".js") && !file.name.endsWith(".ts"))continue
        const mod = await import(join(__dirname, "commands", file.name))
        const command:Command = mod.default

        if(!command.hidden)rawCommands.push(command)
        for(const alias of command.alias){
            commands.set(alias, command)
        }
    }

    await init()
    
    const account = await twitc.v1.verifyCredentials()
    // normal tweets
    const streamFilter = await twitc.v1.filterStream({
        track: mention.slice(1)
    })
    streamFilter.autoReconnect = true
    streamFilter.on(ETwitterStreamEvent.Data, async (tweet) => {
        if(tweet.retweeted_status)return
        let tempArgs = tweet.text.toLowerCase().split(/ +/g)
        const mentionIndexs = []
        // eslint-disable-next-line no-constant-condition
        while(true){
            if(!tempArgs.length)break
            const mentionIndex = tempArgs.indexOf(mention)
            if(mentionIndex < 0)break
            // remove the mention to avoid loops
            tempArgs[mentionIndex] = ""
            mentionIndexs.push(mentionIndex)
        }
        
        // not mentionned.
        if(!mentionIndexs.length)return
        for(const mentionIndex of mentionIndexs){
            const args = tweet.text.split(/ +/g).slice(mentionIndex+1)
            const command = args.shift().toLowerCase()
            
            const cmd = commands.get(command)
            if(!cmd)continue
            if(!cmd.public)continue
            const n = nonce++
    
            try{
                await cmd.executePublic(tweet, args, command)
            }catch(err){
                if(!(err instanceof Error) && "error" in err){
                    // eslint-disable-next-line no-ex-assign
                    err = JSON.stringify(err.error, null, "    ")
                }
                console.error(`${command} Twitter ${n}`, err)
                await replyTweet(
                    tweet.id_str,
                    `An unknown error occured. Please report that to devs (cc @NotThomiz): Execution ID ${n}`
                )
            }
        }
    })
    const webhook = new Autohook({
        consumer_key: process.env.TWITTER_API_KEY,
        consumer_secret: process.env.TWITTER_API_SECRET,
        token: process.env.TWITTER_ACCESS_TOKEN,
        token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
        ngrok_secret: process.env.NGROK_AUTH_TOKEN,
        env: "prod",
        port: 1765
    })
    await webhook.removeWebhooks()
    
    const prefixHelp = new Set<string>()

    webhook.on("event", async msg => {
        // likely typing in dms, we don't care about those.
        if(!("direct_message_events" in msg))return
        for(const event of msg.direct_message_events){
            if(event.type !== "message_create")continue
            const user = msg.users[event.message_create.sender_id]
            if(user.id === account.id_str)continue
            await setAuthorized(user.id)
            const message:DMMessage = {
                entities: event.message_create.message_data.entities,
                id: event.id,
                text: event.message_create.message_data.text,
                user: user
            }
            if(!message.text.startsWith(".")){
                if(prefixHelp.has(user.id))continue
                prefixHelp.add(user.id)
                setTimeout(() => {
                    prefixHelp.delete(user.id)
                }, 10*60*1000)
                createDM(message.user.id, "Hey 👋, The prefix for all my commands is period (.) You can see a list of all commands by sending .help")
                continue
            }
            const args = message.text.slice(1).trim().split(/ +/g)
            const command = args.shift().toLowerCase()

            const cmd = commands.get(command)
            if(!cmd?.dm)continue

            const n = nonce++

            try{
                await cmd.executePrivate(message, args, command)
            }catch(err){
                if(!(err instanceof Error) && "error" in err){
                    // eslint-disable-next-line no-ex-assign
                    err = JSON.stringify(err.error, null, "    ")
                }
                console.error(`${command} Twitter ${n}`, err)
                await createDM(user.id, `An unknown error occured. Please report that to devs (cc @NotThomiz): Execution ID ${n}`)
            }
        }
    })

    await webhook.start()
  
    await webhook.subscribe({
        oauth_token: process.env.TWITTER_ACCESS_TOKEN,
        oauth_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
    })
})