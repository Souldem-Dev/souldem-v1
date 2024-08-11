var Governance = artifacts.require('Governance.sol');
var ethers = require('ethers')


function splitSign(sign) {
   
    const signature = sign.substring(2);
    const r = "0x" + signature.substring(0, 64);
    const s = "0x" + signature.substring(64, 128);
    const v = parseInt(signature.substring(128, 130), 16);
    return {r,s,v}
    }
//provider
    let provider = new ethers.JsonRpcProvider("HTTP://127.0.0.1:7545");

    //university wallet

const privateKeyUniv = "0x2a8fe9504d2221aece43276de46468857ea08623dca2ac316c23036c95dfa849"
let univWallet = new ethers.Wallet(privateKeyUniv)
univWallet.connect(provider)

// hod wallet
let privateKeyHod = "0x08f152c5f17beba16096596a8b05ded5ba82e2b0fb7f25a31363ecb892cc8c89"
let hodWallet = new ethers.Wallet(privateKeyHod)
hodWallet.connect(provider)

// mentor wallet
let privateKeyMent = "0x4dd9690ded3e7140686bb8293d2d31461610028fd706d93a8a2c3d689d9b7725"
let mentorWallet = new ethers.Wallet(privateKeyMent);
mentorWallet.connect(provider)

//relayer wallet
let privateKeyRelayer = "0x0793c18834917e50549d0e64039d71a265cdc0139f4328c4e62eaad9ca13aa63"
let relayerWallet = new ethers.Wallet(privateKeyRelayer)
mentorWallet.connect(relayerWallet)

contract("Governance contract",async(accounts)=>{
    it("governance name",async()=>{
let contract = await Governance.deployed();
let governanceName = await contract.governanceName()
console.log(governanceName)
    })

    it("joining as a Grader",async()=>{
        let contract = await Governance.deployed()
let domain = {
    name: "MCA",
    version: '1',
    chainId: 1337,
    verifyingContract: contract.address,
  }
let types = {
           
            Enroll:[
               {name:"account",type:"address"},
               {name:"_secretKey_1",type:"string"},
               {name:"_secretKey_2",type:"string"},
               {name:"role",type:"string"},
               {name:"uniqueId",type:"uint256"}
               ]
         }

         let value = {
            account:accounts[2],
            _secretKey_1:"_secretKey_1",
            _secretKey_2:"_secretKey_2",
            role:"grader",
            uniqueId:1
            
        }

let signature = await univWallet.signTypedData(domain,types,value);
let {r,s,v} = splitSign(signature)
let tx = await contract.becomeGrader(value.account,value._secretKey_1,value._secretKey_2,value.role,value.uniqueId,v,r,s)
console.log(tx.tx)
})

    it("joining as a HOD",async()=>{
        let contract = await Governance.deployed()
        let domain = {
            name: "MCA",
            version: '1',
            chainId: 1337,
            verifyingContract: contract.address,
          }
        let types = {
                   
                    Enroll:[
                       {name:"account",type:"address"},
                       {name:"_secretKey_1",type:"string"},
                       {name:"_secretKey_2",type:"string"},
                       {name:"role",type:"string"},
                       {name:"uniqueId",type:"uint256"}
                       ]
                 }
        
                 let value = {
                    account:accounts[3],
                    _secretKey_1:"_secretKey_1",
                    _secretKey_2:"_secretKey_2",
                    role:"hod",
                    uniqueId:2
                    
                }
        
        let signature = await univWallet.signTypedData(domain,types,value);
        let {r,s,v} = splitSign(signature)
        let tx = await contract.becomeHod(value.account,value._secretKey_1,value._secretKey_2,value.role,value.uniqueId,v,r,s)
        console.log(tx.tx)
    })

    it("joining as a Mentor",async()=>{
        let contract = await Governance.deployed()
        let domain = {
            name: "MCA",
            version: '1',
            chainId: 1337,
            verifyingContract: contract.address,
          }
        let types = {
                   
                    Enroll:[
                       {name:"account",type:"address"},
                       {name:"_secretKey_1",type:"string"},
                       {name:"_secretKey_2",type:"string"},
                       {name:"role",type:"string"},
                       {name:"uniqueId",type:"uint256"}
                       ]
                 }
        
                 let value = {
                    account:accounts[4],
                    _secretKey_1:"_secretKey_1",
                    _secretKey_2:"_secretKey_2",
                    role:"mentor",
                    uniqueId:3
                    
                }
        
        let signature = await hodWallet.signTypedData(domain,types,value);
        let {r,s,v} = splitSign(signature)
        let tx = await contract.becomeMentor(value.account,accounts[3],value._secretKey_1,value._secretKey_2,value.role,value.uniqueId,v,r,s)
        console.log(tx.tx)
    })

    it("joining as a student",async()=>{
        let contract = await Governance.deployed()
        let domain = {
            name: "MCA",
            version: '1',
            chainId: 1337,
            verifyingContract: contract.address,
          }
        let types = {
                   
                    Enroll:[
                       {name:"account",type:"address"},
                       {name:"_secretKey_1",type:"string"},
                       {name:"_secretKey_2",type:"string"},
                       {name:"role",type:"string"},
                       {name:"uniqueId",type:"uint256"}
                       ]
                 }
        
                 let value = {
                    account:accounts[5],
                    _secretKey_1:"_secretKey_1",
                    _secretKey_2:"_secretKey_2",
                    role:"student",
                    uniqueId:4
                    
                }
        
        let signature = await mentorWallet.signTypedData(domain,types,value);
        let {r,s,v} = splitSign(signature)
        let tx = await contract.becomeStudent(value.account,accounts[4],value._secretKey_1,value._secretKey_2,value.role,value.uniqueId,v,r,s)
        console.log(tx.tx)
    })

    it("checking role",async()=>{
        let contract = await Governance.deployed();
      let isHod = await contract.isHod(accounts[3]);
      let isGrader = await contract.isGrader(accounts[2]);
      let isMentor = await contract.isMentor(accounts[4]);
      let isStudent = await contract.isStudent(accounts[5])
      let relayer = await contract.relayer()
      console.log({isHod,isGrader,isMentor,isStudent,relayer})
    })
    it("approving & minting marksheet",async()=>{
        let contract = await Governance.deployed();
        let relayerSignature = await relayerWallet.signMessage("bafkreicfxwpiczfhtvasunt2njwd6mce3tjsbntuv3tgxoea2ezfr73k4m");
        let domain ={
            name: "MCA",
            version: '1',
            chainId: 1337,
            verifyingContract: contract.address
        }

        let types = {
            signStudent:[
               {name:"currentSemNum",type:"uint256"},
               {name:"receiptNo",type:"string"},
               {name:"stud",type:"address"},
               {name:"ipfsCid",type:"string"},
               {name:"degreeIpfs",type:"string"}
            ]
           }
let value = {
    currentSemNum: 1,
    receiptNo:"RECEIPT1",
    stud:accounts[5],
    ipfsCid:"bafkreicfxwpiczfhtvasunt2njwd6mce3tjsbntuv3tgxoea2ezfr73k4m",
    degreeIpfs:""
}
let mentorSign = await mentorWallet.signTypedData(domain,types,value);
let tx = await contract.mintCert(value.stud,accounts[4],value.currentSemNum,value.receiptNo,mentorSign,value.ipfsCid,relayerSignature,value.degreeIpfs)

console.log(tx.tx)
    })

    it("fetching marksheet",async()=>{
        let contract = await Governance.deployed();
        let dt = await contract.getSemMarkSheet(accounts[5],1)
        console.log(dt)
    })

    it("updating Marksheet",async()=>{
        let contract = await Governance.deployed();

        let domain ={
            name: "MCA",
            version: '1',
            chainId: 1337,
            verifyingContract: contract.address
        }
        let types = {
            update:[
                {name:"account",type:"address"},
                {name:"cid",type:"string"},
                {name :"uniqueId",type:"uint256"},
                {name:"semNo",type:"uint256"}
            ]
        }
        let value = {
            account:accounts[5],
            cid:"bafkreicfxwpiczfhtvasunt2njwd6mce3tjsbntuv3tgxoea2ezfr73k4u",
            uniqueId:676,
            semNo:1
        }
        let signature = await mentorWallet.signTypedData(domain,types,value)
        let tx = await contract.editSemMarkSheet(value.account,accounts[4],value.cid,value.semNo,signature,value.uniqueId)
       console.log(tx.tx)
    })

    it("again fetching Marksheet",async()=>{
        let contract = await Governance.deployed();
        let dt = await contract.getSemMarkSheet(accounts[5],1)
        console.log(dt)
    })

    it("minting Provisional cert",async()=>{
        let contract = await Governance.deployed();
        let currentSemNum = await contract.currentSemester(accounts[5])
        let currentSemInStrFormat = currentSemNum+""
        let currentSemInIntFormat = parseInt(currentSemInStrFormat)
        let totalEndExam = await contract.totalEndExamination()
        let totalEndExamInStrFormat = totalEndExam+""
        let totalEndExamInIntFormat = parseInt(totalEndExamInStrFormat)
        let i = currentSemInIntFormat+1
        for(i;i<= totalEndExamInIntFormat;i++){
            let relayerSignature = await relayerWallet.signMessage("bafkreicfxwpiczfhtvasunt2njwd6mce3tjsbntuv3tgxoea2ezfr73k4m");
            let domain ={
                name: "MCA",
                version: '1',
                chainId: 1337,
                verifyingContract: contract.address
            }
    
            let types = {
                signStudent:[
                   {name:"currentSemNum",type:"uint256"},
                   {name:"receiptNo",type:"string"},
                   {name:"stud",type:"address"},
                   {name:"ipfsCid",type:"string"},
                   {name:"degreeIpfs",type:"string"}
                ]
               }
    let value = {
        currentSemNum: i,
        receiptNo:"RECEIPT"+i+5,
        stud:accounts[5],
        ipfsCid:"bafkreicfxwpiczfhtvasunt2njwd6mce3tjsbntuv3tgxoea2ezfr73k4m",
        degreeIpfs:"degree ipfs"
    }
    let mentorSign = await mentorWallet.signTypedData(domain,types,value);
try{
    let tx = await contract.mintCert(value.stud,accounts[4],value.currentSemNum,value.receiptNo,mentorSign,value.ipfsCid,relayerSignature,value.degreeIpfs)

      console.log(tx.tx)
}catch(err){
    console.log(err)
}

        }
      
    })

    it("all credential",async()=>{
        let contract = await Governance.deployed();
for(let i = 1;i<=4;i++){
    let dt = await contract.getSemMarkSheet(accounts[5],i)
    console.log(dt)

}
let Provisional = await  contract.getDegree(accounts[5])
console.log(Provisional)
    })

//     it("burning Provisional Certificates",async()=>{
//         let contract = await Governance.deployed();
//         let tx = await contract.burnDegreeCert(accounts[5])
//         console.log({tx:tx.tx})
//         let Provisional = await  contract.getDegree(accounts[5])
// console.log(Provisional)
        
//     })
})
