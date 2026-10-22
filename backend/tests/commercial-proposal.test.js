import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidCommunicationMode,
  parseAcceptedProposalSnapshot,
  serializeAcceptedProposalSnapshot
} from "../commercial-proposal.js";

test("communication mode only accepts supported codes or an undefined value", () => {
  assert.equal(isValidCommunicationMode("rfa_managed"), true);
  assert.equal(isValidCommunicationMode("client_sends"), true);
  assert.equal(isValidCommunicationMode(null), true);
  assert.equal(isValidCommunicationMode("other"), false);
});

test("accepted proposal snapshot keeps the accepted communication mode immutable", () => {
  const proposalAtAcceptance = {
    service_code: "gestion_rfa",
    quoted_amount: 65000,
    quoted_currency: "ARS",
    quoted_scope: "Preparacion y seguimiento administrativo",
    communication_mode: "client_sends"
  };
  const stored = serializeAcceptedProposalSnapshot(proposalAtAcceptance);
  proposalAtAcceptance.communication_mode = "rfa_managed";

  assert.deepEqual(parseAcceptedProposalSnapshot(stored), {
    service_code: "gestion_rfa",
    amount: 65000,
    currency: "ARS",
    scope: "Preparacion y seguimiento administrativo",
    communication_mode: "client_sends"
  });
});

test("legacy accepted proposals without a snapshot remain detectable as unsnapshotted", () => {
  assert.equal(parseAcceptedProposalSnapshot(null), null);
  assert.equal(parseAcceptedProposalSnapshot("not-json"), null);
});
