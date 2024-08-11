var Contract = artifacts.require('Governance.sol')
module.exports = function(deployer){
    deployer.deploy(Contract,"MCA",4,"0x2c492f94a61e6Bc235aaB9fD9925eE14DA7c671E","2023-2025","0xc39a0B58cdeA2401443c61f03e0f9E49FDe2F650")
}