import * as twitterText from "twitter-text"

export function extractMention(args:string[]){
    const mentions = []
    for(const arg of args){
        const mention = twitterText.extractMentions(arg.split("\n")[0])
        if(!mention[0])break
        mentions.push(mention[0])
        if(arg.includes("\n"))break
    }
    return mentions
}