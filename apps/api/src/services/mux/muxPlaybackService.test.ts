import assert from "node:assert/strict";
import test from "node:test";
import { ADRONIS_ON_DEMAND_PLAYBACK_ID, ADRONIS_ON_DEMAND_WEBINAR_ID } from "@wisdom/utils";
import { isPlaybackProtected, reconcileOnDemandMuxReadiness, type MuxClient } from "./muxPlaybackService.js";

test("playback is protected only when every Playback ID on the asset is signed", () => {
  assert.equal(isPlaybackProtected([]), false);
  assert.equal(isPlaybackProtected([{ id: "pub", policy: "public" }]), false);
  assert.equal(isPlaybackProtected([
    { id: ADRONIS_ON_DEMAND_PLAYBACK_ID, policy: "signed" },
    { id: "still-public", policy: "public" },
  ]), false);
  assert.equal(isPlaybackProtected([
    { id: ADRONIS_ON_DEMAND_PLAYBACK_ID, policy: "signed" },
    { id: "other-signed", policy: "signed" },
  ]), true);
});

test("Mux readiness reconcile uses the resolved asset, not a guessed Asset ID", async () => {
  const client: MuxClient = {
    async getPlaybackId(playbackId) {
      assert.equal(playbackId, ADRONIS_ON_DEMAND_PLAYBACK_ID);
      return { id: playbackId, policy: "signed", object: { type: "video", id: "asset_from_lookup" } };
    },
    async getAsset(assetId) {
      assert.equal(assetId, "asset_from_lookup");
      return {
        id: assetId,
        status: "ready",
        playback_ids: [{ id: ADRONIS_ON_DEMAND_PLAYBACK_ID, policy: "signed" }],
      };
    },
  };

  const readiness = await reconcileOnDemandMuxReadiness(ADRONIS_ON_DEMAND_WEBINAR_ID, client);
  assert.equal(readiness.muxAssetId, "asset_from_lookup");
  assert.equal(readiness.assetReady, true);
  assert.equal(readiness.playbackProtected, true);
});
