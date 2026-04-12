import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessPhysiognomyImage,
  deletePhysiognomyImage,
  savePhysiognomyImage,
} from "./physiognomyImageStorage.js";

test("physiognomy images are scoped to the owning user", async (t) => {
  const { imageAssetId } = await savePhysiognomyImage(
    Buffer.from("test-image"),
    "image/png",
    { ownerUserId: "user-owner" },
  );

  t.after(async () => {
    await deletePhysiognomyImage(imageAssetId);
  });

  assert.equal(
    await canAccessPhysiognomyImage(imageAssetId, { userId: "user-owner", role: "client" }),
    true,
  );
  assert.equal(
    await canAccessPhysiognomyImage(imageAssetId, { userId: "user-other", role: "client" }),
    false,
  );
  assert.equal(
    await canAccessPhysiognomyImage(imageAssetId, { userId: "admin-user", role: "admin" }),
    true,
  );
});
