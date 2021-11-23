import ActionQueue from "./queue";
import WS_RPC from "@vite/vitejs-ws";
import * as vite from "@vite/vitejs";
import * as fs from "fs"
const abi = require("../contracts/abi.json")
const offchaincode = Buffer.from(fs.readFileSync(__dirname+"/../contracts/offchain.bin", "utf8"), "hex").toString("base64")
import dotenv from "dotenv"
import { join } from "path";
import { tokenDecimals, tokenIds, tokenNames, tokenTickers } from "./vite_tokens";
import BigNumber from "bignumber.js"
import events from "./events";
import twitterqueue from "./twitterqueue";

dotenv.config({
    path: join(__dirname, "../.env")
})

export const availableNodes = [
    ...new Set([
        process.env.VITE_WS || "",
        "wss://node-vite.thomiz.dev/ws",
        "wss://node.vite.net/gvite/ws"
    ])
].filter(e => !!e)

export let wsProvider = null

export async function init(){
    console.info("[VITE] Connecting to "+availableNodes[0])
    
    const wsService = new WS_RPC(availableNodes[0], 6e5, {
        protocol: "",
        headers: "",
        clientConfig: "",
        retryTimes: Infinity,
        retryInterval: 10000
    })
    await new Promise((resolve) => {
        wsProvider = new vite.ViteAPI(wsService, resolve)
    })
    console.log("[VITE] Connected to node")
    await registerEvents()

    wsProvider._provider.on("connect", registerEvents)
}

const signatures = {}
for(const f of abi){
    if(f.type !== "event")continue
    signatures[vite.abi.encodeLogSignature(f)] = f
}

export const BURN_ADDRESS = "vite_0000000000000000000000000000000000000000a4f3a0cb58"

async function registerEvents(){
    await Promise.all([
        (async () => {
            await wsProvider.subscribe(
                "createVmlogSubscription", 
                {
                    addressHeightRange: {
                        [process.env.SMART_CONTRACT_ADDRESS]: {
                            fromHeight: "0",
                            toHeight: "0"
                        }
                    }
                }
            ).then(event => {
                event.on(async (results) => {
                    for(const result of results){
                        const f = signatures[result.vmlog.topics[0]]
                        // idk lol
                        if(!f)continue

                        const decoded:any = vite.abi.decodeLog(
                            f.inputs,
                            Buffer.from(result.vmlog.data, "base64").toString("hex"),
                            result.vmlog.topics.slice(1)
                        )
                        
                        let data:any = {}
                        for(const input of f.inputs){
                            data[input.name] = decoded[input.name]
                        }
                        events.emit(f.name, data)
                    }
                })
            })
        })(),
        (async () => {
            let page = 0
            const pageSize = 100
            let tokens = []
            // eslint-disable-next-line no-constant-condition
            while(true){
                const tokensInfo = await wsProvider.request("contract_getTokenInfoList", page, pageSize)
                page++
                tokens.push(...tokensInfo.tokenInfoList)
                if(tokensInfo.tokenInfoList.length != pageSize)break
            }
            tokens = tokens.sort((a, b) => a.index-b.index)
            for(const token of tokens
                .filter(token => {
                    if(
                        tokens.find(e => e.tokenSymbol === token.tokenSymbol)
                        !== token
                    )return false
                    return true
                })
            ){
                if(!tokenNames[token.tokenSymbol]){
                    tokenNames[token.tokenSymbol] = token.tokenName
                }
                if(!tokenIds[token.tokenSymbol]){
                    tokenIds[token.tokenSymbol] = token.tokenId
                    tokenDecimals[token.tokenSymbol] = token.decimals
                    tokenTickers[token.tokenId] = token.tokenSymbol
                }
            }
        })()
    ])
}

export const viteQueue = new ActionQueue<string>()
export const ownerWallet = vite.wallet.getWallet(process.env.OWNER_MNEMONIC)
export const ownerAddress = ownerWallet.deriveAddress(0)

const cachedPreviousBlocks = new Map<string, {
    height: number,
    previousHash: string,
    timeout: NodeJS.Timeout
}>()

export function getDepositURI(user_id: string, tokenId:string){
    // prepare a call, to the Deposit function of the contract
    const call = vite.abi.encodeFunctionCall(abi, [user_id], "Deposit")
    return `vite:${
        process.env.SMART_CONTRACT_ADDRESS
    }/Deposit?tti=${tokenId}&data=${
        Buffer.from(call, "hex").toString("base64")
    }`
}

export async function getCurrentAutoWithdrawalAddress(user_id: string){
    const call = vite.abi.encodeFunctionCall(abi, [
        user_id
    ], "getCurrentAutoWithdrawalAddress")
    
    const result = await wsProvider.request("contract_callOffChainMethod", {
        address: process.env.SMART_CONTRACT_ADDRESS,
        data: Buffer.from(call, "hex").toString("base64"),
        code: offchaincode
    })
    const decoded = vite.abi.decodeParameters(
        abi.find(e => e.name === "getCurrentAutoWithdrawalAddress").outputs.map(e => e.type),
        Buffer.from(result, "base64").toString("hex")
    )
    
    return decoded[0] === BURN_ADDRESS ? null : decoded[0]
}

export async function getBalances(user_id: string){
    const call = vite.abi.encodeFunctionCall(abi, [
        user_id
    ], "getBalance")

    const result = await wsProvider.request("contract_callOffChainMethod", {
        address: process.env.SMART_CONTRACT_ADDRESS,
        data: Buffer.from(call, "hex").toString("base64"),
        code: offchaincode
    })
    const decoded = vite.abi.decodeParameters(
        abi.find(e => e.name === "getBalance").outputs.map(e => e.type),
        Buffer.from(result, "base64").toString("hex")
    )

    const data:{
        [tokenId:string]:string
    } = {}
    for(let i = 0;i<decoded[0].length;i++){
        data[decoded[0][i]] = decoded[1][i]
    }

    return data
}

export async function tip(sender_id: string, token_id: string, amount: string, recipients: string[]):Promise<{
    type: "tipped",
    sender_id: string,
    token_id: string,
    amount: string,
    recipients: string[]
}|{
    type: "insufficient_balance",
    balance: string,
    amount: string,
    token_id: string
}>{
    return twitterqueue.queueAction(sender_id, async () => {
        const balances = await getBalances(sender_id)
        const balance = new BigNumber(balances[token_id] || "0")
        if(balance.isLessThan(new BigNumber(amount).times(recipients.length)))return {
            type: "insufficient_balance",
            balance: balance.toFixed(),
            amount: amount,
            token_id: token_id
        }
        return viteQueue.queueAction(ownerAddress.address, async () => {
            const accountBlock = vite.accountBlock.createAccountBlock("callContract", {
                address: ownerAddress.address,
                tokenId: token_id,
                amount: "0",
                toAddress: process.env.SMART_CONTRACT_ADDRESS,
                abi: abi.find(e => e.name === "Tip"),
                params: [
                    sender_id,
                    amount,
                    recipients
                ]
            })
            accountBlock.setPrivateKey(ownerAddress.privateKey)

            await sendTX(ownerAddress.address, accountBlock)

            return {
                type: "tipped",
                amount: amount,
                sender_id: sender_id,
                recipients: recipients,
                token_id: token_id
            }
        })
    })
}

export async function setAutomaticWithdrawalAddress(user_id:string, address:string):Promise<{
    type: "done",
    address: string
}>{
    return viteQueue.queueAction(ownerAddress.address, async () => {
        const accountBlock = vite.accountBlock.createAccountBlock("callContract", {
            address: ownerAddress.address,
            tokenId: tokenIds.VITE,
            amount: "0",
            toAddress: process.env.SMART_CONTRACT_ADDRESS,
            abi: abi.find(e => e.name === "SetAutomaticWithdrawalAddress"),
            params: [
                user_id,
                address
            ]
        })
        accountBlock.setPrivateKey(ownerAddress.privateKey)

        await sendTX(ownerAddress.address, accountBlock)

        return {
            type: "done",
            address: address
        }
    })
}

export async function withdraw(user_id: string, token_id: string, amount: string, address: string):Promise<{
    type: "insufficient_balance",
    balance: string,
    amount: string,
    token_id: string
}|{
    type: "withdrawn",
    amount: string,
    user_id: string,
    address: string,
    token_id: string
}>{
    return twitterqueue.queueAction(user_id, async () => {
        const balances = await getBalances(user_id)
        const balance = new BigNumber(balances[token_id] || "0")
        if(amount === "all")amount = balance.toFixed()
        if(balance.isLessThan(amount))return {
            type: "insufficient_balance",
            balance: balance.toFixed(),
            amount: amount,
            token_id: token_id
        }
        return viteQueue.queueAction(ownerAddress.address, async () => {
            const accountBlock = vite.accountBlock.createAccountBlock("callContract", {
                address: ownerAddress.address,
                tokenId: token_id,
                amount: "0",
                toAddress: process.env.SMART_CONTRACT_ADDRESS,
                abi: abi.find(e => e.name === "Withdraw"),
                params: [
                    user_id,
                    amount,
                    address
                ]
            })
            accountBlock.setPrivateKey(ownerAddress.privateKey)

            await sendTX(ownerAddress.address, accountBlock)

            return {
                type: "withdrawn",
                amount: amount,
                user_id: user_id,
                address: address,
                token_id: token_id
            }
        })
    })
}

export async function sendTX(address:string, accountBlock:any):Promise<string>{
    accountBlock.setProvider(wsProvider)

    const [
        quota,
        difficulty
    ] = await Promise.all([
        wsProvider.request("contract_getQuotaByAccount", address),
        (async () => {
            if(cachedPreviousBlocks.has(address)){
                const block = cachedPreviousBlocks.get(address)
                accountBlock.setHeight((block.height).toString())
                accountBlock.setPreviousHash(block.previousHash)
            }else{
                await accountBlock.autoSetPreviousAccountBlock()
                const block = {
                    timeout: null,
                    height: parseInt(accountBlock.height),
                    previousHash: accountBlock.previousHash
                }
                cachedPreviousBlocks.set(address, block)
            }
        })()
        .then(() => wsProvider.request("ledger_getPoWDifficulty", {
            address: accountBlock.address,
            previousHash: accountBlock.previousHash,
            blockType: accountBlock.blockType,
            toAddress: accountBlock.toAddress,
            data: accountBlock.data
        })) as Promise<{
            requiredQuota: string;
            difficulty: string;
            qc: string;
            isCongestion: boolean;
        }>
    ])
    const availableQuota = new BigNumber(quota.currentQuota)
    if(availableQuota.isLessThan(difficulty.requiredQuota)){
        await accountBlock.PoW(difficulty.difficulty)
    }
    await accountBlock.sign()
    
    const hash = (await accountBlock.send()).hash
    const pblock = cachedPreviousBlocks.get(address) || {} as any
    pblock.height++
    pblock.previousHash = hash
    const timeout = pblock.timeout = setTimeout(() => {
        const block = cachedPreviousBlocks.get(address)
        if(timeout !== block.timeout)return
        cachedPreviousBlocks.delete(address)
    }, 600000)
    cachedPreviousBlocks.set(address, pblock)

    return hash
}