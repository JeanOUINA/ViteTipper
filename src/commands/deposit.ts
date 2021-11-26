import { DMMessage, twitc } from "..";
import Command from "../command";
import * as qrcode from "qrcode"
import { getDepositURI } from "../vite";
import { tokenIds, tokenNameToDisplayName, tokenTickers } from "../vite_tokens";

export default new class DepositCommand implements Command {
    public = false
    dm = true
    description = "Get your deposit address"
    extended_description = `Get your deposit address
    
Example: 
Get a deposit link for depositing ${tokenNameToDisplayName("VITE")}:
    .deposit
Get a deposit link for depositing ${tokenNameToDisplayName("VITC")}
    .deposit vitc`
    alias = ["deposit"]
    usage = "{currency}"

    async executePrivate(message:DMMessage, args: string[]){
        await this.sendDepositAddress(message.user.id, args[0])
    }

    async sendDepositAddress(user_id:string, tokenId:string){
        if(!(tokenId?.toUpperCase() in tokenIds)){
            tokenId = tokenIds.VITE
        }else{
            tokenId = tokenIds[tokenId.toUpperCase()]
        }
        const data = getDepositURI(user_id, tokenId)
        const buffer = await new Promise<Buffer>((resolve, reject) => {
            qrcode.toBuffer(data, (error, buffer) => {
                if(error)return reject(error)
                resolve(buffer)
            })
        })

        const mediaId = await twitc.v1.uploadMedia(buffer, {
            type: "png",
            target: "dm"
        })
        await twitc.v1.sendDm({
            recipient_id: user_id,
            text: `You can deposit ${tokenNameToDisplayName(tokenTickers[tokenId])} by using this link: ${data}`,
            attachment: {
                type: "media",
                media: {
                    id: mediaId
                }
            }
        })
    }
}