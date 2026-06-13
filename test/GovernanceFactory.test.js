/**
 * GovernanceFactory.test.js
 *
 * Comprehensive Truffle tests for GovernanceFactory.sol.
 *
 * GovernanceFactory is a per-university factory.  Owners sign an EIP-712
 * CreateGovernance message to deploy a new Governance (per-batch) contract.
 * Nonces prevent replay attacks.
 */

"use strict";

const GovernanceFactory = artifacts.require("GovernanceFactory");
const { ethers } = require("ethers");
const {
  getDomain,
  signCreateGovernance,
} = require("./helpers/signing");

// ─── Test wallets ─────────────────────────────────────────────────────────────

const OWNER_PK   = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const RELAYER_PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const WRONG_PK   = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

const ownerWallet   = new ethers.Wallet(OWNER_PK);
const relayerWallet = new ethers.Wallet(RELAYER_PK);
const wrongWallet   = new ethers.Wallet(WRONG_PK);

const FACTORY_NAME = "MIT University";

// ─── Suite ────────────────────────────────────────────────────────────────────

contract("GovernanceFactory", () => {

  // ── 1. Deployment & read-only views ────────────────────────────────────────
  describe("Deployment and read-only views", () => {
    let factory;

    before(async () => {
      factory = await GovernanceFactory.new(FACTORY_NAME);
    });

    it("deploys with the given contract name", async () => {
      const name = await factory.getContractName();
      assert.equal(
        name,
        FACTORY_NAME,
        "getContractName() should return the name passed to the constructor"
      );
    });

    it("returnChainId() returns a positive number", async () => {
      const chainId = await factory.returnChainId();
      assert.ok(
        Number(chainId) > 0,
        `Expected chainId > 0, got ${chainId}`
      );
    });

    it("returnNonce() starts at 0 for a fresh address", async () => {
      const nonce = await factory.returnNonce(ownerWallet.address);
      assert.equal(
        Number(nonce),
        0,
        "Initial nonce should be 0"
      );
    });
  });

  // ── 2. createNewContract — happy path ──────────────────────────────────────
  describe("createNewContract — happy path", () => {
    let factory;
    let domain;

    before(async () => {
      factory = await GovernanceFactory.new(FACTORY_NAME);
      const chainId = await factory.returnChainId();
      domain = getDomain(FACTORY_NAME, chainId, factory.address);
    });

    it("deploys a Governance contract, emits newContract event, and increments nonce", async () => {
      const govName    = "CS Batch 2024";
      const totalExams = 4;
      const batch      = "2024-2028";
      const nonceBefore = Number(await factory.returnNonce(ownerWallet.address));

      const { v, r, s } = await signCreateGovernance(
        ownerWallet,
        domain,
        ownerWallet.address,
        govName,
        totalExams,
        batch,
        nonceBefore,
        relayerWallet.address
      );

      const tx = await factory.createNewContract(
        govName,
        totalExams,
        batch,
        ownerWallet.address,
        relayerWallet.address,
        v, r, s
      );

      // Event emitted
      const log = tx.logs.find((l) => l.event === "newContract");
      assert.ok(log, "Expected newContract event to be emitted");
      assert.equal(
        log.args.createdBy.toLowerCase(),
        ownerWallet.address.toLowerCase(),
        "createdBy in event should match owner"
      );
      assert.notEqual(
        log.args.governanceAddress,
        "0x0000000000000000000000000000000000000000",
        "Governance address in event should be non-zero"
      );
      assert.equal(
        log.args.governanceName,
        govName,
        "Event governanceName should match"
      );

      // Nonce incremented
      const nonceAfter = Number(await factory.returnNonce(ownerWallet.address));
      assert.equal(
        nonceAfter,
        nonceBefore + 1,
        "Nonce should increment by 1 after successful deployment"
      );
    });

    it("allows the same owner to create a second governance contract with the updated nonce", async () => {
      const nonce = Number(await factory.returnNonce(ownerWallet.address));

      const { v, r, s } = await signCreateGovernance(
        ownerWallet,
        domain,
        ownerWallet.address,
        "MBA Batch 2025",
        6,
        "2025-2031",
        nonce,
        relayerWallet.address
      );

      const tx = await factory.createNewContract(
        "MBA Batch 2025",
        6,
        "2025-2031",
        ownerWallet.address,
        relayerWallet.address,
        v, r, s
      );

      const log = tx.logs.find((l) => l.event === "newContract");
      assert.ok(log, "Second deployment should also emit newContract");

      const newNonce = Number(await factory.returnNonce(ownerWallet.address));
      assert.equal(newNonce, nonce + 1, "Nonce should increment again");
    });
  });

  // ── 3. createNewContract — invalid signer ──────────────────────────────────
  describe("createNewContract — revert on invalid signer", () => {
    let factory;
    let domain;

    before(async () => {
      factory = await GovernanceFactory.new(FACTORY_NAME);
      const chainId = await factory.returnChainId();
      domain = getDomain(FACTORY_NAME, chainId, factory.address);
    });

    it("reverts with 'INVALID_SIGNER' when signature is from the wrong wallet", async () => {
      const nonce = Number(await factory.returnNonce(ownerWallet.address));

      // wrongWallet signs but ownerWallet.address is passed as _owner
      const { v, r, s } = await signCreateGovernance(
        wrongWallet,            // <-- wrong signer
        domain,
        ownerWallet.address,    // <-- claimed owner
        "Fake Governance",
        4,
        "2024-2028",
        nonce,
        relayerWallet.address
      );

      try {
        await factory.createNewContract(
          "Fake Governance",
          4,
          "2024-2028",
          ownerWallet.address,
          relayerWallet.address,
          v, r, s
        );
        assert.fail("Expected revert was not triggered");
      } catch (err) {
        assert.include(
          err.message,
          "INVALID_SIGNER",
          `Expected 'INVALID_SIGNER' in error, got: ${err.message}`
        );
      }
    });
  });

  // ── 4. Nonce replay protection ─────────────────────────────────────────────
  describe("Nonce replay protection", () => {
    let factory;
    let domain;

    before(async () => {
      factory = await GovernanceFactory.new(FACTORY_NAME);
      const chainId = await factory.returnChainId();
      domain = getDomain(FACTORY_NAME, chainId, factory.address);

      // Perform first successful creation so nonce becomes 1
      const { v, r, s } = await signCreateGovernance(
        ownerWallet,
        domain,
        ownerWallet.address,
        "Physics Batch 2024",
        4,
        "2024-2028",
        0,                    // nonce = 0
        relayerWallet.address
      );
      await factory.createNewContract(
        "Physics Batch 2024",
        4,
        "2024-2028",
        ownerWallet.address,
        relayerWallet.address,
        v, r, s
      );
    });

    it("rejects a signature that reuses the old nonce (nonce=0) after it has been consumed", async () => {
      // Re-sign with nonce=0 even though on-chain nonce is now 1 → INVALID_SIGNER
      const { v, r, s } = await signCreateGovernance(
        ownerWallet,
        domain,
        ownerWallet.address,
        "Chemistry Batch 2024",
        4,
        "2024-2028",
        0,                    // stale nonce
        relayerWallet.address
      );

      try {
        await factory.createNewContract(
          "Chemistry Batch 2024",
          4,
          "2024-2028",
          ownerWallet.address,
          relayerWallet.address,
          v, r, s
        );
        assert.fail("Expected revert was not triggered for stale nonce");
      } catch (err) {
        assert.include(
          err.message,
          "INVALID_SIGNER",
          `Expected 'INVALID_SIGNER' for stale-nonce replay, got: ${err.message}`
        );
      }
    });
  });
});
