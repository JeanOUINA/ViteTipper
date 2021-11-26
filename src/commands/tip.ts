import Command from "../command";
import help from "./help";
import BigNumber from "bignumber.js"
import { DMMessage, mention, twitc } from "..";
import { extractMention } from "../util";
import { fetchUserByUsername } from "../users";
import { TweetV2, UserV2 } from "twitter-api-v2";
import { convert, tokenIds, tokenNameToDisplayName, tokenTickers } from "../vite_tokens";
import { tip } from "../vite";

export default new class TipCommand implements Command {
    description = "Tip someone on Twitter"
    extended_description = `Tip someone on Twitter. 
If they don't have an account on the tipbot, it will create one for them.

Examples:
Tip one ${tokenNameToDisplayName("VITE")} to a single person
    ${mention} tip 1 @NotThomiz
Tip one ${tokenNameToDisplayName("BAN")} to a single person
    ${mention} tip 1 ban @NotThomiz
Tip to multiple people one ${tokenNameToDisplayName("VITE")} each
    ${mention} tip 1 @NotThomiz @jen_wina`

    alias = ["tip"]
    usage = "<amount> {currency} <...@someone>"

    public = true
    dm = true

    async executePublic(tweet:TweetV2, args: string[], command: string){
        const tip = await this.sendTip(args, tweet.author_id, tweet)
        if(!tip)return
        if(tip.type == "help")return help.executePublic(tweet, [command])
        const text = this.getText(tip)
        await twitc.v1.reply(text, tweet.id)
    }

    async executePrivate(message:DMMessage, args:string[], command: string){
        const tip = await this.sendTip(args, message.user.id, message)
        console.log(tip)
        if(!tip)return
        if(tip.type == "help")return help.executePrivate(message, [command])
        const text = this.getText(tip)
        await twitc.v1.sendDm({
            recipient_id: message.user.id, 
            text: text
        })
    }

    getText(tip){
        switch(tip.type){
            case "unsupported_currency": {
                return `The token ${tip.currency} isn't supported.`
            }
            case "tip_zero": {
                return `You can't send a tip of 0 ${tokenNameToDisplayName(tip.currency)}.`
            }
            case "insufficient_balance": {
                return `You don't have enough money to cover this tip. You need ${
                    tip.asked
                } ${tokenNameToDisplayName(tip.currency)} but you only have ${tip.balance} ${
                    tokenNameToDisplayName(tip.currency)
                } in your balance. Use .deposit to top up your account.`
            }
            case "tipped": {
                if(tip.recipients.length > 1){
                    return `You have sent ${tip.amount} ${tokenNameToDisplayName(tip.currency)} to ${tip.recipients.length} people each!
                    
https://vitescan.io/tx/${tip.hash}`
                }else{
                    return `You tipped ${tip.amount} ${tokenNameToDisplayName(tip.currency)} to ${tip.recipients[0].username}!
                    
https://vitescan.io/tx/${tip.hash}`
                }
            }
        }
    }

    async sendTip(args:string[], user_id:string, tweet: TweetV2)
    async sendTip(args:string[], user_id:string, message: DMMessage)
    async sendTip(args:string[], user_id:string, tm: TweetV2|DMMessage){
        let [
            // eslint-disable-next-line prefer-const
            amount,
            currencyOrRecipient,
            // eslint-disable-next-line prefer-const
            ...recipientsRaw
        ] = args
        currencyOrRecipient = currencyOrRecipient || "vite"
        if(!amount || !/^\d+(\.\d+)?$/.test(amount))return {
            type: "help"
        }
        const currencyMention = extractMention([currencyOrRecipient])
        if(currencyMention.length > 0){
            // user here
            recipientsRaw.push(currencyOrRecipient)
            currencyOrRecipient = "vite"
        }
        currencyOrRecipient = currencyOrRecipient.toUpperCase()

        if(!(currencyOrRecipient in tokenIds))return {
            type: "unsupported_currency",
            currency: currencyOrRecipient
        }
        if(recipientsRaw.length === 0)return {
            type: "help"
        }

        const amountParsed = new BigNumber(amount)
        const rawAmount = convert(amountParsed, currencyOrRecipient, "RAW").split(".")[0]
        if(rawAmount === "0"){
            return {
                type: "tip_zero"
            }
        }

        const recipients:UserV2[] = []
        const promises = []
        for(const mention of extractMention(recipientsRaw)){
            promises.push((async () => {
                try{
                    console.log(mention)
                    const user = await fetchUserByUsername(mention)
                    if(user.id === user_id)return
                    if(recipients.find(e => e.id === user.id))return
                    recipients.push(user)
                }catch{}
            })())
        }
        await Promise.all(promises)
        if(recipients.length === 0){
            return {
                type: "help"
            }
        }

        const result = await tip(
            user_id, 
            tokenIds[currencyOrRecipient], 
            rawAmount,
            recipients.map(e => e.id)
        )
        switch(result.type){
            case "insufficient_balance": {
                return {
                    type: "insufficient_balance",
                    asked: convert(result.amount, "RAW", tokenTickers[result.token_id]),
                    currency: tokenTickers[result.token_id],
                    balance: convert(result.balance, "RAW", tokenTickers[result.token_id])
                }
            }
            case "tipped": {
                return {
                    type: "tipped",
                    amount: convert(result.amount, "RAW", tokenTickers[result.token_id]),
                    currency: tokenTickers[result.token_id],
                    recipients: recipients,
                    hash: result.hash
                }
            }
        }
    }
}