import { type SessionLandingContent } from "../components/public/SessionLandingPage";
import { QA_BOOKING_PATH } from "../lib/sessionLandingPaths";

const qaSessionImage = "/images/Q&A Session.png";

export const qaSessionLandingContent: SessionLandingContent = {
  theme: "qa",
  pageTitle: "qa_session",
  hero: {
    eyebrow: "Q&A Session",
    title: "Q&A Session",
    subtitle: "30-Minute Open Interaction for Clarity, Insight & Direct Connection",
    supportingLine:
      "Bring the questions that matter most right now and meet them in a focused space designed for direct conversation, clarity, and immediate perspective.",
    cta: {
      label: "Book Q&A Session",
      href: QA_BOOKING_PATH,
    },
    callout: {
      eyebrow: "Quick Access",
      title: "A flexible 30-minute session for open dialogue without Divin8 structure.",
      description:
        "This is a live 1-on-1 interaction built for clarity, perspective, and direct connection when you want insight without entering a full Divin8 reading, blueprint analysis, or mentoring framework.",
    },
  },
  sections: [
    {
      id: "open-interaction",
      label: "Open Interaction",
      title: "A flexible session where your questions can lead the conversation.",
      paragraphs: [
        "The Q&A Session offers you the opportunity to ask any questions on your mind. These sessions can be personal or general in nature, giving you room to bring forward what feels most relevant without needing to fit into a rigid structure first.",
        "This creates an inviting space for freedom of inquiry. You may want clarity around a current life situation, spiritual direction, a specific decision, or a wider curiosity that has been calling for deeper perspective. The session is designed to stay open, responsive, and conversational.",
        "Rather than moving through a formal process, this session supports direct dialogue in a grounded and approachable way. It is a safe space to ask, explore, and receive clear answers with enough room for the interaction to unfold naturally.",
      ],
      image: {
        src: qaSessionImage,
        alt: "Q&A Session artwork",
        fit: "contain",
      },
      imagePosition: "right",
    },
    {
      id: "interactions-with-adronis",
      label: "Interactions with Adronis",
      title: "Choose a direct interaction with Brad or a channeled exchange with Adronis.",
      paragraphs: [
        "Since 2008, Brad Johnson has communicated with a higher-dimensional ET consciousness known as Adronis. Over time, many have come to regard this presence as a cosmic master teacher and a living repository of expansive insight.",
        "Within the Q&A Session, you can choose a direct interaction with Brad, or you can request a channeled interaction with Adronis. That choice remains in your hands, allowing the session to match the kind of perspective and connection you feel called toward.",
        "What makes this session unique is the simplicity of that access. You are not entering a high-pressure experience or being asked to adopt hype or abstraction. Instead, you are meeting a clear and elevated perspective in a format that stays personal, grounded, and open.",
      ],
      density: "tight",
    },
    {
      id: "what-this-session-is",
      label: "What This Session Is",
      title: "An honest, curiosity-driven space for direct answers.",
      paragraphs: [
        "The Q&A Session does not include Divin8 system access, structured mentoring, or blueprint analysis. It is not designed to function like a report, a formal synthesis session, or a deeper transformational container.",
        "Instead, this session is about open dialogue. It is ideal when you want to ask direct questions, explore what is present for you, and receive insight in a simple and responsive format.",
        "The tone remains clear, grounded, and honest. You are not paying for unnecessary process. You are creating space for meaningful interaction, practical perspective, and focused clarity in the moment.",
      ],
    },
    {
      id: "mid-page-cta",
      label: "Book Your Q&A Session",
      title: "Gain clarity and direct insight in a focused 30-minute session",
      paragraphs: [
        "If what you need is a concise space for real questions and real perspective, this session gives you that access without overcomplicating the experience.",
      ],
      statementLines: [
        "Bring your questions.",
        "Receive direct insight.",
        "Leave with greater clarity.",
      ],
      cta: {
        label: "Book Your Q&A Session",
        href: QA_BOOKING_PATH,
      },
      alignment: "center",
      density: "tight",
    },
    {
      id: "common-topics",
      label: "Common Topics",
      title: "Questions can move across spiritual, practical, and exploratory territory.",
      paragraphs: [
        "This session is ideal for curiosity-based inquiries. For deeper transformation and structured guidance, Focus and Mentoring sessions offer a more layered path.",
      ],
      bullets: [
        "Akashic Record insights",
        "Stillness, Silence and the Self",
        "Inner work and energy exercises",
        "Aligning to God/Spirit/Source",
        "Personal Self-Guidance training",
        "Deep Universal Teachings/Guidance",
        "Business development & guidance",
        "Love, Soulmates, & Relationship guidance",
        "Meditation enhancement practices",
        "Universal knowledge/Reality mechanics",
        "Extraterrestrial/Star Lineage connections",
        "Dream guidance and interpretations",
        "Manifestation guidance/insights",
        "Duality and Non-Duality",
        "Soul, Oversoul and Spirit",
        "Self-Realization & Self-Inquiry",
      ],
      bulletColumns: 2,
    },
    {
      id: "what-you-receive",
      label: "What You Receive",
      title: "Direct access, a clear live session, and a recording you can return to.",
      paragraphs: [
        "Your Q&A Session includes a 30-minute live Zoom session where you can interact directly with Brad and, if requested, Adronis. The space is open enough for free inquiry while still being focused enough to keep the time meaningful and clear.",
        "After the session, your Zoom recording is delivered through the same reliable flow used for other live sessions. You will receive it by email, and it will also remain available inside your member dashboard so you can revisit the conversation whenever you need to.",
      ],
      density: "tight",
    },
    {
      id: "who-this-is-for",
      label: "Who This Session Is For",
      title: "A strong fit for people who want access without committing to a longer structure.",
      paragraphs: [
        "This session serves those seeking quick clarity, those exploring whether deeper work is right for them, those who are curious about Adronis, and those who want direct access without stepping into a longer or more structured session format.",
        "It can also be a meaningful first step for people who want to make contact, ask important questions, and discover where a deeper Focus or Mentoring path may eventually support them best.",
      ],
    },
  ],
  finalCta: {
    eyebrow: "Step Into Clarity",
    title: "Step Into Clarity",
    description:
      "Ask what matters, receive direct perspective, and experience a focused session built for immediate insight and connection.",
    cta: {
      label: "Book Q&A Session",
      href: QA_BOOKING_PATH,
    },
  },
};
