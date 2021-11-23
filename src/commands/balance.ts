import { DMMessage, twitc } from "..";
import { convert, tokenIds, tokenNameToDisplayName, tokenTickers } from "../vite_tokens";
import Command from "../command";
import { getBalances } from "../vite";

export default new class BalanceCommand implements Command {
    public = false
    dm = true
    description = "Display your balance"
    extended_description = `Display your current balance`
    alias = ["balance", "bal"]
    usage = ""

    async executePrivate(message:DMMessage){
        await this.sendBalanceToUser(message.user.id)
    }

    async sendBalanceToUser(user_id: string){
        const balances = await getBalances(user_id)

        if(!balances[tokenIds.VITE])balances[tokenIds.VITE] = "0"

        await twitc.v1.sendDm({
            recipient_id: user_id, 
            text: `Your current balance:
        
${Object.keys(balances).map(tokenId => {
    const displayToken = tokenTickers[tokenId] || tokenId
    const displayBalance = convert(balances[tokenId], "RAW", displayToken as any)

    return `${tokenNameToDisplayName(displayToken)}: ${displayBalance} ${tokenTickers[tokenId] || ""}`
}).join("\n")}`
        })
    }
}