import { TweetV2 } from "twitter-api-v2";
import { commands, DMMessage, rawCommands, twitc } from "..";
import Command from "../command";

export default new class HelpCommand implements Command {
    public = false
    dm = true
    description = "See the help menu"
    extended_description = `This is the help command. You'll find a lot of informations on other commands of the bot.

<argument> are mandatory arguments
{argument} are optionnal arguments

Example:
    .help
    .help deposit`
    alias = ["help"]
    usage = ""

    async executePublic(data:TweetV2, args: string[]){
        await this.sendHelp(data.author_id, args[0])
        await twitc.v1.reply("I've sent the help menu in your DM!", data.id)
    }

    async executePrivate(message:DMMessage, args: string[]){
        this.sendHelp(message.user.id, args[0])
    }

    async sendHelp(user_id:string, command:string){
        if(command){
            const cmd = commands.get(command)
            if(cmd){
                await twitc.v1.sendDm({
                    recipient_id: user_id, 
                    text: `[Command Details]

Usage:
.${command} ${cmd.usage}

${cmd.extended_description}${
    cmd.alias[0] !== command ? `\n\nAlias of the ${cmd.alias[0]} command` : ""
}`
                })
                return
            }
        }
        await twitc.v1.sendDm({
            recipient_id: user_id, 
            text: `[Command Overview]
Use .help {command} to know more about a certain command.
        
${rawCommands.map(cmd => {
    return `.${cmd.alias[0]} ${cmd.usage}`
}).join("\n")}`
        })
    }
}