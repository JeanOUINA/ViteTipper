import { UserV2 } from "twitter-api-v2"
import { twitc } from "."
import twitterqueue from "./twitterqueue"

const users = new Map<string, UserV2>()
export function fetchUser(user_id: string):Promise<UserV2>{
    return twitterqueue.queueAction(user_id, async () => {
        if(users.has(user_id))return users.get(user_id)

        const user = await twitc.v2.user(user_id)
        users.set(user_id, user.data)
        return user.data
    })
}

const usersMentionToId = new Map<string, string>()
export function fetchUserByUsername(username:string){
    return twitterqueue.queueAction(username, async () => {
        if(usersMentionToId.has(username))return fetchUser(usersMentionToId.get(username))

        const user = await twitc.v2.userByUsername(username)
        usersMentionToId.set(username, user.data.id)
        users.set(user.data.id, user.data)
        return user.data
    })
}