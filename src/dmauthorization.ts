import ActionQueue from "./queue"
import * as fs from "fs"
import { join } from "path"
import { dirname } from "path/posix"

const queue = new ActionQueue<string>()
const cache = new Map<string, boolean>()

export async function isAuthorized(user_id:string):Promise<boolean>{
    return queue.queueAction(user_id, async () => {
        if(cache.has(user_id))return cache.get(user_id)
        const auth = fs.existsSync(join(__dirname, "../data/dmauthorization/"+user_id))
        
        cache.set(user_id, auth)
        return auth
    })
}

export async function setAuthorized(user_id:string){
    await queue.queueAction(user_id, async () => {
        if(cache.get(user_id))return
        
        const path = join(join(__dirname, "../data/dmauthorization/"+user_id))
        if(fs.existsSync(path)){
            cache.set(user_id, true)
            return
        }
        await fs.promises.mkdir(dirname(path), {
            recursive: true
        })
        await fs.promises.writeFile(path, "")
        cache.set(user_id, true)
        return
    })
}