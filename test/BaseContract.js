var BaseContract = artifacts.require('BaseContract.sol')
var ethers = require('ethers')

const privateKeyUniv = "0x2a8fe9504d2221aece43276de46468857ea08623dca2ac316c23036c95dfa849"
let univWallet = new ethers.Wallet(privateKeyUniv)

function splitSign(sign) {
    const signature = sign.substring(2);
    const r = "0x" + signature.substring(0, 64);
    const s = "0x" + signature.substring(64, 128);
    const v = parseInt(signature.substring(128, 130), 16);
    return {r, s, v}
}

contract("BaseContract", (accounts) => {
    it("creating college", async () => {
        let contract = await BaseContract.deployed()

        // FIX 1: get chainId from the contract instead of hardcoding 1337
        let chainId = Number((await contract.returnChainId()).toString())

        let domain = {
            name: 'BASE_FACTORY',
            version: '1',
            chainId: chainId,
            verifyingContract: contract.address
        };
        const types = {
            Create: [
                {name: 'wallet', type: 'address'},
                {name: 'universityName', type: 'string'},
            ],
        };

        // FIX 2: wallet must be univWallet.address — the contract checks
        // that ecrecover(sig) == _owner, so the signer and the owner must match
        const value = {
            wallet: univWallet.address,
            universityName: "College Of Engineering"
        }
        let signature = await univWallet.signTypedData(domain, types, value)
        let {r, s, v} = splitSign(signature);
        let tx = await contract.createMyOwnFactory(value.universityName, value.wallet, v, r, s)
        console.log(tx.tx)
    })

    it("getting college details", async () => {
        let contract = await BaseContract.deployed();
        // FIX: query by univWallet.address (the actual owner used above)
        let dt = await contract.getContractAdd(univWallet.address)
        console.log(dt)
    })
})
