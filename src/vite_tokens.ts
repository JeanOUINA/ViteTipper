import BigNumber from "bignumber.js"


export const tokenIds = {
    // did you know it was pronounced veet ?
    VITE: "tti_5649544520544f4b454e6e40",
    ATTOV: "tti_5649544520544f4b454e6e40",
    // The healthiest one
    VITC: "tti_22d0b205bed4d268a05dfc3c",
    // 🍌🍌
    BAN: "tti_f9bd6782f966f899d74d7df8",
    // fast and feeless too
    NANO: "tti_29a2af20212b985e9d49e899",
    NYANO: "tti_29a2af20212b985e9d49e899",
    // ew
    BTC: "tti_b90c9baffffc9dae58d1f33f",
    SATS: "tti_b90c9baffffc9dae58d1f33f",
    // what's the purpose of that one ?
    VX: "tti_564954455820434f494e69b5",
    // redeem merch I guess
    VCP: "tti_251a3e67a41b5ea2373936c8",
    XMR: "tti_e5750d3c5b3bb5a31b8ba637",
    // everything vite does, but with fees
    ETH: "tti_687d8a93915393b219212c73",
    VINU: "tti_541b25bd5e5db35166864096"
}
export const tokenTickers = {
    tti_5649544520544f4b454e6e40: "VITE",
    tti_22d0b205bed4d268a05dfc3c: "VITC",
    tti_f9bd6782f966f899d74d7df8: "BAN",
    tti_29a2af20212b985e9d49e899: "NANO",
    tti_b90c9baffffc9dae58d1f33f: "BTC",
    tti_564954455820434f494e69b5: "VX",
    tti_251a3e67a41b5ea2373936c8: "VCP",
    tti_e5750d3c5b3bb5a31b8ba637: "XMR",
    tti_687d8a93915393b219212c73: "ETH",
    tti_541b25bd5e5db35166864096: "VINU"
}

export const tokenDecimals = {
    VITE: 18,
    ATTOV: 0,
    VITC: 18,
    BAN: 29,
    NANO: 30,
    NYANO: 21,
    BTC: 8,
    SATS: 0,
    VX: 18,
    VCP: 0,
    XMR: 12,
    ETH: 18,
    VINU: 18
}

export const tokenNames = {
    VITE: "Vite",
    ATTOV: "Attov",
    VITC: "Vitamin Coin",
    BAN: "Banano",
    NANO: "Nano",
    NYANO: "Nyano",
    SATS: "Satoshi",
    BUS: "Bussycoin",
    XRB: "RayBlocks",
    BANG: "Banano Gold",
    BROCC: "Broccoli 🥦"
}

export function tokenIdToName(tokenId:string){
    return tokenTickers[tokenId]
}

export function convert(amount: string|BigNumber|number, base_unit: string, unit: string){
    const value = new BigNumber(amount)
        .shiftedBy(tokenDecimals[base_unit]||0)
        .shiftedBy(-tokenDecimals[unit]||0)
    const toFixed = value.toFixed()
    return toFixed
}

export function tokenNameToDisplayName(token: string){
    token = tokenIdToName(token) || token

    return tokenNames[token] || token
}