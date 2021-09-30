import { createDM, DMMessage } from "..";
import Command from "../command";
import twitterqueue from "../twitterqueue";
import * as vite from "vitejs-notthomiz"
import help from "./help";
import BigNumber from "bignumber.js"
import { convert, tokenIds, tokenNameToDisplayName } from "../vite_tokens";
import { withdraw } from "../vite";

export default new class WithdrawCommand implements Command {
    public = false
    dm = true
    description = "Withdraw your funds from the tipbot"
    extended_description = `Withdraw your funds from the tipbot.

Examples:
Withdraw all your ${tokenNameToDisplayName("VITE")} to your wallet
    .withdraw all vite_addr
Withdraw 1 ${tokenNameToDisplayName("VITE")} to your wallet
    .withdraw 1 vite_addr
Withdraw all your ${tokenNameToDisplayName("BAN")} to your wallet
    .withdraw all BAN vite_addr
Withdraw 1 ${tokenNameToDisplayName("BAN")} to your wallet
    .withdraw 1 BAN vite_addr`
    alias = ["withdraw", "send"]
    usage = "<amount|all> {currency} <vite_addr>"

    async executePrivate(message:DMMessage, args:string[], command:string){
        let [
            // eslint-disable-next-line prefer-const
            amountRaw,
            currencyOrRecipient,
            addr
        ] = args
        if(!amountRaw || !currencyOrRecipient)return help.executePrivate(message, [command])
        if(!/^\d+(\.\d+)?$/.test(amountRaw) && amountRaw !== "all")return help.executePrivate(message, [command])
        if(vite.wallet.isValidAddress(currencyOrRecipient)){
            // user here
            addr = currencyOrRecipient
            currencyOrRecipient = "vite"
        }
        let isRawTokenId = false
        currencyOrRecipient = currencyOrRecipient.toUpperCase()

        if(!(currencyOrRecipient in tokenIds)){
            if(vite.utils.isValidTokenId(currencyOrRecipient.toLowerCase())){
                isRawTokenId = true
                currencyOrRecipient = currencyOrRecipient.toLowerCase()
            }else{
                await createDM(message.user.id, `The token ${currencyOrRecipient} isn't supported. if you think this is an error from the bot, contact @NotThomiz.`)
                return
            }
        }
        if(!addr)return help.executePrivate(message, [command])
        if(!vite.wallet.isValidAddress(addr)){
            await createDM(message.user.id, `${addr} is not a valid vite address.`)
            return
        }

        const tokenId = isRawTokenId ? currencyOrRecipient : tokenIds[currencyOrRecipient]

        const result = await withdraw(
            message.user.id, 
            tokenId,
            amountRaw === "all" ? "all" : convert(amountRaw, currencyOrRecipient, "RAW"),
            addr
        )
        if(result.type === "insufficient_balance"){
            await createDM(message.user.id, `You don't have enough money to cover this withdraw. You need ${
                convert(result.amount, "RAW", currencyOrRecipient)
            } ${currencyOrRecipient} but you only have ${
                convert(result.balance, "RAW", currencyOrRecipient)
            } ${currencyOrRecipient} in your balance.`)
        }
    }
}