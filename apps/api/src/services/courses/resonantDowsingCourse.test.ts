import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getResonantDowsingCourseContent,
  getResonantDowsingPublicCourse,
  getResonantDowsingLessonSummaries,
  resonantDowsingLessonSequence,
} from "./resonantDowsingCourse.js";

describe("resonantDowsingCourse", () => {
  it("keeps public metadata free of private curriculum details", () => {
    const course = getResonantDowsingPublicCourse();
    assert.equal(course.slug, "resonant-dowsing");
    assert.equal(course.price.amountCents, 9900);
    assert.equal(course.thumbnailUrl, "/images/courses/resonant-dowsing-course.png");
    assert.ok(!("modules" in course));
    assert.ok(!("moduleCount" in course));
  });

  it("returns protected curriculum with privacy-enhanced YouTube embeds", () => {
    const course = getResonantDowsingCourseContent();
    assert.equal(course.moduleCount, 13);
    assert.equal(course.totalLessons, 14);
    assert.equal(resonantDowsingLessonSequence.length, 14);
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
    assert.ok(!("unresolvedTodos" in course));
  });

  it("returns locked summaries without private video or resource fields", () => {
    const summaries = getResonantDowsingLessonSummaries({
      completedLessonIds: new Set(),
      unlockedLessonId: resonantDowsingLessonSequence[0].id,
    });
    assert.equal(summaries.length, 14);
    assert.equal(summaries[0].status, "unlocked");
    assert.equal(summaries[1].status, "locked");
    assert.ok(!("youtubeEmbedUrl" in summaries[1]));
    assert.ok(!("resources" in summaries[1]));
    assert.ok(!("description" in summaries[1]));
  });
});
