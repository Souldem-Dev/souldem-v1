/**
 * BaseContract.test.js
 *
 * Comprehensive Truffle tests for BaseContract.sol.
 *
 * BaseContract is a root factory: owners sign an EIP-712 message to
 * authorise the creation of a per-university GovernanceFactory.
 *
 * Test wallet private keys are the well-known Hardhat/Foundry deterministic
 * keys so they are safe to commit in test code.
 */

"use strict";

const BaseContract = artifacts.require("BaseContract");
const { ethers } = require("ethers");
const {
  getDomain,
  signCreateFactory,
} = require("./helpers/signing");

// ─── Test wallets ─────────────────────────────────────────────────────────────
// These are public test keys; never use them with real funds.

const OWNER_PK   = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const WRONG_PK   = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

const ownerWallet = new ethers.Wallet(OWNER_PK);
const wrongWallet = new ethers.Wallet(WRONG_PK);

// ─── Suite ────────────────────────────────────────────────────────────────────

contract("BaseContract", () => {
  // A fresh instance is deployed before each describe block that needs it.
  // Using `new` (not `.deployed()`) guarantees test isolation.

  // ── 1. Deployment & read-only views ────────────────────────────────────────
  describe("Deployment and read-only views", () => {
    let instance;

    before(async () => {
      instance = await BaseContract.new();
    });

    it("deploys successfully and has a valid address", async () => {
      assert.ok(
        instance.address,
        "Contract should have a non-empty address after deployment"
      );
    });

    it("returnChainId() returns a positive number", async () => {
      const chainId = await instance.returnChainId();
      assert.ok(
        Number(chainId) > 0,
        `Expected chainId > 0, got ${chainId}`
      );
    });

    it("getContractAdd() returns zero address when no factory has been created", async () => {
      const result = await instance.getContractAdd(ownerWallet.address);
      assert.equal(
        result,
        "0x0000000000000000000000000000000000000000",
        "Expected zero address before any factory is created"
      );
    });
  });

  // ── 2. createMyOwnFactory — happy path ─────────────────────────────────────
  describe("createMyOwnFactory — happy path", () => {
    let instance;
    let domain;

    before(async () => {
      instance = await BaseContract.new();
      const chainId = await instance.returnChainId();
      domain = getDomain("BASE_FACTORY", chainId, instance.address);
    });

    it("creates a factory with a valid EIP-712 signature and stores it", async () => {
      const universityName = "MIT University";
      const { v, r, s } = await signCreateFactory(
        ownerWallet,
        domain,
        ownerWallet.address,
        universityName
      );

      await instance.createMyOwnFactory(
        universityName,
        ownerWallet.address,
        v, r, s
      );

      const factoryAddr = await instance.getContractAdd(ownerWallet.address);
      assert.notEqual(
        factoryAddr,
        "0x0000000000000000000000000000000000000000",
        "Factory address should be non-zero after successful creation"
      );
    });

    it("getContractAdd() returns the stored factory address for that owner", async () => {
      // Re-verify after the previous test has already written state.
      const factoryAddr = await instance.getContractAdd(ownerWallet.address);
      assert.match(
        factoryAddr,
        /^0x[0-9a-fA-F]{40}$/,
        "Stored factory address should be a valid Ethereum address"
      );
    });
  });

  // ── 3. createMyOwnFactory — duplicate owner ─────────────────────────────────
  describe("createMyOwnFactory — revert on duplicate owner", () => {
    let instance;
    let domain;

    before(async () => {
      instance = await BaseContract.new();
      const chainId = await instance.returnChainId();
      domain = getDomain("BASE_FACTORY", chainId, instance.address);

      // First call — succeeds
      const { v, r, s } = await signCreateFactory(
        ownerWallet,
        domain,
        ownerWallet.address,
        "State University"
      );
      await instance.createMyOwnFactory(
        "State University",
        ownerWallet.address,
        v, r, s
      );
    });

    it("reverts with 'you already created' on a second call from the same owner", async () => {
      const { v, r, s } = await signCreateFactory(
        ownerWallet,
        domain,
        ownerWallet.address,
        "State University"
      );

      try {
        await instance.createMyOwnFactory(
          "State University",
          ownerWallet.address,
          v, r, s
        );
        assert.fail("Expected revert was not triggered");
      } catch (err) {
        assert.include(
          err.message,
          "you already created",
          `Expected 'you already created' in error, got: ${err.message}`
        );
      }
    });
  });

  // ── 4. createMyOwnFactory — invalid signer ──────────────────────────────────
  describe("createMyOwnFactory — revert on invalid signer", () => {
    let instance;
    let domain;

    before(async () => {
      instance = await BaseContract.new();
      const chainId = await instance.returnChainId();
      domain = getDomain("BASE_FACTORY", chainId, instance.address);
    });

    it("reverts with 'INVALID_SIGNER' when the signature comes from a different wallet", async () => {
      const universityName = "Fake University";

      // wrongWallet signs but we declare ownerWallet.address as the owner —
      // the recovered address will not match, triggering INVALID_SIGNER.
      const { v, r, s } = await signCreateFactory(
        wrongWallet,           // <-- wrong signer
        domain,
        ownerWallet.address,   // <-- claimed owner
        universityName
      );

      try {
        await instance.createMyOwnFactory(
          universityName,
          ownerWallet.address,
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
});
