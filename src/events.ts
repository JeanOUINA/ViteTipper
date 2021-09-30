// This file is basically an EventEmitter
// but with type checking for events
// without writing the thing 40 times

// Just write definitions in the constructor 
// and you're done.

// This file also contains a global event emittor
// for the app, with its type definitions.

import { EventEmitter } from "events"

export class ViteTipperEventEmitter <events extends {
    [key: string]: any[]
}> extends EventEmitter {
    on<key extends keyof events>(event:Exclude<key, number>, listener:(...args:events[key]) => void){
        return super.on(event, listener)
    }
    once<key extends keyof events>(event:Exclude<key, number>, listener:(...args:events[key]) => void){
        return super.once(event, listener)
    }
    off<key extends keyof events>(event:Exclude<key, number>, listener:(...args:events[key]) => void){
        return super.off(event, listener)
    }
    removeListener<key extends keyof events>(event:Exclude<key, number>, listener:(...args:events[key]) => void){
        return super.removeListener(event, listener)
    }
    removeAllListeners<key extends keyof events>(event:Exclude<key, number>){
        return super.removeAllListeners(event)
    }
    rawListeners<key extends keyof events>(event:Exclude<key, number>):((...args:events[key]) => void)[]{
        return super.rawListeners(event) as any
    }
    addListener<key extends keyof events>(event:Exclude<key, number>, listener:(...args:events[key]) => void){
        return super.addListener(event, listener)
    }
    listenerCount<key extends keyof events>(event:Exclude<key, number>){
        return super.listenerCount(event)
    }
    emit<key extends keyof events>(event:Exclude<key, number>, ...args:events[key]){
        return super.emit(event, ...args)
    }
    eventNames():Exclude<keyof events, number>[]{
        return super.eventNames() as any
    }
    listeners<key extends keyof events>(event:Exclude<key, number>):((...args:events[key]) => void)[]{
        return super.listeners(event) as any
    }
    prependListener<key extends keyof events>(event:Exclude<key, number>, listener:(...args:events[key]) => void){
        return super.prependListener(event, listener)
    }
    prependOnceListener<key extends keyof events>(event:Exclude<key, number>, listener:(...args:events[key]) => void){
        return super.prependOnceListener(event, listener)
    }
}

const events = new ViteTipperEventEmitter<{
    DepositEvent: [{
        user_id: string,
        amount: string,
        token_id: string,
        hash: string
    }],
    WithdrawEvent: [{
        user_id: string,
        amount: string,
        token_id: string
    }],
    TipEvent: [{
        sender_id: string,
        recipient_id: string,
        amount: string,
        token_id: string,
        hash: string
    }],
    AutomaticWithdrawalAddressChangeEvent: [{
        user_id: string,
        addr: string
    }]
}>()

export default events