import { RESONANT_DOWSING_COURSE_SLUG } from "./courseEntitlementService.js";

export const RESONANT_DOWSING_PRICE_CENTS = 9900;
export const RESONANT_DOWSING_CURRENCY = "CAD";
export const RESONANT_DOWSING_PRICE_LABEL = "$99 CAD";
export const RESONANT_DOWSING_THUMBNAIL_URL = "/images/courses/resonant-dowsing-course.png";

export const RESONANT_DOWSING_PUBLIC_DESCRIPTION = [
  "The Resonant Dowsing Course is an online teaching series instructed by its founder, Brad Johnson. Through the Resonant Dowsing Course, you will learn practices involving both neutral and universal pendulums.",
  "The course explores energetic polarities, personal energy-testing practices, food compatibility exercises, space clearing, harmonizing geopathic stress lines, detecting vibrational bands, working with colour bands, pendulum-based intuitive exercises, locating missing objects, and more.",
] as const;

export const RESONANT_DOWSING_DISCLAIMER =
  "This course is for educational and personal-spiritual exploration. It is not medical, nutritional, psychological, legal, or diagnostic advice and should not replace qualified professional care.";

type CourseDescription = string | string[];

interface SourceLesson {
  id: string;
  title: string;
  youtubeUrl: string;
}

interface SourceResource {
  id: string;
  title: string;
  url: string;
}

interface SourceModule {
  id: string;
  order: number;
  title: string;
  description: CourseDescription;
  lessons: SourceLesson[];
  resources: SourceResource[];
}

export interface ResonantDowsingLesson {
  id: string;
  sequence: number;
  moduleId: string;
  moduleTitle: string;
  title: string;
  youtubeEmbedUrl: string;
  description: string[];
  resources: ResonantDowsingResource[];
}

export interface ResonantDowsingResource {
  id: string;
  title: string;
  url: string;
}

export interface ResonantDowsingModule {
  id: string;
  order: number;
  title: string;
  description: string[];
  lessons: ResonantDowsingLesson[];
  resources: ResonantDowsingResource[];
}

export interface ResonantDowsingLessonSummary {
  id: string;
  sequence: number;
  moduleId: string;
  moduleTitle: string;
  title: string;
  status: "locked" | "unlocked" | "completed";
}

function toDescriptionList(description: CourseDescription) {
  return Array.isArray(description) ? description : [description];
}

function toYouTubeNoCookieEmbedUrl(youtubeUrl: string) {
  const parsed = new URL(youtubeUrl);
  const videoId = parsed.hostname === "youtu.be"
    ? parsed.pathname.replace(/^\//, "")
    : parsed.searchParams.get("v");
  if (!videoId) {
    throw new Error(`Invalid Resonant Dowsing YouTube URL: ${youtubeUrl}`);
  }
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}

const sourceModules: readonly SourceModule[] = [
  {
    id: "preparation",
    order: 0,
    title: "Preparation Module",
    description: [
      "HRV Breathwork",
      "Working with the Neutral Pendulum to Calibrate Wavelength",
      "Feeling the Calibrated Wavelength",
      "The Pendulum's String Acts as a Sine Wave",
      "Using both hands with the Neutral Pendulum",
      "Becoming Familiar with Aligned Wavelength",
    ],
    lessons: [
      { id: "preparation-module", title: "Preparation Module", youtubeUrl: "https://youtu.be/RQr-zZgZyng" },
      { id: "calibrating-your-pendulum", title: "Calibrating Your Pendulum", youtubeUrl: "https://youtu.be/GXH60OEVQoM" },
    ],
    resources: [
      {
        id: "preparation-pendulum-links",
        title: "Preparation Module Pendulum Links",
        url: "https://drive.google.com/file/d/1gKQumg7erY3jtRydoef-QHaDlXZBKGt8/view?usp=sharing",
      },
    ],
  },
  {
    id: "module-1",
    order: 1,
    title: "Module 1",
    description:
      "Module 1 introduces you to the concept of Resonant Dowsing and the pendulums used to work with readings. It will also teach you about proper dowsing alignment and work through several exercises to help fine-tune your capability to discover answers through its usage.",
    lessons: [{ id: "module-1-video", title: "Module 1", youtubeUrl: "https://youtu.be/2aH368GdigE" }],
    resources: [],
  },
  {
    id: "module-2",
    order: 2,
    title: "Module 2",
    description: [
      "Understanding the Source Center Vibration & Universal Pendulum",
      "Resonant Dowsing Color Wheel",
      "Definitions of Vibrational Colors",
      "Testing Color Vibrations in Objects",
      "Student Q&A",
    ],
    lessons: [{ id: "module-2-video", title: "Module 2", youtubeUrl: "https://youtu.be/lejRMWB1av8" }],
    resources: [
      {
        id: "color-vibrational-dowsing-wheel",
        title: "Color Vibrational Dowsing Wheel",
        url: "https://drive.google.com/file/d/1G-TEk4uPzjL7hkZTcmL9JhOa2BCc3udZ/view?usp=sharing",
      },
      {
        id: "vibrational-band-benefits-worksheet",
        title: "Vibrational Band Benefits Worksheet",
        url: "https://drive.google.com/file/d/1f_NXDiA3-5JRs6bd_LwZdpby6ZTElTwc/view?usp=sharing",
      },
    ],
  },
  {
    id: "module-3",
    order: 3,
    title: "Module 3",
    description: [
      "Imbuing Source Center Vibration into Objects via Pendulum",
      "Imbuing Vibrational Colors into Objects via Pendulum",
      "Detecting Vibrations Within Imbued Objects via Pendulum and Color Wheel",
      "Feeling Subtle Energies Within Imbued Objects",
      "Amplifying and Reverse Amplifying Vibrational Intensity in Objects via Pendulum",
      "Scanning Your Environment with the Pendulum",
      "Detecting Subtle Debris within Your Environment and Clearing the Space",
      "Student Q&A",
    ],
    lessons: [{ id: "module-3-video", title: "Module 3", youtubeUrl: "https://youtu.be/mTuZA82SdOA" }],
    resources: [],
  },
  {
    id: "module-4",
    order: 4,
    title: "Module 4",
    description:
      "In this module we will explore the science of Geopathic Stress Lines, their effect on the environment, how to detect them, and how to balance the stress lines so they can be successfully transmuted into Ley Lines.",
    lessons: [{ id: "module-4-video", title: "Module 4", youtubeUrl: "https://youtu.be/WYYc6N0AnGk" }],
    resources: [
      {
        id: "geopathic-stress-line-clearing-video",
        title: "Geopathic Stress Line Clearing Video",
        url: "https://drive.google.com/file/d/1rh2jWlFx4lqUgp_mPVbELxEZCKIpvNg9/view?usp=sharing",
      },
    ],
  },
  {
    id: "module-5",
    order: 5,
    title: "Module 5",
    description:
      "In Module 5, you will learn how to detect Curry Geopathic Stress Lines, clear them, amplify them, and contain all Geopathic Stress Lines to surround your home with their vibrational energy.",
    lessons: [{ id: "module-5-video", title: "Module 5", youtubeUrl: "https://youtu.be/THRGZaJ_Ay4" }],
    resources: [],
  },
  {
    id: "module-6",
    order: 6,
    title: "Module 6",
    description:
      "In this module, we will work on discovering how to connect with and harness Planetary Vibrational Energy, adding it to Ley Line work and the 5-Coin Linking Exercise.",
    lessons: [{ id: "module-6-video", title: "Module 6", youtubeUrl: "https://youtu.be/VdAv4Tsc-Fk" }],
    resources: [
      {
        id: "planet-vibrational-frequencies-chart",
        title: "Planet Vibrational Frequencies Chart",
        url: "https://drive.google.com/file/d/1mCVByaJWTKBGbpdU0UUwSkdGZPQxPRLM/view?usp=sharing",
      },
    ],
  },
  {
    id: "module-7",
    order: 7,
    title: "Module 7",
    description:
      "In Module 7, we will explore genuine organ frequencies and ways of incorporating those concepts into Resonant Dowsing healing modalities. You will also explore vibratory alignments within a person's face and intuitive perception exercises.",
    lessons: [{ id: "module-7-video", title: "Module 7", youtubeUrl: "https://youtu.be/pHTWICsQGzM" }],
    resources: [
      {
        id: "organs-for-resonant-dowsing",
        title: "Organs for Resonant Dowsing",
        url: "https://drive.google.com/file/d/1NJvj-QcbbFANvy0IsNjs153VnyUGDz_6/view?usp=sharing",
      },
    ],
  },
  {
    id: "module-8",
    order: 8,
    title: "Module 8",
    description:
      "In this module, we will use the Resonant Dowsing Scale chart with sample foods and organ-focused exercises. We will also explore simple Source Vibrational and Dowsing Commands for food and personal energetic practices.",
    lessons: [{ id: "module-8-video", title: "Module 8", youtubeUrl: "https://youtu.be/9SE8N4N2Veo" }],
    resources: [
      {
        id: "resonant-dowsing-percentage-chart",
        title: "Resonant Dowsing Percentage Chart",
        url: "https://drive.google.com/file/d/1T3cPoKNQ0bd_vrtLT0AQ2HwZy0QKBJYv/view?usp=drive_link",
      },
    ],
  },
  {
    id: "module-9",
    order: 9,
    title: "Module 9",
    description:
      "In Module 9, we will use a Pendulum Disc to help interface with and retrieve information through the Intuitive Intelligence Impulse and the subconscious, or Akashic, field.",
    lessons: [{ id: "module-9-video", title: "Module 9", youtubeUrl: "https://youtu.be/M-vJVarbrqg" }],
    resources: [
      {
        id: "pendulum-wheel",
        title: "Pendulum Wheel",
        url: "https://drive.google.com/file/d/19Es6FO5K_3VNfngkG5zvs4L5pWLMPqhB/view?usp=sharing",
      },
    ],
  },
  {
    id: "module-10",
    order: 10,
    title: "Module 10",
    description:
      "In this module, we will work further with the Pendulum Dowsing Wheel. Brad Johnson will act as the client for question-based exercises, followed by a sample map exercise and discussion of locating objects and people through Resonant Dowsing.",
    lessons: [{ id: "module-10-video", title: "Module 10", youtubeUrl: "https://youtu.be/o_QzsRXXpNY" }],
    // TODO: Replace Brad's Home Map with an anonymized training version before exposing it.
    resources: [],
  },
  {
    id: "module-11",
    order: 11,
    title: "Module 11",
    description:
      "In Module 11, we will explore how to find people or objects using grid mapping and work with exercises for detoxifying and purifying water samples.",
    lessons: [{ id: "module-11-video", title: "Module 11", youtubeUrl: "https://youtu.be/GB4D7oxXEdM" }],
    resources: [],
  },
  {
    id: "module-12",
    order: 12,
    title: "Module 12",
    description:
      "The final conclusion module reviewing all previous modules within The Resonant Dowsing Course.",
    lessons: [{ id: "module-12-video", title: "Module 12", youtubeUrl: "https://youtu.be/nBwycpKyvIU" }],
    resources: [],
  },
] as const;

export const resonantDowsingModules = sourceModules.map((module): ResonantDowsingModule => ({
  id: module.id,
  order: module.order,
  title: module.title,
  description: toDescriptionList(module.description),
  lessons: module.lessons.map((lesson) => ({
    id: lesson.id,
    sequence: 0,
    moduleId: module.id,
    moduleTitle: module.title,
    title: lesson.title,
    youtubeEmbedUrl: toYouTubeNoCookieEmbedUrl(lesson.youtubeUrl),
    description: toDescriptionList(module.description),
    resources: module.resources,
  })),
  resources: module.resources,
}));

export const resonantDowsingLessonSequence = resonantDowsingModules
  .flatMap((module) => module.lessons)
  .map((lesson, index): ResonantDowsingLesson => ({
    ...lesson,
    sequence: index + 1,
  }));

export const RESONANT_DOWSING_TOTAL_LESSONS = resonantDowsingLessonSequence.length;
export const RESONANT_DOWSING_MODULE_COUNT = resonantDowsingModules.length;

export function getResonantDowsingLessonById(lessonId: string) {
  return resonantDowsingLessonSequence.find((lesson) => lesson.id === lessonId) ?? null;
}

export function getCurrentUnlockedLessonId(completedLessonIds: Set<string>) {
  return resonantDowsingLessonSequence.find((lesson) => !completedLessonIds.has(lesson.id))?.id ?? null;
}

export function getNextLessonId(lessonId: string) {
  const index = resonantDowsingLessonSequence.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return null;
  return resonantDowsingLessonSequence[index + 1]?.id ?? null;
}

export function getResonantDowsingLessonSummaries(input: {
  completedLessonIds: Set<string>;
  unlockedLessonId: string | null;
  admin?: boolean;
}): ResonantDowsingLessonSummary[] {
  return resonantDowsingLessonSequence.map((lesson) => {
    const completed = input.completedLessonIds.has(lesson.id);
    const unlocked = input.admin || completed || lesson.id === input.unlockedLessonId;
    return {
      id: lesson.id,
      sequence: lesson.sequence,
      moduleId: lesson.moduleId,
      moduleTitle: lesson.moduleTitle,
      title: lesson.title,
      status: completed ? "completed" : unlocked ? "unlocked" : "locked",
    };
  });
}

export function getResonantDowsingPublicCourse() {
  return {
    slug: RESONANT_DOWSING_COURSE_SLUG,
    title: "The Resonant Dowsing Course",
    description: [...RESONANT_DOWSING_PUBLIC_DESCRIPTION],
    price: {
      label: RESONANT_DOWSING_PRICE_LABEL,
      currency: RESONANT_DOWSING_CURRENCY,
      amountCents: RESONANT_DOWSING_PRICE_CENTS,
    },
    thumbnailUrl: RESONANT_DOWSING_THUMBNAIL_URL,
    access: "lifetime" as const,
    disclaimer: RESONANT_DOWSING_DISCLAIMER,
  };
}

export function getResonantDowsingCourseContent() {
  return {
    ...getResonantDowsingPublicCourse(),
    moduleCount: RESONANT_DOWSING_MODULE_COUNT,
    totalLessons: RESONANT_DOWSING_TOTAL_LESSONS,
    modules: resonantDowsingModules,
  };
}
