// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;
import "./Governance.sol";
contract GovernanceFactory{
    event newContract(address indexed createdBy, address indexed governanceAddress,uint length,string governanceName);
   Governance[] public governance;
  uint internal immutable CHAIN_ID;
bytes32 internal immutable INITIAL_DOMAIN_SEPARATOR;
mapping(address=>uint)public nonces;
string public contractName;
constructor(string memory _contractName){
   CHAIN_ID = block.chainid;
   contractName = _contractName;
INITIAL_DOMAIN_SEPARATOR = hashDomain(_contractName,"1",block.chainid,address(this));
}
 function hash(address wallet,string memory _governanceName,uint256 _totalEndExamination,string memory _batch,uint256 _nonces,address _relayer) public pure returns(bytes32){
return (keccak256(abi.encode(
keccak256(bytes("CreateGovernance(address wallet,string governanceName,uint256 totalEndExamination,string batch,uint256 nonces,address relayer)")),
wallet,
keccak256(bytes(_governanceName)),
_totalEndExamination,
keccak256(bytes(_batch)),
_nonces,
_relayer
)));
   }
function createNewContract( string memory _governanceName,uint256 _totalEndExamination,string memory _batch,address _owner,address _relayer,uint8 v, bytes32 r, bytes32 s)public {
    bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            INITIAL_DOMAIN_SEPARATOR,
            hash(_owner,_governanceName,_totalEndExamination,_batch,nonces[_owner],_relayer)
        ));
address recoveredAddress = ecrecover(digest, v, r, s);
require(recoveredAddress == _owner,"INVALID_SIGNER");
    Governance _governance = new Governance( _governanceName,_totalEndExamination,_owner,_batch,_relayer);
    governance.push(_governance);
    nonces[_owner]++;
    emit newContract(_owner,address(_governance),governance.length,_governanceName);
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

function getContractName() public view returns(string memory){
    return contractName;
}

function returnNonce(address _add)public view returns(uint){
return nonces[_add];
}

}

