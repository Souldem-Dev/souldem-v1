var ethers = require('ethers')
var GovernanceFactory = artifacts.require('GovernanceFactory.sol');
 //university wallet
 let provider = new ethers.JsonRpcProvider("HTTP://127.0.0.1:7545");

 const privateKeyUniv = "0x2a8fe9504d2221aece43276de46468857ea08623dca2ac316c23036c95dfa849"
 let univWallet = new ethers.Wallet(privateKeyUniv)
 univWallet.connect(provider)

 function splitSign(sign) {
   
    const signature = sign.substring(2);
    const r = "0x" + signature.substring(0, 64);
    const s = "0x" + signature.substring(64, 128);
    const v = parseInt(signature.substring(128, 130), 16);
    return {r,s,v}
    }

contract("GovernanceFactory",async(accounts)=>{
    it("creating governance via Governance factory contract for first time",async()=>{
        let contract = await GovernanceFactory.deployed()
        const domain = {
            name: "college of engineering",
            version: '1',
            chainId: 1337,
            verifyingContract: contract.address,
          }

          let types = {
            CreateGovernance: [
              { name: 'wallet', type: 'address' },
              { name: 'governanceName', type: 'string' },
              { name: 'totalEndExamination', type: 'uint256' },
              { name: 'batch', type: 'string' },
              { name: 'nonces', type: 'uint256' },
              { name: 'relayer', type: 'address' },
            ],
          };

          let value = {
            wallet:accounts[1],
            governanceName:"MCA",
            totalEndExamination:4,
            batch:"2022-2024",
            nonces:0,
            relayer:accounts[0]
          }
let signature = await univWallet.signTypedData(domain,types,value);
let {r,s,v} = splitSign(signature)
let tx = await contract.createNewContract(value.governanceName,value.totalEndExamination,value.batch,value.wallet,value.relayer,v,r,s)
console.log(tx.tx)

    })

    it("creating governance for second time via governance Factory",async()=>{
        let contract = await GovernanceFactory.deployed()
        let nonce = await contract.returnNonce(accounts[1]);
        let nonceInStrFormat = nonce+""
        let nonceInIntForm  = parseInt(nonceInStrFormat)
        const domain = {
            name: "college of engineering",
            version: '1',
            chainId: 1337,
            verifyingContract: contract.address,
          }

          let types = {
            CreateGovernance: [
              { name: 'wallet', type: 'address' },
              { name: 'governanceName', type: 'string' },
              { name: 'totalEndExamination', type: 'uint256' },
              { name: 'batch', type: 'string' },
              { name: 'nonces', type: 'uint256' },
              { name: 'relayer', type: 'address' },
            ],
          };

          let value = {
            wallet:accounts[1],
            governanceName:"BCA",
            totalEndExamination:6,
            batch:"2022-2025",
            nonces:nonceInIntForm,
            relayer:accounts[0]
          }
let signature = await univWallet.signTypedData(domain,types,value);
let {r,s,v} = splitSign(signature)
let tx = await contract.createNewContract(value.governanceName,value.totalEndExamination,value.batch,value.wallet,value.relayer,v,r,s)
console.log(tx.tx)
    })

    it("getting created Governance",async()=>{
        let contract = await GovernanceFactory.deployed()

        let GovernanceFactoryABI= [ "event newContract(address indexed createdBy, address indexed governanceAddress,uint length,string governanceName)"]
        let interf = new ethers.Interface(GovernanceFactoryABI)
      await provider.getLogs({
        address:contract.address,
        fromBlock:0,
        
      }).then(logs=>{
        let result = logs.map((log)=>{
            let res =  interf.parseLog(log)
            let newObj = {
             args: res.args.map(arg => typeof arg === 'bigint' ? arg.toString() : arg)
            }
           return newObj
           })
           console.log(result)

      })
    })
})