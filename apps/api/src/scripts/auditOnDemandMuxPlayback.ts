import { ADRONIS_ON_DEMAND_WEBINAR_ID, getOnDemandWebinarById } from "@wisdom/utils";
import { createMuxClient, reconcileOnDemandMuxReadiness } from "../services/mux/muxPlaybackService.js";

async function main() {
  const webinar = getOnDemandWebinarById(ADRONIS_ON_DEMAND_WEBINAR_ID);
  if (!webinar) {
    throw new Error("On-demand webinar catalog entry is missing.");
  }
  const client = createMuxClient();
  if (!client) {
    throw new Error("MUX_TOKEN_ID and MUX_TOKEN_SECRET must belong to the RAYD8 Mux environment.");
  }
  const readiness = await reconcileOnDemandMuxReadiness(webinar.webinarId, client);
  const publicIds = readiness.playbackIds.filter((entry) => entry.policy !== "signed");
  console.log(JSON.stringify({
    webinarId: webinar.webinarId,
    playbackId: webinar.playbackId,
    muxAssetId: readiness.muxAssetId,
    assetReady: readiness.assetReady,
    playbackProtected: readiness.playbackProtected,
    playbackIds: readiness.playbackIds,
    publicPlaybackIds: publicIds,
    salesAllowed: webinar.published && readiness.assetReady && readiness.playbackProtected,
  }, null, 2));
  if (publicIds.length > 0) {
    process.exitCode = 2;
  }
}

void main();
