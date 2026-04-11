export type MentorTrainingPackageType = "entry" | "seeker" | "initiate";

export interface MentorTrainingPackageDefinition {
  type: MentorTrainingPackageType;
  title: string;
  priceCad: number;
  priceLabel: string;
  durationLabel: string;
  goalsLabel: string;
  includes: string[];
}

export const MENTOR_TRAINING_PACKAGES: Record<MentorTrainingPackageType, MentorTrainingPackageDefinition> = {
  entry: {
    type: "entry",
    title: "Entry Package",
    priceCad: 2999,
    priceLabel: "$2,999 CAD",
    durationLabel: "10 Day Integration - 10 days over 14-day period",
    goalsLabel: "Single goal focus",
    includes: [
      "Divin8 blueprint foundation",
      "Beta-mind clearing",
      "Regeneration alignment",
      "Prime mind stabilization",
    ],
  },
  seeker: {
    type: "seeker",
    title: "Seeker Package",
    priceCad: 5499,
    priceLabel: "$5,499 CAD",
    durationLabel: "20 Day Integration - 20 days over 30-day period",
    goalsLabel: "Up to 2 goals",
    includes: [
      "Blueprint expansion",
      "Family + ancestral work",
      "Deep regeneration",
      "Relationship recalibration",
    ],
  },
  initiate: {
    type: "initiate",
    title: "Initiate Package",
    priceCad: 10999,
    priceLabel: "$10,999 CAD",
    durationLabel: "40 Day Integration - 40 days over 60-day period",
    goalsLabel: "Up to 4 goals",
    includes: [
      "Full blueprint integration",
      "Identity rewiring",
      "Consciousness-level training",
      "Prime state embodiment",
    ],
  },
};

export const MENTOR_TRAINING_PACKAGE_LIST = [
  MENTOR_TRAINING_PACKAGES.entry,
  MENTOR_TRAINING_PACKAGES.seeker,
  MENTOR_TRAINING_PACKAGES.initiate,
] as const;
