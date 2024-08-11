// SPDX-License-Identifier: MIT
pragma solidity >=0.8.19;
contract Governance{
    address public relayer;
    address public contractAddress;
    string public governanceName;
    uint public totalEndExamination;
    address public owner;
    string public batch;
    mapping(address=>bool) public student;
    mapping(address=>bool) public grader;
    mapping(address=>bool) public hod;
    mapping(address=>bool) public mentors;
    uint public graderNonceCount = 0;
struct Certificate{
    string ipfsCID;
    bool status;
}
mapping(address=>mapping(uint=>Certificate)) public semCertIssuance;
mapping(address=>Certificate) public degreeCert;
mapping(address=>uint) public currentSemester;
mapping(string=>bool) public isUsedReceipt;
uint internal immutable CHAIN_ID;
bytes32 internal immutable INITIAL_DOMAIN_SEPARATOR;
uint public nonce;
mapping (uint=>address) public graderNonce;
mapping (uint=>address) public studentNonce;
mapping (uint=>address) public mentorNonce;
mapping (uint=>address) public hodNonce;
mapping(uint=>bool) isUniqueIdUsed;
constructor(string memory _governanceName,uint _totalEndExamination, address _owner,string memory _batch,address _relayer){
contractAddress = address(this);
governanceName = _governanceName;
totalEndExamination =_totalEndExamination;
owner = _owner;
batch = _batch;
CHAIN_ID = block.chainid;
relayer = _relayer;
INITIAL_DOMAIN_SEPARATOR = hashDomain(_governanceName,"1",block.chainid,address(this));
}
modifier Elig(address add,uint uniqueId){
require(student[add] != true,"YAS");
require(grader[add] != true,"YAG");
require(mentors[add] != true,"YAM");
require(hod[add] != true,"YAH");
require(owner != add,"OCM");
require(isUniqueIdUsed[uniqueId] != true,"IAU");
    _;
}
function hash(address add,string memory _secretKey_1, string memory _secretKey_2,string memory role,uint256 uniqueId) public  pure returns(bytes32){
return (keccak256(abi.encode(
keccak256(bytes("Enroll(address account,string _secretKey_1,string _secretKey_2,string role,uint256 uniqueId)")),
add,
keccak256(bytes(_secretKey_1)),
keccak256(bytes(_secretKey_2)),
keccak256(bytes(role)),
uniqueId
)));
}
function becomeGrader(address graderAddress,string memory _secretKey_1, string memory _secretKey_2, string memory role,uint256 uniqueId,uint8 v, bytes32 r, bytes32 s) Elig(graderAddress,uniqueId)  external{
require(keccak256(bytes(role)) == keccak256(bytes("grader")),"GSOA");
bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            INITIAL_DOMAIN_SEPARATOR,
            hash(graderAddress,_secretKey_1, _secretKey_2,role,uniqueId)
        ));
address recoveredAddress = ecrecover(digest, v, r, s);
require(recoveredAddress == owner,"!SIG");
grader[graderAddress] = true;
isUniqueIdUsed[uniqueId] = true;
graderNonce[nonce] = graderAddress;
nonce++;
}
function becomeHod(address hodAddress,string memory _secretKey_1, string memory _secretKey_2, string memory role,uint256 uniqueId,uint8 v, bytes32 r, bytes32 s) Elig(hodAddress,uniqueId)  external{
require(keccak256(bytes(role)) == keccak256(bytes("hod")),"HSOA");
bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            INITIAL_DOMAIN_SEPARATOR,
            hash(hodAddress,_secretKey_1, _secretKey_2,role,uniqueId)
        ));
address recoveredAddress = ecrecover(digest, v, r, s);
require(recoveredAddress == owner,"!SIG");
hod[hodAddress] = true;
isUniqueIdUsed[uniqueId] = true;
hodNonce[nonce] = hodAddress;
nonce++;
}
 function becomeStudent(address studentAddress,address signer,string memory _secretKey_1, string memory _secretKey_2, string memory role,uint256 uniqueId,uint8 v, bytes32 r, bytes32 s) Elig(studentAddress,uniqueId)  external{
require(keccak256(bytes(role)) == keccak256(bytes("student")),"SSOA");
require(mentors[signer] == true,"SNM");
bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            INITIAL_DOMAIN_SEPARATOR,
            hash(studentAddress,_secretKey_1, _secretKey_2,role,uniqueId)
        ));
address recoveredAddress = ecrecover(digest, v, r, s);
require(recoveredAddress == signer,"!SIGN");
student[studentAddress] = true;
isUniqueIdUsed[uniqueId] = true;
studentNonce[nonce] = studentAddress;
nonce++;
}
function becomeMentor(address mentorAddress,address signer,string memory _secretKey_1, string memory _secretKey_2, string memory role,uint256 uniqueId,uint8 v, bytes32 r, bytes32 s) Elig(mentorAddress,uniqueId)  external{
require(keccak256(bytes(role)) == keccak256(bytes("mentor")),"MSOA");
require(hod[signer] == true,"SNH");
bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            INITIAL_DOMAIN_SEPARATOR,
            hash(mentorAddress,_secretKey_1, _secretKey_2,role,uniqueId)
        ));
address recoveredAddress = ecrecover(digest, v, r, s);
require(recoveredAddress == signer,"!SIGN");
mentors[mentorAddress] = true;
isUniqueIdUsed[uniqueId] = true;
mentorNonce[nonce] = mentorAddress;
nonce++;
}
function recover(bytes memory _signature,bytes32 _ethHash)public pure returns(address){
       (bytes32 r,bytes32 s,uint8 v) = split(_signature);
       return ecrecover(_ethHash,v,r,s);
}
function split(bytes memory  _signature)public pure returns(bytes32 r,bytes32 s,uint8 v){
       require(_signature.length == 65,"LINP");
         assembly {
          
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }
}
function isStudent(address _add)external view returns(bool){
    return student[_add];
}
function isGrader(address _add)external view returns(bool){
    return grader[_add];
}
function isMentor(address _add)external view returns(bool){
    return mentors[_add];
}
function isHod(address _add) external view returns(bool){
    return hod[_add];
}
function isVerifyByrelayer(string memory _ipfsCID,bytes memory signature)public view returns (bool){
bytes32 _ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n59",_ipfsCID));
require(recover(signature,_ethHash) == relayer,"INVALID_RELAYER_SIGNER");
return true;
}
function mentorSignStudent(uint256 currentSemNum,string memory receiptNo,address stud,string memory ipfsCid,string memory degreeIpfs)public pure returns(bytes32){
    return (keccak256(abi.encode(
            keccak256(bytes("signStudent(uint256 currentSemNum,string receiptNo,address stud,string ipfsCid,string degreeIpfs)")),
            currentSemNum,
            keccak256(bytes(receiptNo)),
            stud,
            keccak256(bytes(ipfsCid)),
            keccak256(bytes(degreeIpfs))
        )));
    } 

function isMentorSign(address mentor,uint256 currentSemNum,string memory receiptNo,address _studentAdd,string memory cid,string memory degreeCid,uint8 v, bytes32 r, bytes32 s) public view {
require(mentors[mentor] == true,"MINE");
bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            INITIAL_DOMAIN_SEPARATOR,
            mentorSignStudent(currentSemNum, receiptNo,_studentAdd,cid,degreeCid)
        ));
address recoveredAddress = ecrecover(digest, v, r, s);
require(recoveredAddress == mentor,"!MEN");
}
function mintCert(address _student,address mentor,uint256 currentSemNum,string memory receiptNo,bytes memory mentorSignature, string memory _ipfsCID,bytes memory relayerSig,string memory degreeIpfs) external{
require(student[_student] == true,"YNS");
require(isUsedReceipt[receiptNo] == false,"YAM");
(bytes32 r,bytes32 s,uint8 v) = split(mentorSignature);
isMentorSign(mentor,currentSemNum,receiptNo,_student,_ipfsCID,degreeIpfs,v,r,s);
isVerifyByrelayer(_ipfsCID,relayerSig);
semCertIssuance[_student][currentSemNum] = Certificate(_ipfsCID, true);
currentSemester[_student] = currentSemNum;
isUsedReceipt[receiptNo] = true;
if(currentSemNum == totalEndExamination)
mintDegreeCert(_student,degreeIpfs);
}
function mintDegreeCert(address _student,string memory _ipfsCID) public {
    require(student[_student] == true,"!YANHRTM");
    require(currentSemester[_student] == totalEndExamination,"NEM");
    degreeCert[_student] = Certificate(_ipfsCID,true);
}
function getSemMarkSheet(address _stud,uint sem)public view returns (string memory){
    Certificate storage _cert = semCertIssuance[_stud][sem];
    return (_cert.ipfsCID);
}
function getDegree(address _stud)public view returns (string memory){
    Certificate storage _cert = degreeCert[_stud];
    return (_cert.ipfsCID);
}
function hashUpd(address _add,string memory _cid,uint256 uniqueId,uint256 semNo) public  pure returns(bytes32){
return (keccak256(abi.encode(
keccak256(bytes("update(address account,string cid,uint256 uniqueId,uint256 semNo)")),
_add,
keccak256(bytes(_cid)),
uniqueId,
semNo
)));
}

function editSemMarkSheet(address _student,address _mentor,string memory newIpfsCid,uint semesterNum,bytes memory sign,uint256 uniqueId)external {
    require(semesterNum <= currentSemester[_student] && isUniqueIdUsed[uniqueId] == false,"NEIOUM");
    require(mentors[_mentor] == true,"YNM");
    bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            INITIAL_DOMAIN_SEPARATOR,
            hashUpd(_student,newIpfsCid,uniqueId,semesterNum)
        ));
(bytes32 r,bytes32 s,uint8 v) = split(sign);
address recoveredAddress = ecrecover(digest, v, r, s);
require(recoveredAddress == _mentor,"!SIG");
    semCertIssuance[_student][semesterNum] = Certificate(newIpfsCid,true);
    isUniqueIdUsed[uniqueId] = true;

}
function editDegreeCert(address _student,string memory newIpfsCid,uint256 uniqueId,bytes memory sign)external {
require(totalEndExamination == currentSemester[_student]&& isUniqueIdUsed[uniqueId] == false,"NEIOUD");
   bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            INITIAL_DOMAIN_SEPARATOR,
            hashUpd(_student,newIpfsCid,uniqueId,totalEndExamination)
        ));
(bytes32 r,bytes32 s,uint8 v) = split(sign);
address recoveredAddress = ecrecover(digest, v, r, s);
require(recoveredAddress == owner,"!SIG");
degreeCert[_student] = Certificate(newIpfsCid,true);
 isUniqueIdUsed[uniqueId] = true;
}
function burnDegreeCert(address _student) external {
    require(degreeCert[_student].status == true,"NDB");
    degreeCert[_student] = Certificate("",false);
}
function returnChainId()public view returns(uint){
    return block.chainid;
}
function hashDomain(string memory name,string memory version,uint chainId,address verifyingContract) private pure returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes(name)),
            keccak256(bytes(version)),
            chainId,
            verifyingContract
        ));
    }

}