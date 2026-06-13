/**
 * signing.js — EIP-712 / personal_sign helper utilities for Souldem tests.
 *
 * All helpers accept an ethers.js v6 Wallet instance so tests stay
 * framework-agnostic.  Return shapes are documented per function.
 */

"use strict";

const { ethers } = require("ethers");

// ─── Domain ──────────────────────────────────────────────────────────────────

/**
 * Build the EIP-712 domain object expected by every contract in this project.
 *
 * @param {string}  name             - Domain name (e.g. "BASE_FACTORY")
 * @param {number|bigint} chainId    - Network chain ID
 * @param {string}  contractAddress  - Deployed contract address (verifyingContract)
 * @returns {{ name, version, chainId, verifyingContract }}
 */
function getDomain(name, chainId, contractAddress) {
  return {
    name,
    version: "1",
    chainId: Number(chainId),
    verifyingContract: contractAddress,
  };
}

// ─── Signature splitting ─────────────────────────────────────────────────────

/**
 * Split a 65-byte hex signature string into { v, r, s } components.
 * Compatible with the Solidity `ecrecover(digest, v, r, s)` call order used
 * directly by BaseContract and GovernanceFactory.
 *
 * @param {string} sig - 0x-prefixed 130-hex-char signature
 * @returns {{ v: number, r: string, s: string }}
 */
function splitSig(sig) {
  const { v, r, s } = ethers.Signature.from(sig);
  return { v, r, s };
}

// ─── BaseContract ─────────────────────────────────────────────────────────────

/**
 * Sign the `Create(address wallet, string universityName)` typed-data message
 * for BaseContract.createMyOwnFactory.
 *
 * @param {ethers.Wallet} wallet        - Signing wallet (must match _owner)
 * @param {object}        domain        - EIP-712 domain object
 * @param {string}        ownerAddr     - Address of the factory owner
 * @param {string}        universityName
 * @returns {{ v: number, r: string, s: string }}
 */
async function signCreateFactory(wallet, domain, ownerAddr, universityName) {
  const types = {
    Create: [
      { name: "wallet", type: "address" },
      { name: "universityName", type: "string" },
    ],
  };
  const value = { wallet: ownerAddr, universityName };
  const sig = await wallet.signTypedData(domain, types, value);
  return splitSig(sig);
}

// ─── GovernanceFactory ────────────────────────────────────────────────────────

/**
 * Sign the `CreateGovernance(...)` typed-data message for
 * GovernanceFactory.createNewContract.
 *
 * @param {ethers.Wallet} wallet
 * @param {object}        domain
 * @param {string}        ownerAddr
 * @param {string}        govName
 * @param {number}        totalEndExam
 * @param {string}        batch
 * @param {number|bigint} nonce        - Current nonce for ownerAddr
 * @param {string}        relayer      - Relayer address
 * @returns {{ v: number, r: string, s: string }}
 */
async function signCreateGovernance(
  wallet,
  domain,
  ownerAddr,
  govName,
  totalEndExam,
  batch,
  nonce,
  relayer
) {
  const types = {
    CreateGovernance: [
      { name: "wallet", type: "address" },
      { name: "governanceName", type: "string" },
      { name: "totalEndExamination", type: "uint256" },
      { name: "batch", type: "string" },
      { name: "nonces", type: "uint256" },
      { name: "relayer", type: "address" },
    ],
  };
  const value = {
    wallet: ownerAddr,
    governanceName: govName,
    totalEndExamination: totalEndExam,
    batch,
    nonces: nonce,
    relayer,
  };
  const sig = await wallet.signTypedData(domain, types, value);
  return splitSig(sig);
}

// ─── Governance – role enrollment ────────────────────────────────────────────

/**
 * Sign the `Enroll(address account, string _secretKey_1, string _secretKey_2,
 * string role, uint256 uniqueId)` typed-data message used by becomeGrader,
 * becomeHod, becomeMentor and becomeStudent.
 *
 * @param {ethers.Wallet} wallet
 * @param {object}        domain
 * @param {string}        addr      - Address being enrolled
 * @param {string}        sk1
 * @param {string}        sk2
 * @param {string}        role      - "grader" | "hod" | "mentor" | "student"
 * @param {number}        uniqueId
 * @returns {{ v: number, r: string, s: string }}
 */
async function signEnroll(wallet, domain, addr, sk1, sk2, role, uniqueId) {
  const types = {
    Enroll: [
      { name: "account", type: "address" },
      { name: "_secretKey_1", type: "string" },
      { name: "_secretKey_2", type: "string" },
      { name: "role", type: "string" },
      { name: "uniqueId", type: "uint256" },
    ],
  };
  const value = {
    account: addr,
    _secretKey_1: sk1,
    _secretKey_2: sk2,
    role,
    uniqueId,
  };
  const sig = await wallet.signTypedData(domain, types, value);
  return splitSig(sig);
}

// ─── Governance – certificate minting ────────────────────────────────────────

/**
 * Sign the `signStudent(uint256 currentSemNum, string receiptNo, address stud,
 * string ipfsCid, string degreeIpfs)` typed-data message used by mintCert.
 *
 * Unlike the enrollment helpers this returns the full 65-byte hex string
 * because mintCert accepts `bytes memory mentorSignature` and splits it
 * internally via `split()`.
 *
 * @param {ethers.Wallet} wallet
 * @param {object}        domain
 * @param {number}        semNum
 * @param {string}        receiptNo
 * @param {string}        studentAddr
 * @param {string}        cid         - IPFS CID (must be 59 chars for relayer check)
 * @param {string}        degreeCid
 * @returns {string} 0x-prefixed 65-byte signature hex string
 */
async function signMintMarksheet(
  wallet,
  domain,
  semNum,
  receiptNo,
  studentAddr,
  cid,
  degreeCid
) {
  const types = {
    signStudent: [
      { name: "currentSemNum", type: "uint256" },
      { name: "receiptNo", type: "string" },
      { name: "stud", type: "address" },
      { name: "ipfsCid", type: "string" },
      { name: "degreeIpfs", type: "string" },
    ],
  };
  const value = {
    currentSemNum: semNum,
    receiptNo,
    stud: studentAddr,
    ipfsCid: cid,
    degreeIpfs: degreeCid,
  };
  return wallet.signTypedData(domain, types, value);
}

// ─── Governance – relayer personal sign ──────────────────────────────────────

/**
 * Produce the relayer personal-sign over the IPFS CID.
 *
 * The contract checks:
 *   keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n59", cid))
 * which is exactly what `wallet.signMessage(cid)` produces when cid is a
 * plain string of 59 characters (ethers prefixes with the length of the
 * UTF-8 byte representation, which equals the char count for pure ASCII).
 *
 * IMPORTANT: cid MUST be exactly 59 characters long.
 *
 * @param {ethers.Wallet} wallet
 * @param {string}        cid   - Exactly 59-char IPFS CID string
 * @returns {string} 0x-prefixed signature hex string
 */
async function signRelayer(wallet, cid) {
  if (cid.length !== 59) {
    throw new Error(
      `signRelayer: cid must be exactly 59 characters, got ${cid.length}`
    );
  }
  // ethers.Wallet.signMessage(string) treats the argument as a UTF-8 string
  // and prepends "\x19Ethereum Signed Message:\n<byteLength>" automatically.
  return wallet.signMessage(cid);
}

// ─── Governance – marksheet / degree update ──────────────────────────────────

/**
 * Sign the `update(address account, string cid, uint256 uniqueId,
 * uint256 semNo)` typed-data message used by editSemMarkSheet and
 * editDegreeCert.
 *
 * Returns the full 65-byte hex signature string because both edit functions
 * accept `bytes memory sign` and split it internally.
 *
 * @param {ethers.Wallet} wallet
 * @param {object}        domain
 * @param {string}        addr
 * @param {string}        cid
 * @param {number}        uniqueId
 * @param {number}        semNo
 * @returns {string} 0x-prefixed 65-byte signature hex string
 */
async function signUpdate(wallet, domain, addr, cid, uniqueId, semNo) {
  const types = {
    update: [
      { name: "account", type: "address" },
      { name: "cid", type: "string" },
      { name: "uniqueId", type: "uint256" },
      { name: "semNo", type: "uint256" },
    ],
  };
  const value = { account: addr, cid, uniqueId, semNo };
  return wallet.signTypedData(domain, types, value);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  getDomain,
  splitSig,
  signCreateFactory,
  signCreateGovernance,
  signEnroll,
  signMintMarksheet,
  signRelayer,
  signUpdate,
};
