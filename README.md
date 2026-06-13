# Souldem — Smart Contracts

Ethereum smart contracts for Souldem's on-chain academic governance and certificate issuance system.

## Architecture

Three contracts form a deployment hierarchy:

```
BaseContract  (deployed once globally)
  └── GovernanceFactory  (one per university, created via BaseContract)
        └── Governance  (one per batch/program, created via GovernanceFactory)
```

| Contract | Purpose |
|---|---|
| `BaseContract` | Root factory — universities create their GovernanceFactory here |
| `GovernanceFactory` | University-level factory — creates Governance contracts per batch |
| `Governance` | Batch-level contract — manages roles, marksheets, certificates |

All role assignments and certificate actions are secured via **EIP-712 typed signatures** (`ecrecover`).

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 18 | [nodejs.org](https://nodejs.org) |
| Truffle | ≥ 5.x | `npm install -g truffle` |
| Ganache | ≥ 7.x | `npm install -g ganache` |

## Setup

```bash
cd souldem-v1
npm install
```

## Run Local Blockchain

Start Ganache on port **7545** (matches `truffle-config.js`):

```bash
ganache --port 7545 --networkId 5777 --deterministic
```

The `--deterministic` flag uses a fixed mnemonic so accounts are reproducible between runs.

## Compile Contracts

```bash
truffle compile
```

Artifacts are output to `build/contracts/`.

## Deploy Contracts

### Local (Ganache)
```bash
truffle migrate --network development
```

### Reset and redeploy
```bash
truffle migrate --reset --network development
```

> **After deployment:** copy the deployed `BaseContract` address into:
> - `Souldem-Backend/.env` → `FACTORY_CONTRACT_ADDRESS`
> - `Souldem-Frontend/.env` → `NEXT_PUBLIC_BASE_FACTORY_ADDRESS`

### Public Testnet (Sepolia)

1. Copy `.env.example` to `.env` and fill in `MNEMONIC` and `INFURA_PROJECT_ID`
2. Uncomment the Goerli/Sepolia network block in `truffle-config.js` and add:

```js
const HDWalletProvider = require('@truffle/hdwallet-provider');
require('dotenv').config();
```

3. Install the wallet provider:

```bash
npm install @truffle/hdwallet-provider dotenv
```

4. Deploy:

```bash
truffle migrate --network sepolia
```

## Run Tests

Ganache must be running on port 7545 before running tests.

```bash
# In one terminal
ganache --port 7545 --networkId 5777 --deterministic

# In another terminal
npm test
# or
truffle test
```

### Test Structure

```
test/
  helpers/
    signing.js          — EIP-712 and personal_sign helper functions
  BaseContract.test.js  — 6 tests: factory creation, duplicate prevention, invalid sigs
  GovernanceFactory.test.js — 7 tests: governance creation, nonce replay protection, events
  Governance.test.js    — 25 tests: full lifecycle (enroll → mint → edit → burn)
```

### What the tests cover

- `BaseContract`: factory creation with valid/invalid EIP-712 sig, duplicate owner prevention
- `GovernanceFactory`: governance deployment, event emission, nonce-based replay protection
- `Governance`:
  - Role enrollment: `becomeGrader`, `becomeHod`, `becomeMentor`, `becomeStudent`
  - Revert cases: wrong role, duplicate address, used uniqueId, wrong signer
  - Certificate minting: semester certs + automatic degree mint on final semester
  - Receipt replay prevention
  - `editSemMarkSheet`, `editDegreeCert`, `burnDegreeCert`
  - Relayer signature verification

## Contract Roles

| Role | Enrolled by | Can do |
|---|---|---|
| **HOD** | University owner | Invite mentors |
| **Mentor** | HOD | Invite students, sign marksheets |
| **Student** | Mentor | Receive marksheet certificates |
| **Grader** | University owner | Enter marks (tracked off-chain) |

## Semester Flow

```
1. University deploys GovernanceFactory (via BaseContract)
2. University creates Governance per batch (via GovernanceFactory)
3. University enrolls Grader and HOD
4. HOD enrolls Mentor
5. Mentor enrolls Student
6. Grader enters marks (off-chain, stored in backend)
7. Mentor signs marksheet → mintCert() called
8. On final semester → degree cert auto-minted
```

## Environment Variables

See `.env.example`. For local dev no variables are required (Ganache runs on hardcoded port 7545).

## Known Issues

- `isVerifyByrelayer` hardcodes `\n59` — IPFS CID passed to this function must be exactly 59 bytes
- `editSemMarkSheet` uses `<=` for semester check (should be `<`) — editing current semester is blocked
- `hash()`, `mentorSignStudent()`, `hashUpd()` are `public` (should be `internal`)
