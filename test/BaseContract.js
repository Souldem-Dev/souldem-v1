var BaseContract = artifacts.require('BaseContract.sol')
var ethers = require('ethers')

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

contract("BaseContract",(accounts)=>{
    it("creating college",async()=>{
        let contract = await BaseContract.deployed()
        let domain = {
        name: 'BASE_FACTORY',
        version: '1',
        chainId: 1337,
        verifyingContract: contract.address
      };
  
      const types = {
        Create: [
          { name: 'wallet', type: 'address' },
          { name: 'universityName', type: 'string' },
        ],
      };
      const value = {
        wallet : accounts[1],
        universityName: "College Of Engineering"
      }
      let signature = await univWallet.signTypedData(domain,types,value)
      let {r,s,v} = splitSign(signature);
        let tx = await contract.createMyOwnFactory(value.universityName,value.wallet,v,r,s)
        console.log(tx.tx)
    })

    it("getting college details",async()=>{
      let contract= await BaseContract.deployed();
      let dt = await contract.getContractAdd(accounts[1])
      console.log(dt)
    })
})