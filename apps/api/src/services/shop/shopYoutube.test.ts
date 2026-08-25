import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toYouTubeEmbedUrl } from "./shopYoutube.js";

describe("toYouTubeEmbedUrl", () => {
  it("converts a live URL into a nocookie embed", () => {
    assert.equal(
      toYouTubeEmbedUrl("https://www.youtube.com/live/3Kd2zR1_FnA?si=RJTwyNaE6z9HKZXu"),
      "https://www.youtube-nocookie.com/embed/3Kd2zR1_FnA?rel=0&modestbranding=1",
    );
    assert.equal(
      toYouTubeEmbedUrl("https://www.youtube.com/live/bMsyTvQSzDU?si=O5gTLTzb-jYu5xLu"),
      "https://www.youtube-nocookie.com/embed/bMsyTvQSzDU?rel=0&modestbranding=1",
    );
    assert.equal(
      toYouTubeEmbedUrl("https://www.youtube.com/live/_DniHEzLgps?si=sbmKrhUkhTPL2vhH"),
      "https://www.youtube-nocookie.com/embed/_DniHEzLgps?rel=0&modestbranding=1",
    );
  });

  it("returns null for missing or invalid URLs", () => {
    assert.equal(toYouTubeEmbedUrl(""), null);
    assert.equal(toYouTubeEmbedUrl("not-a-url"), null);
  });
});
