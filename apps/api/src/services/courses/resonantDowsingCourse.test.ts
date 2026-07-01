import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getResonantDowsingCourseContent,
  getResonantDowsingPublicCourse,
} from "./resonantDowsingCourse.js";

describe("resonantDowsingCourse", () => {
  it("keeps public metadata free of private curriculum details", () => {
    const course = getResonantDowsingPublicCourse();
    assert.equal(course.slug, "resonant-dowsing");
    assert.equal(course.price.amountCents, 9900);
    assert.ok(!("modules" in course));
    assert.ok(!("moduleCount" in course));
  });

  it("returns protected curriculum with privacy-enhanced YouTube embeds", () => {
    const course = getResonantDowsingCourseContent();
    assert.equal(course.moduleCount, 13);
    assert.ok(course.modules.length > 0);
    for (const module of course.modules) {
      for (const lesson of module.lessons) {
        assert.match(lesson.youtubeEmbedUrl, /^https:\/\/www\.youtube-nocookie\.com\/embed\//);
      }
    }
  });

  it("does not expose the Module 10 home map resource pending safety review", () => {
    const course = getResonantDowsingCourseContent();
    const module10 = course.modules.find((module) => module.id === "module-10");
    assert.ok(module10);
    assert.equal(module10.resources.length, 0);
    assert.ok(course.unresolvedTodos.some((todo) => todo.includes("Module 10 Brad's Home Map")));
  });
});
