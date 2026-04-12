export interface CourseCardDefinition {
  slug: string;
  title: string;
  statusLabel: string;
  description: string;
  ctaLabel: string;
  route: string;
  available: boolean;
  tooltip?: string;
  subtitle?: string;
}

export interface CourseLessonDefinition {
  day: number;
  title: string;
  videoUrl: string;
  description: string;
}

export interface CourseMaterialDefinition {
  title: string;
  href: string;
  relatedDay?: number;
}

export interface CourseProgressState {
  completedLessons: number[];
  lastViewedLesson: number;
}

export const TTT_PROGRESS_STORAGE_KEY = "wisdomtransmissions:courses:ttt-progress";

export const TTT_COURSE_SUMMARY =
  "Through this 10-day guided course, you will learn a proven technique designed to neutralize trauma and cultivate a deep sense of inner peace.";

export const COURSES: readonly CourseCardDefinition[] = [
  {
    slug: "ttt",
    title: "Trauma Transcendence Technique",
    statusLabel: "Available Now",
    description: TTT_COURSE_SUMMARY,
    ctaLabel: "Enter Course",
    route: "/dashboard/courses/ttt",
    available: true,
  },
  {
    slug: "prime-law",
    title: "The Prime Law",
    subtitle: "Introduction Phase — Available April 26",
    statusLabel: "Available April 26",
    description: "A deeper framework for living in alignment with universal law.",
    ctaLabel: "Available April 26",
    route: "/dashboard/courses/prime-law",
    available: false,
    tooltip: "Available April 26",
  },
] as const;

export const TTT_LESSONS: readonly CourseLessonDefinition[] = [
  {
    day: 1,
    title: "Day 1",
    videoUrl: "https://www.youtube.com/embed/_qFtwHnz020?rel=0&modestbranding=1",
    description: "Begin with the foundational pattern of the Trauma Transcendence Technique and learn how the 10-day journey is meant to calm the nervous system before deeper work begins.",
  },
  {
    day: 2,
    title: "Day 2",
    videoUrl: "https://www.youtube.com/embed/mQGCdaLSx6o?rel=0&modestbranding=1",
    description: "Refine your awareness of activation, learn how to notice tension earlier, and build the consistency that allows the technique to become dependable in real moments.",
  },
  {
    day: 3,
    title: "Day 3",
    videoUrl: "https://www.youtube.com/embed/J3qlxH2_u-o?rel=0&modestbranding=1",
    description: "Use the Emotional Situations Checklist to map the moments that most often destabilize you so the technique can be applied with greater precision and honesty.",
  },
  {
    day: 4,
    title: "Day 4",
    videoUrl: "https://www.youtube.com/embed/q_hI5snvIow?rel=0&modestbranding=1",
    description: "Move from observation into response, learning how to interrupt old reactions and create a cleaner internal space before they become repeated patterns.",
  },
  {
    day: 5,
    title: "Day 5",
    videoUrl: "https://www.youtube.com/embed/8BJ1-5_sSTM?rel=0&modestbranding=1",
    description: "Deepen the technique with repetition and pacing so the practice feels grounded, embodied, and easier to return to when life becomes emotionally charged.",
  },
  {
    day: 6,
    title: "Day 6",
    videoUrl: "https://www.youtube.com/embed/w_Lato5hOFE?rel=0&modestbranding=1",
    description: "Explore how the technique supports emotional regulation in relationships, helping you keep your center while remaining present to other people and your own needs.",
  },
  {
    day: 7,
    title: "Day 7",
    videoUrl: "https://www.youtube.com/embed/Cvw1gxLbb_Q?rel=0&modestbranding=1",
    description: "Apply the course framework to recurring stories and identity loops so you can stop feeding the emotional structures that keep old trauma responses in motion.",
  },
  {
    day: 8,
    title: "Day 8",
    videoUrl: "https://www.youtube.com/embed/9nvSxfpFTFA?rel=0&modestbranding=1",
    description: "Work with the Reactions & Desires Checklist to reveal the deeper emotional drivers behind your behavior and bring the technique to the root of the pattern.",
  },
  {
    day: 9,
    title: "Day 9",
    videoUrl: "https://www.youtube.com/embed/T_ryrwpljJY?rel=0&modestbranding=1",
    description: "Strengthen your ability to return to inner neutrality more quickly, using what you have learned to create stability, confidence, and a clearer felt sense of peace.",
  },
  {
    day: 10,
    title: "Day 10",
    videoUrl: "https://www.youtube.com/embed/mQxy6hUhZ60?rel=0&modestbranding=1",
    description: "Complete the integration cycle, review the full method, and use the Example Prep Entries to prepare a repeatable rhythm that keeps this work alive after the course ends.",
  },
] as const;

export const TTT_MATERIALS: readonly CourseMaterialDefinition[] = [
  {
    title: "Emotional Situations Checklist",
    href: "https://drive.google.com/file/d/1yNn6vBaLcx746AHjfUbQOqVJSNcy9rTe/view?usp=drive_link",
    relatedDay: 3,
  },
  {
    title: "Reactions & Desires Checklist",
    href: "https://drive.google.com/file/d/1WRIcM1cPsLBWzxqTE0FM5_XEsiBLqwlc/view?usp=drive_link",
    relatedDay: 8,
  },
  {
    title: "Example Prep Entries",
    href: "https://drive.google.com/file/d/1s4j6HtUjOV8oI2p4x_-0kLqjIR4TYrwK/view?usp=drive_link",
    relatedDay: 10,
  },
] as const;

export const TTT_TOTAL_LESSONS = TTT_LESSONS.length;

export function createInitialCourseProgress(): CourseProgressState {
  return {
    completedLessons: [],
    lastViewedLesson: 1,
  };
}
