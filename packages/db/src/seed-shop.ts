import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq } from "drizzle-orm";
import { shopProductFiles, shopProductImages, shopProductTestimonials, shopProducts, shopSettings, shopTestimonials } from "./schema.js";
import { RECOVERED_CARD_TESTIMONIALS } from "./seed-shop-card-testimonials.js";

const repoRootForEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: path.join(repoRootForEnv, "apps/api/.env") });

const BODY_DECK_SLUG = "healing-code-cards-body-deck";
const BODY_DECK_DEFAULT_PRICE_ID = "price_1U6awqAd5V3LaCqjYPtzgvir";
const MIND_DECK_SLUG = "healing-code-cards-mind-deck";
const MIND_DECK_DEFAULT_PRICE_ID = "price_1U6br5Ad5V3LaCqj7AUstqit";
const ENERGY_DECK_SLUG = "healing-code-cards-energy-deck";
const ENERGY_DECK_DEFAULT_PRICE_ID = "price_1U85OFAd5V3LaCqjUt1e8CXA";
const SOURCE_DECK_SLUG = "healing-code-cards-source-deck-body-set";
const SOURCE_DECK_DEFAULT_PRICE_ID = "price_1U85gSAd5V3LaCqjVjszTGEo";
const SAFEGUARD_KIT_SLUG = "digital-safeguard-kit";
const SAFEGUARD_KIT_DEFAULT_PRICE_ID = "price_1U85usAd5V3LaCqjPtqyWS0a";
const SOURCE_BED_KIT_SLUG = "remote-source-bed-kit";
const SOURCE_BED_KIT_DEFAULT_PRICE_ID = "price_1U863FAd5V3LaCqjxdjoXqq5";
const DEFAULT_FULFILLMENT_DOWNLOAD_LABEL = "Download Your Product";
const SHOP_EXTERNAL_DOWNLOADS: Record<string, string> = {
  [BODY_DECK_SLUG]: "https://drive.google.com/drive/folders/1SJw4BK9jWK0yzSol9bdNc6EiVTALMWJK?usp=sharing",
  [MIND_DECK_SLUG]: "https://drive.google.com/drive/folders/1EIBuHMGOcTYsmyZtEa0XHzqJ2zr7mhG1?usp=sharing",
  [ENERGY_DECK_SLUG]: "https://drive.google.com/drive/folders/1n49uVAUqqze51JAtHZhS1QMdG22yZSJp?usp=sharing",
  [SOURCE_DECK_SLUG]: "https://drive.google.com/drive/folders/12XygFrHVkszd6TFFGmpODWUcs8Tuqdc_?usp=sharing",
  [SAFEGUARD_KIT_SLUG]: "https://drive.google.com/drive/folders/1VGlbedF6AbqFly5So0Bp1-Xi80HFupyB?usp=sharing",
  [SOURCE_BED_KIT_SLUG]: "https://drive.google.com/file/d/1AzNBGO807C9b_JiIn_ldvSRGr1D37UzW/view?usp=sharing",
};
const HCC_VIDEO_HEADING = "Free Healing Code Cards E-Course";
const HCC_VIDEO_INTRO =
  "Want to explore the Healing Code Cards in greater depth? Watch Brad Johnson's free Healing Code Cards E-Course to learn more about the philosophy behind the cards, how they are intended to be used, and ways to incorporate them into a personal spiritual wellness practice.";

const BODY_DECK_QUICK_SUMMARY =
  "A 44-card digital spiritual wellness deck created to support personal healing practice through focused intention and energetic connection. The Healing Code Cards: Body Deck includes Enhancer, Eliminator, Purifier and Amplifier cards designed for conscious work with different areas and systems of the body. The Digital Edition includes the complete card collection and instruction guide for digital use or personal printing.";

const BODY_DECK_FULL_DESCRIPTION = [
  "The Healing Code Cards: Body Deck is a 44-card digital spiritual wellness system for personal energetic practice and focused intention.",
  "The collection includes 31 Enhancer Cards for conscious work with different areas and systems of the body, 1 Major Organ Purifier Card, 8 Eliminator Cards, and 4 Amplifier Cards (5X, 10X, 20X, and 30X).",
  "Enhancer cards support focused attention and energetic connection with specific body areas. The Major Organ Purifier card is used as a purifying complement within the same spiritual practice. Eliminator cards are used for conscious clearing work. Amplifier cards (5X, 10X, 20X, 30X) are used to intensify the intention of a chosen practice.",
  "This is a Digital Edition. The complete card collection and instruction guide are provided for digital use or personal printing. This is not a physical deck.",
].join("\n\n");

const MIND_DECK_QUICK_SUMMARY =
  "Healing Code Cards: Mind Deck is a 36-card digital spiritual wellness deck created for focused work with the mind, emotions, consciousness and subtle energy. Featuring Releaser, Purifier, Stabilizer, Enhancer and Amplifier cards, the Mind Deck provides a structured personal practice involving emotional awareness, chakras, aura work, focus, lucid dreaming, manifestation, grounding and other consciousness-oriented themes. The Digital Edition can be used on compatible digital devices or printed for personal use.";

const MIND_DECK_FULL_DESCRIPTION = [
  "The Healing Code Cards: Mind Deck expands the Healing Code Cards system into the inner landscape of thought, emotion, consciousness and subtle energy.",
  "Created by Brad Johnson, this 36-card digital deck is designed as a personal spiritual wellness system for people who wish to bring greater intention and awareness to their mental, emotional and energetic practices.",
  "Where the Healing Code Cards: Body Deck focuses primarily on areas and systems of the physical body, the Mind Deck explores themes involving emotional release, chakra awareness, subtle-energy practices, focus, lucid dreaming, manifestation, grounding and other dimensions of consciousness.",
  "22 Releaser Cards\n\nThe Mind Deck contains Releaser Cards associated with the seven primary chakras, the aura, and numerous areas and systems of the body. These cards are intended for personal energetic practices centered around releasing and bringing awareness to emotional and mental patterns associated with those areas.",
  "3 Purifier Cards\n\nThe deck includes Addictions Purifier, Entity Attachments Purifier, and Spirit Light Purifier. These cards form part of the Mind Deck's purification-oriented spiritual practices.",
  "2 Stabilizer Cards\n\nThe Mind Deck contains Lucid Dream Stabilizer and Focus Stabilizer. These cards are intended for consciousness-oriented practices involving focus, mental organization and lucid-dream awareness.",
  "6 Enhancer Cards\n\nThe Mind Deck includes Psychic Sense Enhancer, Manifestation Enhancer, Love Energy Enhancer, Mental Energy Enhancer, Youth Body Enhancer, and Grounding Enhancer. The Manifestation Enhancer has its own specialized method described within the included instruction booklet.",
  "3 Amplifier Cards\n\nThe Digital Edition also includes 5X Amplifier, 10X Amplifier, and 20X Amplifier. Amplifiers are designed to be paired with one compatible Healing Code Card at a time as described in the instruction material.",
  "Ways to Work With the Mind Deck\n\nThe Mind Deck instruction guide introduces three primary approaches: the Gazing Method, the Charging Method, and the Body Method. The booklet also provides specialized guidance for communicating an intention to a selected card, working with the Manifestation Enhancer, and using Amplifier Cards.",
  "Your Digital Edition\n\nThe Healing Code Cards: Mind Deck Digital Edition includes the complete 36-card collection and supporting instruction material for personal use. The cards can be viewed digitally where appropriate or printed for use according to the techniques described in the instruction guide. The Mind Deck can be explored independently or used alongside the Healing Code Cards: Body Deck as part of a broader personal spiritual wellness practice.",
].join("\n\n");

const MIND_DECK_INCLUDED_ITEMS =
  "Complete 36-card Mind Deck collection and instruction booklet for digital use or personal printing. Deck card files are awaiting attachment.";

const ENERGY_DECK_QUICK_SUMMARY =
  "A 44-card digital spiritual wellness deck centered around prana, purification, energetic strengthening and conscious integration. The Healing Code Cards: Energy Deck introduces Purifiers, Integrators, specialized polarity cards, Color Ray practices, the Conflict Energy Container and four Amplifiers. Explore the deck digitally and print compatible cards for personal use with the methods described in the included instruction guide.";

const ENERGY_DECK_FULL_DESCRIPTION = [
  "Healing Code Cards: Energy Deck — Digital Edition",
  "**Explore a deeper dimension of energetic practice.**",
  "The **Healing Code Cards: Energy Deck** is the third deck in the Healing Code Cards series and introduces a collection of 44 cards centered around prana, purification, energetic strengthening, rejuvenation and conscious integration.",
  "Created by Brad Johnson, the Energy Deck expands upon the spiritual wellness system established by the Body and Mind Decks while introducing an extensive collection of new card types and energetic concepts.",
  "Where the Body Deck emphasizes physical areas and systems and the Mind Deck explores mental, emotional and consciousness-oriented practices, the Energy Deck places greater emphasis upon the flow and quality of subtle energy.",
  "## 44 Healing Code Cards",
  "The Energy Deck contains:",
  "* 1 Positive Polarity Collector\n* 1 Negative Polarity Receiver\n* 30 Purifier Cards\n* 7 Integrator Cards\n* 1 Conflict Energy Container\n* 4 Amplifier Cards",
  "## Purification Practices",
  "Thirty Purifier Cards form the largest part of the Energy Deck.",
  "These include cards associated with numerous areas and systems of the body as well as Sleep, Food & Drink, Subtle Body and seven Color Ray Purifiers.",
  "Within the Healing Code Cards spiritual framework, these cards are intended to provide different focal points for personal purification and energetic-awareness practices.",
  "## Positive & Negative Polarity",
  "The Energy Deck introduces the complementary **Positive Polarity Collector** and **Negative Polarity Receiver**.",
  "These cards form a specialized prana-oriented practice described within the instruction guide and are intended to be used together in printed form with the Body Method.",
  "## Seven Integrator Cards",
  "The Energy Deck also introduces:",
  "* Multivitamin Integrator\n* PEMF Integrator\n* Pyramid Torsion Integrator\n* Tree Life Force Integrator\n* Amethyst Crystal Integrator\n* Shungite Crystal Integrator\n* Selenite Crystal Integrator",
  "These cards explore the Energy Deck's spiritual concept of working with symbolic and energetic qualities associated with nutrients, natural life force, energetic modalities and crystals.",
  "## Color Ray Practices",
  "Seven Purifier Cards represent:",
  "**Red · Orange · Yellow · Green · Aqua · Blue · Violet**",
  "These cards form part of the Energy Deck's etheric color-frequency framework and provide another dimension for users interested in exploring subtle-energy practices.",
  "## Conflict Energy Container",
  "The **Conflict Energy Container** introduces an intention-based release practice.",
  "Write down a single conflict or pattern that you genuinely feel ready to release and incorporate that intention into the card practice according to the included instructions.",
  "This makes the Energy Deck not simply something to observe, but a system intended to encourage conscious participation, reflection and intention.",
  "## Four Amplifiers",
  "The deck contains:",
  "**5X · 10X · 20X · 30X**",
  "These optional cards form part of the advanced Healing Code Cards methodology and are designed to be paired with one compatible card at a time.",
  "## Four Ways to Explore the Energy Deck",
  "The accompanying instruction guide introduces:",
  "**Gazing** — focused visual attention upon a selected card.",
  "**Charging** — incorporating selected cards into the beverage-oriented practice described in the guide.",
  "**Body** — using printed cards upon or near the body.",
  "**Capture** — incorporating a photograph into an intention-based spiritual practice.",
  "Some specialized Energy Deck cards have specific method requirements, all of which are explained within the included instruction booklet.",
  "## Your Digital Edition",
  "Your Healing Code Cards: Energy Deck Digital Edition provides the complete 44-card collection together with supporting instruction material.",
  "Compatible cards may be explored digitally or printed for personal use according to the techniques described in the guide.",
  "Use the Energy Deck independently or alongside the Healing Code Cards: Body Deck and Mind Deck as part of a broader personal spiritual wellness practice.",
].join("\n\n");

const ENERGY_DECK_INCLUDED_ITEMS = [
  "Complete 44-card Energy Deck collection and instruction booklet for digital use or personal printing. Deck card files are awaiting attachment.",
  "Card composition: 1 Positive Polarity Collector, 1 Negative Polarity Receiver, 30 Purifier Cards, 7 Integrator Cards, 1 Conflict Energy Container, 4 Amplifier Cards.",
  "30 Purifier Cards: Brain Purifier, Sensory Purifier, Spinal Purifier, Thyroid Purifier, Thymus Purifier, Heart Purifier, Pericardium Purifier, Lungs Purifier, Liver Purifier, Stomach Purifier, Pancreas Purifier, Spleen Purifier, Small Intestine Purifier, Large Intestine Purifier, Reproductive Purifier, Skin Purifier, Bodily System Purifier, Joint Purifier, Cellular Body Purifier, Musculoskeletal Purifier, Red Ray Purifier, Orange Ray Purifier, Yellow Ray Purifier, Green Ray Purifier, Aqua Ray Purifier, Blue Ray Purifier, Violet Ray Purifier, Subtle Body Purifier, Sleep Purifier, Food & Drink Purifier.",
  "7 Integrator Cards: Multivitamin Integrator, PEMF Integrator, Pyramid Torsion Integrator, Tree Life Force Integrator, Amethyst Crystal Integrator, Shungite Crystal Integrator, Selenite Crystal Integrator.",
  "4 Amplifier Cards: 5X Amplifier, 10X Amplifier, 20X Amplifier, 30X Amplifier.",
].join("\n\n");

const ENERGY_DECK_WELLNESS_NOTICE =
  "Healing Code Cards are intended exclusively as a spiritual and alternative wellness practice. They are not medical devices, medicines, diagnostic tools or substitutes for professional healthcare. References to energy, prana, purification, integration, frequencies, crystals, PEMF and related concepts describe the spiritual framework and intended practices of the Healing Code Cards and should not be interpreted as claims of scientifically established medical treatment. No medical outcome is guaranteed or implied.";

const SOURCE_DECK_QUICK_SUMMARY =
  "A 28-card digital spiritual wellness deck focused on bodily coherence, energetic balance and restoration. The Healing Code Cards: Source Deck — Body Set features Balancer cards for major organs, systems and body regions, together with a layered energetic framework incorporating color rays, planetary benefic symbolism, Earth/Solar harmonics and four methods of use. Use the cards digitally or print them for personal practice.";

const SOURCE_DECK_FULL_DESCRIPTION = [
  "Healing Code Cards: Source Deck — Body Set",
  "## Digital Edition",
  "The **Healing Code Cards: Source Deck — Body Set** is a 28-card spiritual wellness system designed around bodily coherence, energetic balance, vitality and restoration.",
  "Rather than organizing the deck into Purifiers, Enhancers or Integrators, the Source Deck uses a unified **Balancer** format. Each card corresponds with a specific area, organ, system or structural aspect of the body.",
  "## 28 Balancer Cards",
  "The Source Deck includes cards for:",
  "* Brain\n* Scalp & Hair\n* Eyes\n* Nose\n* Ears\n* Mouth\n* Throat\n* Thyroid\n* Spine\n* Heart\n* Thymus\n* Lungs\n* Liver\n* Stomach\n* Pancreas\n* Spleen\n* Kidneys & Bladder\n* Intestines\n* Skin\n* Mammary Glands\n* Skeletal System\n* Muscular System\n* Lymphatic System\n* Circulatory System\n* Reproductive System\n* Nervous System\n* Cellular Body\n* DNA",
  "## Layered Energetic Architecture",
  "The Source Deck's instruction guide describes several overlapping energetic frameworks, including:",
  "* Scalar-wave concepts\n* Kundalini healing power\n* Sekhmet healing power\n* Lattice-work healing power",
  "These are presented as part of the deck's spiritual and energetic philosophy.",
  "## Color Ray Spectrum",
  "The Source Deck also incorporates an extended color-ray framework:",
  "**Red · Orange · Yellow · Green · Blue · Indigo · Violet · Ultraviolet · Infrared · Horizontal Negative Green · White**",
  "These color rays form part of the symbolic energetic system described in the Source Deck manual.",
  "## Planetary Benefic Framework",
  "The deck also incorporates benefic planetary symbolism associated with:",
  "**Mercury · Venus · Moon · Mars · Jupiter · Saturn · Uranus · Neptune · Pluto**",
  "These are used within the deck's energetic philosophy to represent qualities such as harmony, strength, structure, timing, awakening and transformation.",
  "## Earth & Solar Harmonics",
  "The manual also references:",
  "* **Earth Schumann Resonance — 7.83 Hz**\n* **Solar Frequency — 432 Hz**",
  "These are included as part of the Source Deck's intended energetic framework.",
  "## Four Ways to Work With the Deck",
  "The Source Deck manual describes four primary methods:",
  "**Gaze Method**\nFocus gently on a selected card for at least 60 seconds.",
  "**Body Placement Method**\nPlace a printed card or compatible device over the corresponding body area.",
  "**Water Charging Method**\nPosition the selected card or device against a glass of water for 60 seconds before drinking.",
  "**Remote Transmission Method**\nUse a photograph as part of a spiritual/intention-based distance practice.",
  "The cards may be used intuitively, sequentially, or by selecting whichever body area feels most relevant at the time.",
  "## Your Digital Edition",
  "Your Healing Code Cards: Source Deck — Body Set includes the complete 28-card collection together with the accompanying user manual.",
  "The cards may be displayed digitally on phones, tablets or computers, or printed for personal use.",
  "Use the Source Deck independently or alongside the Healing Code Cards: Body Deck, Mind Deck and Energy Deck as part of a broader personal spiritual wellness practice.",
].join("\n\n");

const SOURCE_DECK_INCLUDED_ITEMS = [
  "Complete 28-card Source Deck — Body Set collection and user manual for digital use or personal printing. Deck card files are awaiting attachment.",
  "28 Balancer Cards: Brain Balancer, Scalp & Hair Balancer, Eye Balancer, Nose Balancer, Ear Balancer, Mouth Balancer, Throat Balancer, Thyroid Balancer, Spine Balancer, Heart Balancer, Thymus Balancer, Lung Balancer, Liver Balancer, Stomach Balancer, Pancreas Balancer, Spleen Balancer, Kidney & Bladder Balancer, Intestinal Balancer, Skin Balancer, Mammary Gland Balancer, Skeletal Balancer, Muscular Balancer, Lymphatic Balancer, Circulatory Balancer, Reproductive Balancer, Nervous System Balancer, Cellular Balancer, DNA Balancer.",
  "Sensory & Interface Systems: Brain Balancer, Scalp & Hair Balancer, Eye Balancer, Nose Balancer, Ear Balancer.",
  "Communication & Structural Flow: Mouth Balancer, Throat Balancer, Thyroid Balancer, Spine Balancer, Heart Balancer.",
  "Processing & Regulation: Thymus Balancer, Lung Balancer, Liver Balancer, Stomach Balancer, Pancreas Balancer.",
  "Filtration & Boundary Systems: Spleen Balancer, Kidney & Bladder Balancer, Intestinal Balancer, Skin Balancer, Mammary Gland Balancer.",
  "Integration & Origin Systems: Skeletal Balancer, Muscular Balancer, Lymphatic Balancer, Circulatory Balancer, Reproductive Balancer, Nervous System Balancer, Cellular Balancer, DNA Balancer.",
].join("\n\n");

const SOURCE_DECK_WELLNESS_NOTICE =
  "Healing Code Cards are intended exclusively as a spiritual and alternative wellness practice. They are not medical devices, medicines, diagnostic tools or substitutes for professional healthcare. References to scalar waves, Kundalini, Sekhmet, lattice work, color rays, planetary frequencies, Schumann resonance, 432 Hz, remote transmission and related concepts describe the spiritual and energetic framework of the Source Deck and should not be interpreted as claims of scientifically established medical treatment. No medical outcome is guaranteed or implied.";

const MIND_DECK_WELLNESS_NOTICE =
  "Healing Code Cards are intended exclusively as a spiritual and alternative wellness practice. They are not medical devices, medicines, diagnostic tools or substitutes for professional medical or mental-health care. No medical or psychological outcome is guaranteed or implied. Consult qualified healthcare professionals regarding medical or mental-health symptoms, diagnoses or treatment.";

const BODY_DECK_VIDEO_URL = "https://www.youtube.com/live/3Kd2zR1_FnA?si=RJTwyNaE6z9HKZXu";
const MIND_DECK_VIDEO_URL = "https://www.youtube.com/live/bMsyTvQSzDU?si=O5gTLTzb-jYu5xLu";
const ENERGY_DECK_VIDEO_URL = "https://www.youtube.com/live/_DniHEzLgps?si=sbmKrhUkhTPL2vhH";

const SAFEGUARD_KIT_SUBTITLE = "Personal & Environmental Safeguard Sets";
const SAFEGUARD_KIT_QUICK_SUMMARY =
  "The Digital Safeguard Kit combines the complete Personal and Environmental Safeguard systems into one downloadable collection. Print or digitally use the Personal Safeguards as part of your personal spiritual wellness practice, and place the Environmental Safeguards throughout your home, workspace or vehicle according to the included guidance. The kit includes printable safeguard images, adaptable image strips and complete instructions for both systems.";
const SAFEGUARD_KIT_FULL_DESCRIPTION = [
  "## Digital Safeguard Kit",
  "### Personal & Environmental Safeguard Sets",
  "**Formerly called AetherX Digital Safeguards**",
  "The **Digital Safeguard Kit** brings together two complementary safeguard systems into one downloadable spiritual wellness collection.",
  "The kit contains both **Personal Safeguards** and **Environmental Safeguards**, giving you printable and digital geometric tools for personal use and for placement throughout your surroundings.",
  "The Safeguards were originally released under the AetherX name and are now being made available through The Prime Mentor as one complete Digital Safeguard Kit.",
  "## Personal Safeguard Set",
  "The **Personal Safeguards** are designed within the original system as personal energetic tools that may be used in printed or digital form.",
  "According to the included instructions, they may be:",
  "* Printed onto paper or another suitable material\n* Positioned around or upon the body\n* Displayed digitally\n* Used with a personal photograph\n* Used with another person's photograph when permission has been obtained",
  "The complete sacred-geometric pattern should always remain intact.",
  "Do not cut through the geometric circuitry when preparing or printing the Safeguard image.",
  "## Environmental Safeguard Set",
  "The **Environmental Safeguards** extend the system into homes, workspaces, vehicles and other environments.",
  "The Digital Safeguard Kit provides printable safeguard designs intended for placement around appropriate areas of your environment.",
  "Potential placements described within the original instructions include:",
  "* Home spaces\n* Work areas\n* Vehicles\n* Dashboards\n* Fuse-box exteriors\n* Light switches\n* Electrical socket areas\n* Piping\n* Other suitable environmental locations",
  "The included Environmental Safeguard **Image Strips** can be printed horizontally or vertically, providing additional flexibility for placement.",
  "## One Kit — Two Applications",
  "The Personal and Environmental systems complement one another:",
  "### Personal Safeguards",
  "Focused upon personal energetic practice.",
  "### Environmental Safeguards",
  "Focused upon the energetic qualities of your surroundings.",
  "Together they form a flexible printable safeguard system for users interested in exploring this spiritual and energetic methodology.",
  "## Printable & Digital",
  "The Digital Safeguard Kit is designed for convenient personal use.",
  "Depending upon the specific safeguard and application, customers may:",
  "* Print the supplied images\n* Print PDF templates\n* Use compatible image strips\n* Display Personal Safeguards digitally\n* Follow the included placement instructions",
  "The original geometry should always remain complete and undamaged.",
  "## Important Placement Safety",
  "The Digital Safeguard Kit should never encourage unsafe interaction with electrical, mechanical or vehicle components.",
  "When positioning Environmental Safeguards:",
  "* Never touch exposed wiring\n* Never open electrical circuits to place a Safeguard\n* Never place yourself near dangerous electrical components\n* Do not interfere with vehicle operation\n* Do not place an item where it can fall into or obstruct moving vehicle components\n* Place Safeguards only where they can be positioned safely\n* Use the exterior/accessible surface of fuse boxes rather than exposed internal circuitry\n* Safety always takes priority over placement",
].join("\n\n");
const SAFEGUARD_KIT_INCLUDED_ITEMS =
  "Digital Safeguard Kit instruction manual for digital use or personal printing. Printable Personal and Environmental safeguard files are awaiting attachment. Purchasers will receive the complete kit files when they are uploaded. Do not treat missing files as included.";
const SAFEGUARD_KIT_WELLNESS_NOTICE =
  "The Digital Safeguard Kit is intended as a spiritual and alternative wellness practice. Safeguard imagery is not a medical device, radiation-protection device, EMF shielding product, air-purification system, fuel-treatment device or substitute for established medical, electrical, environmental or occupational safety measures. References to EMF, ELF, radiation, toxins, allergens, fuel emissions, Source vibration, energetic frequencies and related concepts describe the spiritual framework and intended use of the Safeguard system and should not be interpreted as claims of scientifically established protection or treatment.";

const SOURCE_BED_KIT_SUBTITLE = "Printable Digital Edition";
const SOURCE_BED_KIT_QUICK_SUMMARY =
  "Transform virtually any bed, couch or recliner into a personal Source Bed practice with this print-at-home digital kit. The Remote Source Bed Kit includes four directional geometric arrays, a compact directional-array sheet, Physical and Subtle Body Concentrators, and complete setup instructions. Print the components in full color, arrange them around your chosen furniture, and explore the Source Bed's layered spiritual and energetic framework from your own home.";
const SOURCE_BED_KIT_FULL_DESCRIPTION = [
  "## Remote Source Bed Kit",
  "### Printable Digital Edition",
  "The **Remote Source Bed Kit** is a complete print-at-home spiritual wellness system designed to work with virtually any bed, couch or recliner.",
  "The kit uses four directional geometric arrays together with Physical and Subtle Body Concentrators to create the Source Bed configuration described in the included instruction guide.",
  "Simply print the supplied components in full color, position them according to the setup instructions, and incorporate the arrangement into your personal rest, meditation and energetic practice.",
  "## Four Directional Geometry Arrays",
  "The system includes:",
  "* North Directional Geometry Array\n* East Directional Geometry Array\n* South Directional Geometry Array\n* West Directional Geometry Array",
  "The North position corresponds to the direction where your head rests.",
  "The arrays are positioned around the chosen furniture item with the geometric symbols facing inward.",
  "## Intersecting Figure-8 Geometry",
  "Within the Source Bed framework, the North/South and East/West directional arrays are described as creating two intersecting figure-eight energetic patterns.",
  "These form the central geometry of the Source Bed arrangement and are intended to work together with the two concentrators.",
  "**4 Directional Arrays** → **Intersecting Figure-8 Geometry** → **Physical + Subtle Body Concentrators** → **Bed / Couch / Recliner**",
  "This describes the kit's intended spiritual and energetic architecture, not a scientifically established energy field.",
  "## Physical & Subtle Body Concentrators",
  "The kit contains:",
  "### Physical Body Concentrator",
  "Designed within the Source Bed system for physical-body energetic focus.",
  "### Subtle Body Concentrator",
  "Designed for subtle-energy aspects of the Source Bed practice.",
  "The instruction guide describes placing these:",
  "* On the body\n* Inside or beneath a pillow\n* Near the body",
  "Use them according to the supplied instructions.",
  "## Flexible Setup",
  "The Remote Source Bed Kit can be configured around:",
  "* Any size bed\n* Couch\n* Recliner",
  "Suggested attachment methods described in the guide include:",
  "* Fitted-sheet elastic\n* Suitable tape\n* Clothing pins\n* Clear adhesive sleeves",
  "Users should select methods that are secure and appropriate for the furniture material.",
  "## Printable at Home",
  "For best results within the intended system, the manual recommends:",
  "* Full-color printing\n* Cardstock or photo paper where available\n* Standard office paper as an acceptable alternative\n* Plastic sheet protectors for added durability",
  "Do not use black-and-white printing if the manual specifically requires full color.",
  "## No Activation Required",
  "The Remote Source Bed Kit does not require a separate activation ritual.",
  "According to the original methodology, the kit is considered operational once the four directional arrays are properly configured around the chosen furniture.",
  "No additional affirmations or amplification procedures are required.",
  "## Layered Energetic Framework",
  "The Source Bed Kit brings together a broad energetic framework that includes:",
  "* Source Center concepts\n* Scalar vibration\n* Solar and Earth harmonics\n* Color-frequency symbolism\n* Planetary benefic symbolism\n* Alpha, Theta and Delta brainwave concepts\n* Physical and subtle-body energetic mapping\n* Fibonacci-based pulsing concepts",
  "These elements describe the spiritual philosophy and intended energetic architecture of the system.",
  "## Practical guidance",
  "### Does it require activation?",
  "No. Once the four directional arrays are configured around the chosen furniture, the kit is used as described in the instruction manual.",
  "### Does it require amplification?",
  "No additional amplification procedures are required.",
  "### Can it work with different furniture sizes?",
  "Yes. The kit is designed to be configured around beds, couches and recliners of different sizes.",
  "### Where do the concentrators go?",
  "The instruction guide describes placing the Physical and Subtle Body Concentrators on the body, inside or beneath a pillow, or near the body.",
  "### What paper should be used?",
  "Full-color printing is recommended. Cardstock or photo paper is preferred where available; standard office paper is an acceptable alternative. Plastic sheet protectors can add durability.",
].join("\n\n");
const SOURCE_BED_KIT_INCLUDED_ITEMS = [
  "The Digital Edition includes:",
  "* North Directional Geometry Array PDF\n* East Directional Geometry Array PDF\n* South Directional Geometry Array PDF\n* West Directional Geometry Array PDF\n* Compact North/East/South/West Array PDF\n* Physical Body Concentrator PDF\n* Subtle Body Concentrator PDF\n* Remote Source Bed Kit Instruction Manual",
  "These files are delivered after purchase. They are not anonymous public downloads.",
].join("\n\n");
const SOURCE_BED_KIT_WELLNESS_NOTICE =
  "The Remote Source Bed Kit is intended as a spiritual and alternative wellness practice. It is not a medical device, diagnostic tool, therapeutic bed, sleep-treatment device or substitute for professional healthcare. References to Source vibration, scalar frequencies, Schumann resonance, 432 Hz, brainwave fields, chakras, meridians, Kundalini, subtle bodies, planetary frequencies, Fibonacci pulsing and related concepts describe the spiritual and energetic framework of the Source Bed system and should not be interpreted as claims of scientifically established medical treatment or guaranteed outcomes.";
const SOURCE_BED_KIT_VIDEO_URL = "https://youtu.be/WT0bY_Vme94?si=FGg28wtQEoZ3CVni";
const SOURCE_BED_KIT_VIDEO_HEADING = "How to Set Up Your Remote Source Bed Kit";
const SOURCE_BED_KIT_VIDEO_INTRO =
  "Watch the complete setup tutorial to learn how to position the directional arrays and concentrators correctly around your bed, couch or recliner.";

function assertSafeShopSeedDatabase(databaseUrl: string) {
  const host = new URL(databaseUrl.replace(/^postgresql:/, "http:")).host;
  if (host.includes("ep-weathered-forest-ak5x524w") && process.env.ALLOW_PRODUCTION_SHOP_SEED !== "1") {
    throw new Error("Refusing to seed Shop against the production Neon branch.");
  }
}

async function retrieveStripePrice(priceId: string): Promise<{
  productId: string | null;
  unitAmount: number | null;
  currency: string | null;
  active: boolean | null;
  type: string | null;
}> {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret || !priceId.startsWith("price_")) {
    return { productId: null, unitAmount: null, currency: null, active: null, type: null };
  }
  try {
    const response = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!response.ok) {
      return { productId: null, unitAmount: null, currency: null, active: null, type: null };
    }
    const price = await response.json() as {
      product?: unknown;
      unit_amount?: number | null;
      currency?: string | null;
      active?: boolean;
      type?: string | null;
    };
    return {
      productId: typeof price.product === "string" && price.product.startsWith("prod_") ? price.product : null,
      unitAmount: typeof price.unit_amount === "number" ? price.unit_amount : null,
      currency: price.currency ? price.currency.toUpperCase() : null,
      active: price.active ?? null,
      type: price.type ?? null,
    };
  } catch {
    return { productId: null, unitAmount: null, currency: null, active: null, type: null };
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

assertSafeShopSeedDatabase(databaseUrl);

const sql = neon(databaseUrl);
const db = drizzle(sql);

async function upsertShopProduct(input: {
  name: string;
  slug: string;
  sortOrder: number;
  stripePriceId?: string | null;
  priceCents: number;
  currency: string;
  stripeProductId?: string | null;
  quickSummary: string;
  fullDescription: string;
  includedItems: string;
  videoUrl?: string | null;
  videoHeading?: string | null;
  videoIntro?: string | null;
  wellnessNotice: string;
  subtitle?: string | null;
  formatLabel?: string;
  collection?: string;
  fulfillmentType?: string | null;
  fulfillmentDownloadUrl?: string | null;
  fulfillmentDownloadLabel?: string | null;
  fulfillmentEmailEnabled?: boolean;
  fulfillmentInstructions?: string | null;
  thumbnail: { files: string[]; altText: string; mimeType: string; ext: string };
}) {
  const fulfillmentDownloadUrl = input.fulfillmentDownloadUrl?.trim()
    || SHOP_EXTERNAL_DOWNLOADS[input.slug]
    || null;
  const values = {
    name: input.name,
    slug: input.slug,
    status: "active" as const,
    is_active: true,
    featured: true,
    sort_order: input.sortOrder,
    price_cents: input.priceCents,
    currency: input.currency,
    stripe_price_id: input.stripePriceId?.trim() || null,
    stripe_product_id: input.stripeProductId?.trim() || null,
    format_label: input.formatLabel?.trim() || "Digital Edition",
    subtitle: input.subtitle?.trim() || null,
    quick_summary: input.quickSummary,
    full_description: input.fullDescription,
    included_items: input.includedItems,
    video_url: input.videoUrl?.trim() || null,
    video_heading: input.videoHeading?.trim() || null,
    video_intro: input.videoIntro?.trim() || null,
    wellness_notice: input.wellnessNotice,
    collection: input.collection ?? "healing-code-cards",
    fulfillment_type: input.fulfillmentType?.trim() || (fulfillmentDownloadUrl ? "external_download" : null),
    fulfillment_download_url: fulfillmentDownloadUrl,
    fulfillment_download_label: input.fulfillmentDownloadLabel?.trim() || (fulfillmentDownloadUrl ? DEFAULT_FULFILLMENT_DOWNLOAD_LABEL : null),
    fulfillment_email_enabled: input.fulfillmentEmailEnabled ?? true,
    fulfillment_instructions: input.fulfillmentInstructions?.trim() || null,
  };

  const [existing] = await db.select().from(shopProducts).where(eq(shopProducts.slug, input.slug)).limit(1);
  const product = existing
    ? (await db.update(shopProducts).set({
      ...values,
      stripe_price_id: existing.stripe_price_id || input.stripePriceId?.trim() || null,
      stripe_product_id: existing.stripe_product_id || input.stripeProductId?.trim() || null,
      updated_at: new Date(),
    }).where(eq(shopProducts.id, existing.id)).returning())[0]
    : (await db.insert(shopProducts).values(values).returning())[0];

  if (!product) {
    throw new Error(`Shop product ${input.slug} could not be seeded.`);
  }

  console.log(`${existing ? "Updated" : "Created"} Shop product ${input.slug} (${product.id})`);
  await attachThumbnail(product.id, input.thumbnail);
  return product;
}

async function attachThumbnail(
  productId: string,
  thumbnail: { files: string[]; altText: string; mimeType: string; ext: string },
) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  let sourcePath: string | null = null;
  for (const relative of thumbnail.files) {
    const candidate = path.join(repoRoot, relative);
    try {
      await stat(candidate);
      sourcePath = candidate;
      break;
    } catch {
      // try next
    }
  }
  if (!sourcePath) {
    console.log(`Thumbnail not found for ${productId}; skipping image attach.`);
    return;
  }

  const [current] = await db
    .select()
    .from(shopProductImages)
    .where(eq(shopProductImages.product_id, productId))
    .limit(1);

  const buffer = await readFile(sourcePath);
  const storageKey = current?.storage_key?.endsWith(thumbnail.ext) ? current.storage_key : `${randomUUID()}${thumbnail.ext}`;
  const uploadDir = path.join(repoRoot, "apps/api/uploads/shop/images");
  await mkdir(uploadDir, { recursive: true });
  await copyFile(sourcePath, path.join(uploadDir, storageKey));

  if (current) {
    await db.update(shopProductImages).set({
      storage_key: storageKey,
      alt_text: thumbnail.altText,
      mime_type: thumbnail.mimeType,
      size_bytes: buffer.byteLength,
      is_primary: true,
      sort_order: 0,
      updated_at: new Date(),
    }).where(eq(shopProductImages.id, current.id));
    console.log(`Updated thumbnail ${storageKey}`);
    return;
  }

  await db.insert(shopProductImages).values({
    product_id: productId,
    storage_key: storageKey,
    alt_text: thumbnail.altText,
    mime_type: thumbnail.mimeType,
    size_bytes: buffer.byteLength,
    is_primary: true,
    sort_order: 0,
  });
  console.log(`Attached thumbnail ${storageKey}`);
}

async function resolveSeedFile(files: string[]) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  for (const relative of files) {
    const candidate = path.isAbsolute(relative) ? relative : path.join(repoRoot, relative);
    try {
      await stat(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

async function attachProductFile(
  productId: string,
  file: { files: string[]; displayName: string; kind: "booklet" | "manual" | "other" | "deck" },
) {
  const sourcePath = await resolveSeedFile(file.files);
  if (!sourcePath) {
    console.log(`${file.kind} not found for ${file.displayName}; skipping attach.`);
    return;
  }

  const [current] = await db
    .select()
    .from(shopProductFiles)
    .where(and(
      eq(shopProductFiles.product_id, productId),
      eq(shopProductFiles.display_name, file.displayName),
    ))
    .limit(1);

  const buffer = await readFile(sourcePath);
  const storageKey = current?.storage_key?.endsWith(".pdf") ? current.storage_key : `${randomUUID()}.pdf`;
  const uploadDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../apps/api/uploads/shop/files");
  await mkdir(uploadDir, { recursive: true });
  await copyFile(sourcePath, path.join(uploadDir, storageKey));

  const values = {
    storage_key: storageKey,
    display_name: file.displayName,
    mime_type: "application/pdf",
    size_bytes: buffer.byteLength,
    kind: file.kind,
    is_available: true,
  };

  if (current) {
    await db.update(shopProductFiles).set({ ...values, updated_at: new Date() }).where(eq(shopProductFiles.id, current.id));
    console.log(`Updated ${file.kind} ${file.displayName} (${storageKey})`);
    return;
  }

  await db.insert(shopProductFiles).values({
    product_id: productId,
    ...values,
  });
  console.log(`Attached ${file.kind} ${file.displayName} (${storageKey})`);
}

async function attachBooklet(
  productId: string,
  booklet: { files: string[]; displayName: string },
) {
  await attachProductFile(productId, { ...booklet, kind: "booklet" });
}

const bodyPriceId = process.env.STRIPE_BODY_DECK_PRICE_ID?.trim() || BODY_DECK_DEFAULT_PRICE_ID;
const bodyStripe = await retrieveStripePrice(bodyPriceId);
const bodyProduct = await upsertShopProduct({
  name: "Healing Code Cards: Body Deck",
  slug: BODY_DECK_SLUG,
  sortOrder: 4,
  stripePriceId: bodyPriceId,
  priceCents: bodyStripe.unitAmount ?? 2499,
  currency: bodyStripe.currency === "CAD" ? "CAD" : "CAD",
  stripeProductId: bodyStripe.productId,
  quickSummary: BODY_DECK_QUICK_SUMMARY,
  fullDescription: BODY_DECK_FULL_DESCRIPTION,
  includedItems: "Complete 44-card Body Deck collection and instruction booklet for digital use or personal printing. Deck card files are awaiting attachment.",
  videoUrl: BODY_DECK_VIDEO_URL,
  videoHeading: HCC_VIDEO_HEADING,
  videoIntro: HCC_VIDEO_INTRO,
  wellnessNotice: "Healing Code Cards are intended exclusively as a spiritual and alternative wellness practice. They are not medical devices, medicines, diagnostic tools or substitutes for professional medical care. No medical outcome is guaranteed or implied. Users should consult qualified healthcare professionals regarding medical symptoms, diagnoses or treatment.",
  thumbnail: {
    files: ["images/healing-code-cards-body-deck.jpg", "apps/web/src/assets/healing-code-cards-body-deck.jpg"],
    altText: "Healing Code Cards: Body Deck — Digital Edition",
    mimeType: "image/jpeg",
    ext: ".jpg",
  },
});

const mindStripe = await retrieveStripePrice(MIND_DECK_DEFAULT_PRICE_ID);
if (!mindStripe.unitAmount || mindStripe.currency !== "CAD" || mindStripe.type !== "one_time" || mindStripe.active !== true) {
  console.warn("Mind Deck Stripe Price could not be fully verified. Catalog row will still be written with retrieved fields only.", mindStripe);
}
if (!mindStripe.unitAmount) {
  throw new Error("Refusing to seed Mind Deck without a retrieved Stripe unit_amount. Do not guess the price.");
}

const HEALING_CODE_CARD_SLUGS = [
  "healing-code-cards-body-deck",
  "healing-code-cards-mind-deck",
  "healing-code-cards-energy-deck",
  "healing-code-cards-source-deck",
  "healing-code-cards-source-deck-body-set",
];

const BARB_TESTIMONIAL_TEXT =
  "I began working with the Body and Mind cards a year ago and they have helped immensely on both levels. The Joint, Cartilage and Stiffness cards have relieved soreness in my back and shoulders. I’ve experienced a reduction in floaters using the Eye cards, and the Mind card set has helped me through some emotional issues as well. My energy levels have been enhanced as well as my mental focus and concentration.";

const ALICE_TESTIMONIAL_TEXT =
  "I received my sample cards and within 4 days, I have noticed a notable difference from the energy. Some of the Body, Mind and Energy cards are laying on my body while sleeping and mediating. Placing the sample cards on my glass of water or jug of water, completely changes the taste to be softer, smoother in feel and a lot nicer in taste.";

const DEFAULT_TESTIMONIAL_HEADING = "What Customers Are Saying";
const DEFAULT_TESTIMONIAL_SUBTITLE = "Experiences shared by people who have worked with the Healing Code Cards.";
const DEFAULT_TESTIMONIAL_DISCLAIMER =
  "Customer testimonials reflect individual personal experiences and are provided for informational purposes only. Individual experiences vary, and testimonials do not constitute medical claims or guarantees of results. Healing Code Cards are intended as a spiritual and alternative wellness practice and are not a substitute for professional healthcare.";

async function writeSetting(key: string, value: string) {
  const [existing] = await db.select().from(shopSettings).where(eq(shopSettings.key, key)).limit(1);
  if (existing) {
    await db.update(shopSettings).set({ value, updated_at: new Date() }).where(eq(shopSettings.key, key));
    return;
  }
  await db.insert(shopSettings).values({ key, value });
}

async function upsertTestimonial(input: {
  customerName: string;
  location: string | null;
  title: string;
  testimonialText: string;
  sourceLabel: string;
  contextLabel: string;
  sortOrder: number;
  productSlugs: string[];
}) {
  const [existing] = await db
    .select()
    .from(shopTestimonials)
    .where(and(
      eq(shopTestimonials.customer_name, input.customerName),
      eq(shopTestimonials.title, input.title),
    ))
    .limit(1);
  const values = {
    customer_name: input.customerName,
    location: input.location,
    title: input.title,
    testimonial_text: input.testimonialText,
    source_label: input.sourceLabel,
    context_label: input.contextLabel,
    is_active: true,
    sort_order: input.sortOrder,
  };
  const testimonial = existing
    ? (await db.update(shopTestimonials).set({ ...values, updated_at: new Date() }).where(eq(shopTestimonials.id, existing.id)).returning())[0]
    : (await db.insert(shopTestimonials).values(values).returning())[0];
  if (!testimonial) {
    throw new Error(`Testimonial for ${input.customerName} could not be seeded.`);
  }

  const products = await db.select({ id: shopProducts.id, slug: shopProducts.slug }).from(shopProducts);
  await db.delete(shopProductTestimonials).where(eq(shopProductTestimonials.testimonial_id, testimonial.id));
  await db.insert(shopProductTestimonials).values(input.productSlugs.map((slug) => ({
    testimonial_id: testimonial.id,
    product_slug: slug,
    product_id: products.find((product) => product.slug === slug)?.id ?? null,
  })));
  return testimonial;
}

const mindProduct = await upsertShopProduct({
  name: "Healing Code Cards: Mind Deck",
  slug: MIND_DECK_SLUG,
  sortOrder: 5,
  stripePriceId: MIND_DECK_DEFAULT_PRICE_ID,
  priceCents: mindStripe.unitAmount,
  currency: "CAD",
  stripeProductId: mindStripe.productId,
  quickSummary: MIND_DECK_QUICK_SUMMARY,
  fullDescription: MIND_DECK_FULL_DESCRIPTION,
  includedItems: MIND_DECK_INCLUDED_ITEMS,
  videoUrl: MIND_DECK_VIDEO_URL,
  videoHeading: HCC_VIDEO_HEADING,
  videoIntro: HCC_VIDEO_INTRO,
  wellnessNotice: MIND_DECK_WELLNESS_NOTICE,
  thumbnail: {
    files: ["images/healing-code-cards-mind-deck.png", "apps/web/src/assets/healing-code-cards-mind-deck.png"],
    altText: "Healing Code Cards: Mind Deck — Digital Edition",
    mimeType: "image/png",
    ext: ".png",
  },
});

const energyStripe = await retrieveStripePrice(ENERGY_DECK_DEFAULT_PRICE_ID);
if (!energyStripe.unitAmount || energyStripe.currency !== "CAD" || energyStripe.type !== "one_time" || energyStripe.active !== true) {
  console.warn("Energy Deck Stripe Price could not be fully verified. Catalog row will still be written with retrieved fields only.", energyStripe);
}
if (!energyStripe.unitAmount) {
  throw new Error("Refusing to seed Energy Deck without a retrieved Stripe unit_amount. Do not guess the price.");
}

const energyProduct = await upsertShopProduct({
  name: "Healing Code Cards: Energy Deck",
  slug: ENERGY_DECK_SLUG,
  sortOrder: 6,
  stripePriceId: ENERGY_DECK_DEFAULT_PRICE_ID,
  priceCents: energyStripe.unitAmount,
  currency: "CAD",
  stripeProductId: energyStripe.productId,
  quickSummary: ENERGY_DECK_QUICK_SUMMARY,
  fullDescription: ENERGY_DECK_FULL_DESCRIPTION,
  includedItems: ENERGY_DECK_INCLUDED_ITEMS,
  videoUrl: ENERGY_DECK_VIDEO_URL,
  videoHeading: HCC_VIDEO_HEADING,
  videoIntro: HCC_VIDEO_INTRO,
  wellnessNotice: ENERGY_DECK_WELLNESS_NOTICE,
  thumbnail: {
    files: ["images/healing-code-cards-energy-deck.png", "apps/web/src/assets/healing-code-cards-energy-deck.png"],
    altText: "Healing Code Cards: Energy Deck — Digital Edition",
    mimeType: "image/png",
    ext: ".png",
  },
});

await attachBooklet(bodyProduct.id, {
  displayName: "Body Deck Instruction Booklet",
  files: [
    "files/shop-booklets/body-deck-instruction-booklet.pdf",
    "/Users/bradjohnson/Downloads/Instruction Booklet (Special Edition).pdf",
  ],
});
await attachBooklet(mindProduct.id, {
  displayName: "Mind Deck Instruction Booklet",
  files: [
    "files/shop-booklets/mind-deck-instruction-booklet.pdf",
    "/Users/bradjohnson/Downloads/Mind Deck Instruction Booklet.pdf",
  ],
});
await attachBooklet(energyProduct.id, {
  displayName: "Energy Deck Instruction Booklet",
  files: [
    "files/shop-booklets/energy-deck-instruction-booklet.pdf",
    "/Users/bradjohnson/Downloads/Energy Deck Instruction Booklet.pdf",
  ],
});

const sourceStripe = await retrieveStripePrice(SOURCE_DECK_DEFAULT_PRICE_ID);
if (!sourceStripe.unitAmount || sourceStripe.currency !== "CAD" || sourceStripe.type !== "one_time" || sourceStripe.active !== true) {
  console.warn("Source Deck Stripe Price could not be fully verified. Catalog row will still be written with retrieved fields only.", sourceStripe);
}
if (!sourceStripe.unitAmount) {
  throw new Error("Refusing to seed Source Deck without a retrieved Stripe unit_amount. Do not guess the price.");
}

const sourceProduct = await upsertShopProduct({
  name: "Healing Code Cards: Source Deck — Body Set",
  slug: SOURCE_DECK_SLUG,
  sortOrder: 3,
  stripePriceId: SOURCE_DECK_DEFAULT_PRICE_ID,
  priceCents: sourceStripe.unitAmount,
  currency: "CAD",
  stripeProductId: sourceStripe.productId,
  quickSummary: SOURCE_DECK_QUICK_SUMMARY,
  fullDescription: SOURCE_DECK_FULL_DESCRIPTION,
  includedItems: SOURCE_DECK_INCLUDED_ITEMS,
  videoUrl: null,
  wellnessNotice: SOURCE_DECK_WELLNESS_NOTICE,
  thumbnail: {
    files: ["images/healing-code-cards-source-deck-body-set.png", "apps/web/src/assets/healing-code-cards-source-deck-body-set.png"],
    altText: "Healing Code Cards: Source Deck — Body Set — Digital Edition",
    mimeType: "image/png",
    ext: ".png",
  },
});

await attachBooklet(sourceProduct.id, {
  displayName: "Source Deck — Body Set User's Manual",
  files: [
    "files/shop-booklets/source-deck-body-set-users-manual.pdf",
    "/Users/bradjohnson/Downloads/AetherX Source Deck - Body Set/AetherX Source Deck User's Manual.pdf",
  ],
});

const safeguardStripe = await retrieveStripePrice(SAFEGUARD_KIT_DEFAULT_PRICE_ID);
if (!safeguardStripe.unitAmount || safeguardStripe.currency !== "CAD" || safeguardStripe.type !== "one_time" || safeguardStripe.active !== true) {
  console.warn("Digital Safeguard Kit Stripe Price could not be fully verified. Catalog row will still be written with retrieved fields only.", safeguardStripe);
}
if (!safeguardStripe.unitAmount) {
  throw new Error("Refusing to seed Digital Safeguard Kit without a retrieved Stripe unit_amount. Do not guess the price.");
}

const safeguardKit = await upsertShopProduct({
  name: "Digital Safeguard Kit",
  slug: SAFEGUARD_KIT_SLUG,
  sortOrder: 2,
  stripePriceId: SAFEGUARD_KIT_DEFAULT_PRICE_ID,
  priceCents: safeguardStripe.unitAmount,
  currency: "CAD",
  stripeProductId: safeguardStripe.productId,
  subtitle: SAFEGUARD_KIT_SUBTITLE,
  collection: "digital-wellness-tools",
  quickSummary: SAFEGUARD_KIT_QUICK_SUMMARY,
  fullDescription: SAFEGUARD_KIT_FULL_DESCRIPTION,
  includedItems: SAFEGUARD_KIT_INCLUDED_ITEMS,
  videoUrl: null,
  wellnessNotice: SAFEGUARD_KIT_WELLNESS_NOTICE,
  thumbnail: {
    files: ["images/digital-safeguard-kit.png", "apps/web/src/assets/digital-safeguard-kit.png"],
    altText: "Digital Safeguard Kit — Personal and Environmental Safeguard Sets",
    mimeType: "image/png",
    ext: ".png",
  },
});

await attachBooklet(safeguardKit.id, {
  displayName: "Digital Safeguard Kit Instructions",
  files: [
    "files/shop-booklets/digital-safeguard-kit-instructions.pdf",
    "/Users/bradjohnson/Downloads/Digital Safeguard Kit Instructions.pdf",
  ],
});

const sourceBedStripe = await retrieveStripePrice(SOURCE_BED_KIT_DEFAULT_PRICE_ID);
if (!sourceBedStripe.unitAmount || sourceBedStripe.currency !== "CAD" || sourceBedStripe.type !== "one_time" || sourceBedStripe.active !== true) {
  console.warn("Remote Source Bed Kit Stripe Price could not be fully verified. Catalog row will still be written with retrieved fields only.", sourceBedStripe);
}
if (!sourceBedStripe.unitAmount) {
  throw new Error("Refusing to seed Remote Source Bed Kit without a retrieved Stripe unit_amount. Do not guess the price.");
}

const sourceBedKit = await upsertShopProduct({
  name: "Remote Source Bed Kit",
  slug: SOURCE_BED_KIT_SLUG,
  sortOrder: 1,
  stripePriceId: SOURCE_BED_KIT_DEFAULT_PRICE_ID,
  priceCents: sourceBedStripe.unitAmount,
  currency: "CAD",
  stripeProductId: sourceBedStripe.productId,
  formatLabel: "Printable Digital Edition",
  subtitle: SOURCE_BED_KIT_SUBTITLE,
  collection: "digital-wellness-tools",
  quickSummary: SOURCE_BED_KIT_QUICK_SUMMARY,
  fullDescription: SOURCE_BED_KIT_FULL_DESCRIPTION,
  includedItems: SOURCE_BED_KIT_INCLUDED_ITEMS,
  videoUrl: SOURCE_BED_KIT_VIDEO_URL,
  videoHeading: SOURCE_BED_KIT_VIDEO_HEADING,
  videoIntro: SOURCE_BED_KIT_VIDEO_INTRO,
  wellnessNotice: SOURCE_BED_KIT_WELLNESS_NOTICE,
  thumbnail: {
    files: ["images/remote-source-bed-kit.png", "apps/web/src/assets/remote-source-bed-kit.png"],
    altText: "Remote Source Bed Kit — Printable Digital Edition",
    mimeType: "image/png",
    ext: ".png",
  },
});

await attachProductFile(sourceBedKit.id, {
  kind: "manual",
  displayName: "Remote Source Bed Kit Instruction Manual",
  files: [
    "files/shop-source-bed-kit/remote-source-bed-kit-instructions.pdf",
    "/Users/bradjohnson/Downloads/Remote Source Bed Kit[1]/Remote Source Bed Kit Instructions.pdf",
  ],
});
for (const file of [
  { displayName: "North Directional Geometry Array", files: ["files/shop-source-bed-kit/north-directional-geometry-array.pdf"] },
  { displayName: "East Directional Geometry Array", files: ["files/shop-source-bed-kit/east-directional-geometry-array.pdf"] },
  { displayName: "South Directional Geometry Array", files: ["files/shop-source-bed-kit/south-directional-geometry-array.pdf"] },
  { displayName: "West Directional Geometry Array", files: ["files/shop-source-bed-kit/west-directional-geometry-array.pdf"] },
  { displayName: "Compact North/East/South/West Array", files: ["files/shop-source-bed-kit/compact-directional-arrays.pdf"] },
  { displayName: "Physical Body Concentrator", files: ["files/shop-source-bed-kit/physical-body-concentrator.pdf"] },
  { displayName: "Subtle Body Concentrator", files: ["files/shop-source-bed-kit/subtle-body-concentrator.pdf"] },
]) {
  await attachProductFile(sourceBedKit.id, { ...file, kind: "other" });
}

await writeSetting("shop.testimonials.heading", DEFAULT_TESTIMONIAL_HEADING);
await writeSetting("shop.testimonials.subtitle", DEFAULT_TESTIMONIAL_SUBTITLE);
await writeSetting("shop.testimonials.disclaimer", DEFAULT_TESTIMONIAL_DISCLAIMER);

const barb = await upsertTestimonial({
  customerName: "Barb Salerno",
  location: "Los Angeles, CA",
  title: "Body & Mind Deck Experience",
  testimonialText: BARB_TESTIMONIAL_TEXT,
  sourceLabel: "AetherX archive",
  contextLabel: "Originally shared regarding the Body & Mind Decks",
  sortOrder: 1,
  productSlugs: HEALING_CODE_CARD_SLUGS,
});

const alice = await upsertTestimonial({
  customerName: "Alice Bacon",
  location: null,
  title: "Healing Code Cards Experience",
  testimonialText: ALICE_TESTIMONIAL_TEXT,
  sourceLabel: "AetherX archive",
  contextLabel: "Originally shared regarding the Body, Mind & Energy Decks",
  sortOrder: 2,
  productSlugs: HEALING_CODE_CARD_SLUGS,
});

const recovered = [];
for (const quote of RECOVERED_CARD_TESTIMONIALS) {
  recovered.push(await upsertTestimonial(quote));
}

console.log(JSON.stringify({
  bodyDeck: {
    id: bodyProduct.id,
    slug: bodyProduct.slug,
    priceCents: bodyProduct.price_cents,
    stripePriceId: bodyProduct.stripe_price_id,
    stripeProductId: bodyProduct.stripe_product_id,
  },
  mindDeck: {
    id: mindProduct.id,
    slug: mindProduct.slug,
    priceCents: mindProduct.price_cents,
    stripePriceId: mindProduct.stripe_price_id,
    stripeProductId: mindProduct.stripe_product_id,
    stripeVerified: {
      active: mindStripe.active,
      type: mindStripe.type,
      currency: mindStripe.currency,
      unitAmount: mindStripe.unitAmount,
    },
  },
  energyDeck: {
    id: energyProduct.id,
    slug: energyProduct.slug,
    priceCents: energyProduct.price_cents,
    stripePriceId: energyProduct.stripe_price_id,
    stripeProductId: energyProduct.stripe_product_id,
    stripeVerified: {
      active: energyStripe.active,
      type: energyStripe.type,
      currency: energyStripe.currency,
      unitAmount: energyStripe.unitAmount,
    },
  },
  sourceDeck: {
    id: sourceProduct.id,
    slug: sourceProduct.slug,
    priceCents: sourceProduct.price_cents,
    stripePriceId: sourceProduct.stripe_price_id,
    stripeProductId: sourceProduct.stripe_product_id,
    stripeVerified: {
      active: sourceStripe.active,
      type: sourceStripe.type,
      currency: sourceStripe.currency,
      unitAmount: sourceStripe.unitAmount,
    },
  },
  safeguardKit: {
    id: safeguardKit.id,
    slug: safeguardKit.slug,
    priceCents: safeguardKit.price_cents,
    subtitle: safeguardKit.subtitle,
    collection: safeguardKit.collection,
    stripePriceId: safeguardKit.stripe_price_id,
    stripeProductId: safeguardKit.stripe_product_id,
    stripeVerified: {
      active: safeguardStripe.active,
      type: safeguardStripe.type,
      currency: safeguardStripe.currency,
      unitAmount: safeguardStripe.unitAmount,
    },
  },
  sourceBedKit: {
    id: sourceBedKit.id,
    slug: sourceBedKit.slug,
    priceCents: sourceBedKit.price_cents,
    formatLabel: sourceBedKit.format_label,
    subtitle: sourceBedKit.subtitle,
    collection: sourceBedKit.collection,
    stripePriceId: sourceBedKit.stripe_price_id,
    stripeProductId: sourceBedKit.stripe_product_id,
    videoUrl: sourceBedKit.video_url,
    stripeVerified: {
      active: sourceBedStripe.active,
      type: sourceBedStripe.type,
      currency: sourceBedStripe.currency,
      unitAmount: sourceBedStripe.unitAmount,
    },
  },
  testimonials: {
    barb: { id: barb.id, associations: HEALING_CODE_CARD_SLUGS },
    alice: { id: alice.id, associations: HEALING_CODE_CARD_SLUGS },
    recoveredCount: recovered.length,
  },
}, null, 2));
