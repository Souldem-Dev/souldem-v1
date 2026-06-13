/**
 * Governance.test.js
 *
 * Comprehensive Truffle tests for Governance.sol.
 *
 * Governance is the per-batch smart contract that manages role enrolment
 * (grader / HOD / mentor / student) and certificate issuance (semester
 * mark-sheets + degree certificate).
 *
 * Test structure
 * ──────────────
 *  1.  Role enrolment — becomeGrader
 *  2.  Role enrolment — becomeHod
 *  3.  Role enrolment — becomeMentor
 *  4.  Role enrolment — becomeStudent
 *  5.  Certificate minting — mintCert (sem 1–4, degree auto-mint)
 *  6.  Certificate editing — editSemMarkSheet
 *  7.  Certificate editing — editDegreeCert
 *  8.  Certificate burning — burnDegreeCert
 *  9.  Elig modifier edge cases
 * 10.  Relayer verification — isVerifyByrelayer
 *
 * All tests in sections 1-10 share a SINGLE Governance instance so that
 * state accumulated in earlier sections (enrolled roles, minted certs) is
 * available to later sections without redundant re-setup.
 *
 * Unique IDs are allocated sequentially: 1=grader, 2=hod, 3=mentor, 4=student.
 * IDs from 100 onwards are used by edit operations.
 * IDs from 200 onwards are used by the secondary student.
 */

"use strict";

const Governance = artifacts.require("Governance");
const { ethers } = require("ethers");
const {
  getDomain,
  signEnroll,
  signMintMarksheet,
  signRelayer,
  signUpdate,
} = require("./helpers/signing");

// ─── Test wallets ─────────────────────────────────────────────────────────────
// Well-known deterministic test private keys — never use for real assets.

const OWNER_PK   = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const RELAYER_PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const HOD_PK     = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
const MENTOR_PK  = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6";
const STUDENT_PK = "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926b";
const GRADER_PK  = "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba";

const ownerWallet   = new ethers.Wallet(OWNER_PK);
const relayerWallet = new ethers.Wallet(RELAYER_PK);
const hodWallet     = new ethers.Wallet(HOD_PK);
const mentorWallet  = new ethers.Wallet(MENTOR_PK);
const studentWallet = new ethers.Wallet(STUDENT_PK);
const graderWallet  = new ethers.Wallet(GRADER_PK);

// ─── Governance constructor parameters ────────────────────────────────────────

const GOV_NAME    = "CS Batch 2024";
const TOTAL_EXAMS = 4;           // semester count — mintCert on sem 4 auto-mints degree
const BATCH       = "2024-2028";

// ─── IPFS CID constants ───────────────────────────────────────────────────────
// The relayer check hardcodes "\x19Ethereum Signed Message:\n59" so CIDs MUST
// be exactly 59 characters long.

const MOCK_CID        = "Qm" + "a".repeat(57); // 59 chars — sem-1 original
const MOCK_CID_2      = "Qm" + "c".repeat(57); // 59 chars — sem-2
const MOCK_CID_3      = "Qm" + "d".repeat(57); // 59 chars — sem-3
const MOCK_CID_4      = "Qm" + "e".repeat(57); // 59 chars — sem-4 (final)
const MOCK_DEGREE_CID = "Qm" + "b".repeat(57); // 59 chars — degree cert
const UPDATED_SEM_CID = "Qm" + "f".repeat(57); // 59 chars — updated sem-1
const UPDATED_DEG_CID = "Qm" + "g".repeat(57); // 59 chars — updated degree

// ─── Helper: assert revert with expected message substring ───────────────────

async function assertReverts(fn, expectedMsg) {
  try {
    await fn();
    assert.fail(`Expected revert with "${expectedMsg}" but call succeeded`);
  } catch (err) {
    if (err.message === `Expected revert with "${expectedMsg}" but call succeeded`) {
      throw err;
    }
    assert.include(
      err.message,
      expectedMsg,
      `Expected error containing "${expectedMsg}", got: ${err.message}`
    );
  }
}

// ─── Suite ────────────────────────────────────────────────────────────────────

contract("Governance", () => {
  // Shared contract instance — created once for the whole suite.
  let gov;
  let domain;

  // Unique-ID counter (start at 1, each enrolment/edit consumes one).
  // Shared mutable state is safe here because tests are sequential within
  // a single `contract()` block.
  let nextId = 1;
  function consumeId() {
    return nextId++;
  }

  before(async () => {
    gov = await Governance.new(
      GOV_NAME,
      TOTAL_EXAMS,
      ownerWallet.address,
      BATCH,
      relayerWallet.address
    );
    const chainId = await gov.returnChainId();
    domain = getDomain(GOV_NAME, chainId, gov.address);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 1. becomeGrader
  // ══════════════════════════════════════════════════════════════════════════
  describe("becomeGrader", () => {
    const SK1 = "grader_sk1";
    const SK2 = "grader_sk2";

    it("happy path: owner-signed enrolment makes address a grader", async () => {
      const uid = consumeId(); // 1
      const { v, r, s } = await signEnroll(
        ownerWallet, domain,
        graderWallet.address, SK1, SK2, "grader", uid
      );

      await gov.becomeGrader(
        graderWallet.address, SK1, SK2, "grader", uid, v, r, s
      );

      const isGrader = await gov.isGrader(graderWallet.address);
      assert.isTrue(isGrader, "isGrader should be true after successful enrolment");
    });

    it("nonce increments to 1 after grader enrolment", async () => {
      const nonce = Number(await gov.nonce());
      assert.equal(nonce, 1, "Contract nonce should be 1 after first enrolment");
    });

    it("reverts 'GSOA' when role string is not 'grader'", async () => {
      const uid = consumeId(); // 2 — won't be consumed because tx reverts
      const wrongWallet2 = ethers.Wallet.createRandom();
      const { v, r, s } = await signEnroll(
        ownerWallet, domain,
        wrongWallet2.address, SK1, SK2, "admin", uid
      );

      await assertReverts(
        () => gov.becomeGrader(wrongWallet2.address, SK1, SK2, "admin", uid, v, r, s),
        "GSOA"
      );
    });

    it("reverts 'YAG' if the same address tries to enrol as grader again", async () => {
      // graderWallet is already a grader — uid doesn't matter since Elig fires first
      const uid = consumeId(); // 3
      const { v, r, s } = await signEnroll(
        ownerWallet, domain,
        graderWallet.address, SK1, SK2, "grader", uid
      );

      await assertReverts(
        () => gov.becomeGrader(graderWallet.address, SK1, SK2, "grader", uid, v, r, s),
        "YAG"
      );
    });

    it("reverts 'IAU' if the uniqueId has already been used", async () => {
      // uid=1 was consumed by the successful grader enrolment
      const freshWallet = ethers.Wallet.createRandom();
      const { v, r, s } = await signEnroll(
        ownerWallet, domain,
        freshWallet.address, SK1, SK2, "grader", 1 // re-use uid 1
      );

      await assertReverts(
        () => gov.becomeGrader(freshWallet.address, SK1, SK2, "grader", 1, v, r, s),
        "IAU"
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 2. becomeHod
  // ══════════════════════════════════════════════════════════════════════════
  describe("becomeHod", () => {
    const SK1 = "hod_sk1";
    const SK2 = "hod_sk2";

    it("happy path: owner-signed enrolment makes address a HOD", async () => {
      const uid = consumeId(); // 4
      const { v, r, s } = await signEnroll(
        ownerWallet, domain,
        hodWallet.address, SK1, SK2, "hod", uid
      );

      await gov.becomeHod(
        hodWallet.address, SK1, SK2, "hod", uid, v, r, s
      );

      const isHod = await gov.isHod(hodWallet.address);
      assert.isTrue(isHod, "isHod should be true after successful enrolment");
    });

    it("reverts 'HSOA' when role string is not 'hod'", async () => {
      const freshWallet = ethers.Wallet.createRandom();
      const uid = consumeId(); // 5
      const { v, r, s } = await signEnroll(
        ownerWallet, domain,
        freshWallet.address, SK1, SK2, "grader", uid
      );

      await assertReverts(
        () => gov.becomeHod(freshWallet.address, SK1, SK2, "grader", uid, v, r, s),
        "HSOA"
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 3. becomeMentor
  // ══════════════════════════════════════════════════════════════════════════
  describe("becomeMentor", () => {
    const SK1 = "mentor_sk1";
    const SK2 = "mentor_sk2";

    it("happy path: HOD-signed enrolment makes address a mentor", async () => {
      const uid = consumeId(); // 6
      // Mentor must be signed by the HOD
      const { v, r, s } = await signEnroll(
        hodWallet, domain,
        mentorWallet.address, SK1, SK2, "mentor", uid
      );

      await gov.becomeMentor(
        mentorWallet.address, hodWallet.address,
        SK1, SK2, "mentor", uid, v, r, s
      );

      const isMentor = await gov.isMentor(mentorWallet.address);
      assert.isTrue(isMentor, "isMentor should be true after successful enrolment");
    });

    it("reverts 'SNH' if the supplied signer address is not a registered HOD", async () => {
      const freshMentor = ethers.Wallet.createRandom();
      const uid = consumeId(); // 7
      // Sign with a random wallet that is NOT a HOD
      const fakeHod = ethers.Wallet.createRandom();
      const { v, r, s } = await signEnroll(
        fakeHod, domain,
        freshMentor.address, SK1, SK2, "mentor", uid
      );

      await assertReverts(
        () => gov.becomeMentor(
          freshMentor.address, fakeHod.address,
          SK1, SK2, "mentor", uid, v, r, s
        ),
        "SNH"
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 4. becomeStudent
  // ══════════════════════════════════════════════════════════════════════════
  describe("becomeStudent", () => {
    const SK1 = "student_sk1";
    const SK2 = "student_sk2";

    it("happy path: mentor-signed enrolment makes address a student", async () => {
      const uid = consumeId(); // 8
      const { v, r, s } = await signEnroll(
        mentorWallet, domain,
        studentWallet.address, SK1, SK2, "student", uid
      );

      await gov.becomeStudent(
        studentWallet.address, mentorWallet.address,
        SK1, SK2, "student", uid, v, r, s
      );

      const isStudent = await gov.isStudent(studentWallet.address);
      assert.isTrue(isStudent, "isStudent should be true after successful enrolment");
    });

    it("reverts 'SNM' if the supplied signer address is not a registered mentor", async () => {
      const freshStudent = ethers.Wallet.createRandom();
      const uid = consumeId(); // 9
      const fakeMentor = ethers.Wallet.createRandom();
      const { v, r, s } = await signEnroll(
        fakeMentor, domain,
        freshStudent.address, SK1, SK2, "student", uid
      );

      await assertReverts(
        () => gov.becomeStudent(
          freshStudent.address, fakeMentor.address,
          SK1, SK2, "student", uid, v, r, s
        ),
        "SNM"
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 5. mintCert — semester mark-sheets and degree certificate
  // ══════════════════════════════════════════════════════════════════════════
  describe("mintCert", () => {
    // Semester CIDs and receipt numbers used in order
    const cids      = [MOCK_CID, MOCK_CID_2, MOCK_CID_3, MOCK_CID_4];
    const receipts  = ["REC-001", "REC-002", "REC-003", "REC-004"];

    it("mints sem-1 mark-sheet; degree cert is not issued yet", async () => {
      const semNum     = 1;
      const cid        = cids[0];
      const receipt    = receipts[0];
      const degreeCid  = ""; // empty for non-final semesters

      const mentorSig  = await signMintMarksheet(
        mentorWallet, domain, semNum, receipt,
        studentWallet.address, cid, degreeCid
      );
      const relayerSig = await signRelayer(relayerWallet, cid);

      await gov.mintCert(
        studentWallet.address,
        mentorWallet.address,
        semNum,
        receipt,
        mentorSig,
        cid,
        relayerSig,
        degreeCid
      );

      // Mark-sheet stored
      const stored = await gov.getSemMarkSheet(studentWallet.address, semNum);
      assert.equal(stored, cid, "Sem-1 CID should match what was minted");
    });

    it("getSemMarkSheet returns the correct CID for sem 1", async () => {
      const stored = await gov.getSemMarkSheet(studentWallet.address, 1);
      assert.equal(stored, MOCK_CID, "getSemMarkSheet(stud, 1) should return MOCK_CID");
    });

    it("getDegree returns an empty string before the final semester", async () => {
      const degree = await gov.getDegree(studentWallet.address);
      assert.equal(degree, "", "Degree CID should be empty before final sem");
    });

    it("reverts 'YAM' if the same receiptNo is used a second time", async () => {
      const cid        = cids[0];
      const mentorSig  = await signMintMarksheet(
        mentorWallet, domain, 1, receipts[0],
        studentWallet.address, cid, ""
      );
      const relayerSig = await signRelayer(relayerWallet, cid);

      await assertReverts(
        () => gov.mintCert(
          studentWallet.address, mentorWallet.address,
          1, receipts[0], mentorSig, cid, relayerSig, ""
        ),
        "YAM"
      );
    });

    it("mints semesters 2 and 3 successfully", async () => {
      for (const semNum of [2, 3]) {
        const cid        = cids[semNum - 1];
        const receipt    = receipts[semNum - 1];
        const mentorSig  = await signMintMarksheet(
          mentorWallet, domain, semNum, receipt,
          studentWallet.address, cid, ""
        );
        const relayerSig = await signRelayer(relayerWallet, cid);

        await gov.mintCert(
          studentWallet.address, mentorWallet.address,
          semNum, receipt, mentorSig, cid, relayerSig, ""
        );

        const stored = await gov.getSemMarkSheet(studentWallet.address, semNum);
        assert.equal(stored, cid, `Sem-${semNum} CID should be stored`);
      }
    });

    it("mints the final semester (sem 4) and auto-mints the degree certificate", async () => {
      const semNum     = TOTAL_EXAMS; // 4
      const cid        = cids[semNum - 1];
      const receipt    = receipts[semNum - 1];
      const degreeCid  = MOCK_DEGREE_CID;

      const mentorSig  = await signMintMarksheet(
        mentorWallet, domain, semNum, receipt,
        studentWallet.address, cid, degreeCid
      );
      const relayerSig = await signRelayer(relayerWallet, cid);

      await gov.mintCert(
        studentWallet.address, mentorWallet.address,
        semNum, receipt, mentorSig, cid, relayerSig, degreeCid
      );

      // Sem-4 mark-sheet
      const semStored = await gov.getSemMarkSheet(studentWallet.address, semNum);
      assert.equal(semStored, cid, "Sem-4 CID should be stored");
    });

    it("getDegree returns the degree CID after the final semester is minted", async () => {
      const degree = await gov.getDegree(studentWallet.address);
      assert.equal(
        degree,
        MOCK_DEGREE_CID,
        "Degree CID should equal MOCK_DEGREE_CID after final semester"
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 6. editSemMarkSheet
  // ══════════════════════════════════════════════════════════════════════════
  describe("editSemMarkSheet", () => {

    it("happy path: mentor can update the sem-1 mark-sheet CID", async () => {
      const semNum  = 1;
      const uid     = consumeId(); // 10
      const newCid  = UPDATED_SEM_CID;

      const sig = await signUpdate(
        mentorWallet, domain,
        studentWallet.address, newCid, uid, semNum
      );

      await gov.editSemMarkSheet(
        studentWallet.address, mentorWallet.address,
        newCid, semNum, sig, uid
      );

      const stored = await gov.getSemMarkSheet(studentWallet.address, semNum);
      assert.equal(stored, newCid, "Sem-1 CID should be updated to UPDATED_SEM_CID");
    });

    it("reverts 'NEIOUM' if the uniqueId has already been used (replay protection)", async () => {
      // Attempt to reuse the same uid as the edit above
      const usedUid = nextId - 1; // last consumed uid
      const sig = await signUpdate(
        mentorWallet, domain,
        studentWallet.address, UPDATED_SEM_CID, usedUid, 1
      );

      await assertReverts(
        () => gov.editSemMarkSheet(
          studentWallet.address, mentorWallet.address,
          UPDATED_SEM_CID, 1, sig, usedUid
        ),
        "NEIOUM"
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 7. editDegreeCert
  // ══════════════════════════════════════════════════════════════════════════
  describe("editDegreeCert", () => {

    it("happy path: owner can update the degree certificate CID", async () => {
      const uid    = consumeId(); // 11
      const newCid = UPDATED_DEG_CID;

      // editDegreeCert uses hashUpd with semNo = totalEndExamination
      const sig = await signUpdate(
        ownerWallet, domain,
        studentWallet.address, newCid, uid, TOTAL_EXAMS
      );

      await gov.editDegreeCert(
        studentWallet.address, newCid, uid, sig
      );

      const stored = await gov.getDegree(studentWallet.address);
      assert.equal(stored, newCid, "Degree CID should be updated to UPDATED_DEG_CID");
    });

    it("reverts 'NEIOUD' for a student who has not completed all semesters", async () => {
      // Enrol a brand-new student who has never had a cert minted
      const freshStudentWallet = ethers.Wallet.createRandom();
      const SK1 = "fs_sk1";
      const SK2 = "fs_sk2";
      const uid = consumeId(); // 12

      const { v, r, s } = await signEnroll(
        mentorWallet, domain,
        freshStudentWallet.address, SK1, SK2, "student", uid
      );
      await gov.becomeStudent(
        freshStudentWallet.address, mentorWallet.address,
        SK1, SK2, "student", uid, v, r, s
      );

      // Try to edit degree before any certs are minted
      const editUid = consumeId(); // 13
      const sig = await signUpdate(
        ownerWallet, domain,
        freshStudentWallet.address, UPDATED_DEG_CID, editUid, TOTAL_EXAMS
      );

      await assertReverts(
        () => gov.editDegreeCert(
          freshStudentWallet.address, UPDATED_DEG_CID, editUid, sig
        ),
        "NEIOUD"
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 8. burnDegreeCert
  // ══════════════════════════════════════════════════════════════════════════
  describe("burnDegreeCert", () => {

    it("happy path: degree certificate can be burned; getDegree returns empty", async () => {
      await gov.burnDegreeCert(studentWallet.address);

      // After burn, degreeCert.status = false and ipfsCID = ""
      const degree = await gov.getDegree(studentWallet.address);
      assert.equal(degree, "", "Degree CID should be empty string after burn");

      const certData = await gov.degreeCert(studentWallet.address);
      assert.isFalse(certData.status, "degreeCert.status should be false after burn");
    });

    it("reverts 'NDB' if burnDegreeCert is called a second time (already burned)", async () => {
      await assertReverts(
        () => gov.burnDegreeCert(studentWallet.address),
        "NDB"
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 9. Elig modifier edge cases
  // ══════════════════════════════════════════════════════════════════════════
  describe("Elig modifier edge cases", () => {

    it("reverts 'YAG' when a registered grader tries to enrol as student", async () => {
      // graderWallet is already enrolled as a grader
      const uid = consumeId(); // 14
      const { v, r, s } = await signEnroll(
        mentorWallet, domain,
        graderWallet.address, "sk1", "sk2", "student", uid
      );

      await assertReverts(
        () => gov.becomeStudent(
          graderWallet.address, mentorWallet.address,
          "sk1", "sk2", "student", uid, v, r, s
        ),
        "YAG"
      );
    });

    it("reverts 'OCM' when the owner tries to enrol themselves as HOD", async () => {
      const uid = consumeId(); // 15
      const { v, r, s } = await signEnroll(
        ownerWallet, domain,
        ownerWallet.address, "sk1", "sk2", "hod", uid
      );

      await assertReverts(
        () => gov.becomeHod(
          ownerWallet.address, "sk1", "sk2", "hod", uid, v, r, s
        ),
        "OCM"
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 10. isVerifyByrelayer
  // ══════════════════════════════════════════════════════════════════════════
  describe("isVerifyByrelayer", () => {

    it("returns true when the CID is signed by the registered relayer", async () => {
      const cid = MOCK_CID; // 59 chars
      const sig = await signRelayer(relayerWallet, cid);

      const result = await gov.isVerifyByrelayer(cid, sig);
      assert.isTrue(result, "isVerifyByrelayer should return true for valid relayer sig");
    });

    it("reverts 'INVALID_RELAYER_SIGNER' when the signature comes from a non-relayer", async () => {
      const cid = MOCK_CID;
      // Sign with a random wallet — not the registered relayer
      const impostor = ethers.Wallet.createRandom();
      const sig = await signRelayer(impostor, cid);

      await assertReverts(
        () => gov.isVerifyByrelayer(cid, sig),
        "INVALID_RELAYER_SIGNER"
      );
    });
  });
});
