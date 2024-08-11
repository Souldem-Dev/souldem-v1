var Contract = artifacts.require('BaseContract.sol')
module.exports = function(deployer){
deployer.deploy(Contract)
}