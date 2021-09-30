/* eslint-disable @typescript-eslint/no-unused-vars */

import { TweetV1 } from "twitter-api-v2"
import { DMMessage } from "."

export default class Command {
    description: string
    extended_description: string
    alias: string[]
    // Command usage where
    // <> is a mandatory argument
    // {} is an optional argument 
    usage: string
    hidden?: boolean
    public: boolean
    dm: boolean

    async executePublic?(tweet:TweetV1, args:string[], command:string):Promise<void>{
        throw new CommandError("The command wasn't defined in its file.")
    }

    async executePrivate?(tweet:DMMessage, args:string[], command:string):Promise<void>{
        throw new CommandError("The command wasn't defined in its file.")
    }
}

export class CommandError extends Error {
    name = "CommandError"
}