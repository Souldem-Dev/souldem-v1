var ethers = require('ethers')
var GovernanceFactory = artifacts.require('GovernanceFactory.sol');

const privateKeyUniv = "0x2a8fe9504d2221aece43276de46468857ea08623dca2ac316c23036c95dfa849"
let univWallet = new ethers.Wallet(privateKeyUniv)

// relayer wallet (matches address in migration: 0xc39a0B58cdeA2401443c61f03e0f9E49FDe2F650)
const privateKeyRelayer = "0x0793c18834917e50549d0e64039d71a265cdc0139f4328c4e62eaad9ca13aa63"
let relayerWallet = new ethers.Wallet(privateKeyRelayer)

function splitSign(sign) {
    const signature = sign.substring(2);
    const r = "0x" + signature.substring(0, 64);
    const s = "0x" + signature.substring(64, 128);
    const v = parseInt(signature.substring(128, 130), 16);
    return {r, s, v}
}

contract("GovernanceFactory", async (accounts) => {
    it("creating governance via Governance factory contract for first time", async () => {
        let contract = await GovernanceFactory.deployed()

        // FIX 1: get chainId dynamically — was hardcoded to 1337
        let chainId = Number((await contract.returnChainId()).toString())

        const domain = {
            name: "college of engineering",
            version: '1',
            chainId: chainId,
            verifyingContract: contract.address,
        }
        let types = {
            CreateGovernance: [
                {name: 'wallet', type: 'address'},
                {name: 'governanceName', type: 'string'},
                {name: 'totalEndExamination', type: 'uint256'},
                {name: 'batch', type: 'string'},
                {name: 'nonces', type: 'uint256'},
                {name: 'relayer', type: 'address'},
            ],
        };

        // FIX 2: wallet must be univWallet.address — ecrecover(sig) must equal _owner
        let value = {
            wallet: univWallet.address,
            governanceName: "MCA",
            totalEndExamination: 4,
            batch: "2022-2024",
            nonces: 0,
            relayer: relayerWallet.address
        }
        let signature = await univWallet.signTypedData(domain, types, value);
        let {r, s, v} = splitSign(signature)
        let tx = await contract.createNewContract(
            value.governanceName, value.totalEndExamination, value.batch,
            value.wallet, value.relayer, v, r, s
        )
        console.log(tx.tx)
    })

    it("creating governance for second time via governance Factory", async () => {
        let contract = await GovernanceFactory.deployed()

        // FIX 1: get chainId dynamically
        let chainId = Number((await contract.returnChainId()).toString())

        // FIX 3: read nonce for univWallet.address, not accounts[1]
        let nonce = await contract.returnNonce(univWallet.address);
        let nonceInt = Number(nonce.toString())

        const domain = {
            name: "college of engineering",
            version: '1',
            chainId: chainId,
            verifyingContract: contract.address,
        }
        let types = {
            CreateGovernance: [
                {name: 'wallet', type: 'address'},
                {name: 'governanceName', type: 'string'},
                {name: 'totalEndExamination', type: 'uint256'},
                {name: 'batch', type: 'string'},
                {name: 'nonces', type: 'uint256'},
                {name: 'relayer', type: 'address'},
            ],
        };

        // FIX 2: wallet must be univWallet.address
        let value = {
            wallet: univWallet.address,
            governanceName: "BCA",
            totalEndExamination: 6,
            batch: "2022-2025",
            nonces: nonceInt,
            relayer: relayerWallet.address
        }
        let signature = await univWallet.signTypedData(domain, types, value);
        let {r, s, v} = splitSign(signature)
        let tx = await contract.createNewContract(
            value.governanceName, value.totalEndExamination, value.batch,
            value.wallet, value.relayer, v, r, s
        )
        console.log(tx.tx)
    })

    it("getting created Governance", async () => {
        let contract = await GovernanceFactory.deployed()
        let provider = new ethers.JsonRpcProvider("http://127.0.0.1:7545");

        let GovernanceFactoryABI = ["event newContract(address indexed createdBy, address indexed governanceAddress,uint length,string governanceName)"]
        let interf = new ethers.Interface(GovernanceFactoryABI)
        await provider.getLogs({
            address: contract.address,
            fromBlock: 0,
        }).then(logs => {
            let result = logs.map((log) => {
                let res = interf.parseLog(log)
                let newObj = {
                    args: res.args.map(arg => typeof arg === 'bigint' ? arg.toString() : arg)
                }
                return newObj
            })
            console.log(result)
        })
    })
})
