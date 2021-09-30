import { createDM, DMMessage } from "..";
import Command from "../command";
import { BURN_ADDRESS, getCurrentAutoWithdrawalAddress, setAutomaticWithdrawalAddress } from "../vite";
import * as vite from "vitejs-notthomiz"

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
            await createDM(message.user.id, `Your configured withdrawal address is ${
                address
            }.`)
        }else{
            // set address
            let address = args[0]
            if(address === "none"){
                address = BURN_ADDRESS
            }
            if(!vite.wallet.isValidAddress(address)){
                await createDM(message.user.id, `${address} is not a valid vite address.`)
                return
            }

            await setAutomaticWithdrawalAddress(
                message.user.id,
                address
            )
        }
    }
}