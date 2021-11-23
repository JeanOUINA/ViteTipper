import { DMMessage, twitc } from "..";
import Command from "../command";
import { BURN_ADDRESS, getCurrentAutoWithdrawalAddress, setAutomaticWithdrawalAddress } from "../vite";
import * as vite from "@vite/vitejs"

export default new class BalanceCommand implements Command {
    public = false
    dm = true
    description = "Automatically withdraw tips to your vite address."
    extended_description = `Automatically withdraw tips to your vite address.

Examples:
Get your current configured withdrawal address:
    .autowithdraw
Set your withdrawal address:
    .autowithdraw vite_address
Reset your withdrawal address:
    .autowithdraw none`
    alias = ["autowithdraw"]
    usage = "{none|vite_address}"

    async executePrivate(message:DMMessage, args:string[]){
        if(!args[0]){
            // get address
            let address = await getCurrentAutoWithdrawalAddress(message.user.id)
            if(!address){
                address = "None"
            }
            await twitc.v1.sendDm({
                recipient_id: message.user.id, 
                text: `Your configured withdrawal address is ${address}.`
            })
        }else{
            // set address
            let address = args[0]
            if(address === "none"){
                address = BURN_ADDRESS
            }
            if(!vite.wallet.isValidAddress(address)){
                await twitc.v1.sendDm({
                    recipient_id: message.user.id, 
                    text: `${address} is not a valid vite address.`
                })
                return
            }

            await setAutomaticWithdrawalAddress(
                message.user.id,
                address
            )
        }
    }
}