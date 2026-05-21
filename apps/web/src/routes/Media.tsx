import { useState, type ReactNode } from "react";
import { ContactPublicContent } from "./ContactPublic";

const spiritualLivingImage = "/about/spiritual_living.jpg";
const spiritualityNowImage = "/about/spirituality_now.jpg";
const bradJohnsonImage = "/about/bradjohnson.png";

const authorityCards = [
  "18+ years of consciousness research",
  "compelling storytelling",
  "high-curiosity topics audiences love",
  "practical and grounded insight",
  "international speaking experience",
  "premium authority and media experience",
];

const conversationQualities = [
  "thought-provoking",
  "expansive",
  "practical",
  "transformational",
  "curiosity-driven",
  "deeply engaging",
];

const featuredLogos = ["Newsweek", "Vice TV", "Exopolitics", "The Moore Show", "VOICE Publications", "100+ appearances"];

const videos = [
  {
    title: "Vice TV — Mr. Tachyon",
    description:
      "Brad Johnson appears in Vice TV’s Mr. Tachyon, demonstrating the ancient Tibetan Tummo technique—warming the body in extreme cold conditions inside a freezer truck.",
    youtubeId: "YtoFJ0zroN8",
    url: "https://www.youtube.com/watch?v=YtoFJ0zroN8",
  },
  {
    title: "Kevin Moore Documentary — They Call Us Channelers",
    description:
      "Featured in the documentary They Call Us Channelers, Brad discusses consciousness, spiritual communication, and his evolution through channeling and expanded awareness.",
    youtubeId: "uIRC_J6x-bs",
    url: "https://www.youtube.com/watch?v=uIRC_J6x-bs",
  },
  {
    title: "Exopolitics Today — Dr. Michael Salla & Brad Johnson",
    description:
      "Brad Johnson joins Dr. Michael Salla on Exopolitics Today discussing extraterrestrial disclosure, consciousness, and humanity’s evolving future.",
    youtubeId: "H1Owk07tRvQ",
    url: "https://youtu.be/H1Owk07tRvQ?si=0375WQS5Q7geVa9_",
  },
  {
    title: "Brad Johnson: 2038 - A Golden Age",
    description:
      "Brad Johnson channeled Adronis at the Empowered Light Expo (Philadelphia, PA) on September 6th, 2019. Adronis shared profound insight on the path to the Golden Age involving 2037 and 2038 plus touched on several other topics regarding extraterrestrials, our moon, star system & questions from the audience.",
    youtubeId: "zPyNOsRIhAM",
    url: "https://youtu.be/zPyNOsRIhAM",
  },
];

const topics = [
  {
    title: "Manifestation Beyond the Law of Attraction",
    description: "How consciousness, familiarity, and materialized memory shape reality through the Prime Mind and Prime Law.",
    areas: [
      "Why manifestation often fails",
      "Materialized memory",
      "State & emotional familiarity",
      "Prime Mind principles",
      "Conscious transformation",
    ],
  },
  {
    title: "Extraterrestrial Disclosure & What’s Really Happening",
    description: "How expanded consciousness, extraterrestrial intelligence, and human evolution may be deeply connected.",
    areas: [
      "The ET phenomenon",
      "Consciousness & disclosure",
      "Advanced civilizations",
      "Humanity’s future",
      "Spiritual implications of ET contact",
    ],
  },
  {
    title: "Timelines, Time Travel & Infinite Parallel Versions of You",
    description: "Are parallel realities real—and can consciousness move between them?",
    areas: [
      "Parallel realities",
      "Timeline shifts",
      "Time travel through consciousness",
      "Déjà vu & synchronicity",
      "Infinite versions of self",
    ],
  },
  {
    title: "Akashic Records: The Universal Library of Creation",
    description: "What if reality stores the memory of everything?",
    areas: ["What the Akashic Records are", "Accessing expanded information", "Intuition vs imagination", "Consciousness and memory"],
  },
  {
    title: "Channeling, Consciousness & Direct Spiritual Communication",
    description: "What is channeling really—and can consciousness expand beyond ordinary perception?",
    areas: [
      "What channeling actually is",
      "Higher mind states",
      "Intuition & expanded awareness",
      "Spiritual communication",
      "Consciousness exploration",
    ],
  },
  {
    title: "Dream States, Lucid Dreaming & Inner Intelligence",
    description: "Can dreams help us heal, transform, and access deeper insight?",
    areas: ["Lucid dreaming", "Dream symbolism", "Emotional processing", "Expanded awareness"],
  },
  {
    title: "Trauma, Identity & Transformation",
    description: "How unresolved emotional patterns shape perception and reality.",
    areas: ["Trauma & identity", "Emotional reconciliation", "Conscious transformation", "Trauma Transcendence Technique™"],
  },
  {
    title: "Ancient Spiritual Systems & Consciousness",
    description: "What ancient wisdom traditions still teach us today.",
    areas: ["Kriya Yoga", "Qigong", "Taoism", "Sacred systems", "Consciousness cultivation"],
  },
  {
    title: "The Future of Humanity & Conscious Evolution",
    description: "What may be changing in human consciousness.",
    areas: ["Human transformation", "Collective shifts", "Spiritual evolution", "Consciousness expansion"],
  },
];

const glanceItems = [
  "18+ Years Experience",
  "100+ Media Appearances",
  "International Speaker",
  "Featured In Newsweek & Vice TV",
  "2 Bestselling Books Published In Japan",
  "Creator of Trauma Transcendence Technique™",
  "Inventor of RAYD8 Scalar Rejuvenation System",
  "Founder of The Prime Mentor & AetherX",
];

const bios = [
  {
    title: "50-Word Bio",
    text: "Brad Johnson is an international metaphysical expert, consciousness researcher, speaker, and founder of The Prime Mentor. For over 18 years, Brad has explored manifestation, consciousness, transformation, and ancient spiritual systems while helping individuals better understand intuition, regeneration, personal growth, and practical metaphysics.",
  },
  {
    title: "100-Word Bio",
    text: `Brad Johnson is an international metaphysical expert, consciousness researcher, speaker, and founder of The Prime Mentor with over 18 years of experience studying consciousness, manifestation, transformation, ancient spiritual systems, and intuitive intelligence.

Featured in Newsweek, Vice TV, documentaries, and over 100 media appearances worldwide, Brad shares a grounded yet expansive approach to spirituality, human potential, and practical metaphysics.

His work bridges consciousness research, manifestation, regeneration, dream states, intuition, and transformational practices designed to help individuals reconnect with deeper awareness and meaningful personal change.`,
  },
  {
    title: "250-Word Bio",
    text: `Brad Johnson is an international metaphysical expert, consciousness researcher, speaker, and founder of The Prime Mentor with over 18 years of experience exploring consciousness, manifestation, transformation, intuition, ancient spiritual systems, and practical metaphysics.

Beginning his journey into expanded awareness in 2008, Brad immersed himself in meditation, dream-state exploration, ancient wisdom traditions, consciousness studies, and transformative spiritual practices including Kriya Yoga, Taoism, Qigong, Astrology, and meditation-based disciplines.

Brad became widely recognized through consciousness-based teachings, international speaking engagements, bestselling books published in Tokyo, Japan, documentaries, and over 100 podcast, television, radio, and media appearances worldwide.

Featured in Newsweek, Vice TV’s Mr. Tachyon, documentaries, and multiple international platforms, Brad teaches what he calls the Prime Mind and Prime Law—principles centered around manifestation, awareness, transformation, regeneration, and practical spirituality.

Today, Brad helps individuals better understand consciousness, emotional transformation, intuition, dream work, and personal empowerment through The Prime Mentor while continuing to explore the deeper relationship between awareness and human potential.`,
  },
  {
    title: "Full Media Bio",
    text: `For over 18 years, Brad Johnson has dedicated his life to the exploration of consciousness, manifestation, personal transformation, ancient spiritual systems, and the deeper mechanics of reality.

As the founder of The Prime Mentor, Brad helps individuals explore practical metaphysics, inner transformation, regeneration, and what he refers to as the Prime Mind—a heightened state of awareness centered around alignment, intentionality, consciousness, and authentic living.

Known for his grounded yet expansive approach to spirituality, Brad has spent nearly two decades researching, applying, teaching, and refining transformational methods that bridge ancient wisdom with modern consciousness work.

His work explores the relationship between mind, energy, identity, intuition, manifestation, and human potential—helping people better understand how inner state influences outer experience.

Brad Johnson has been featured internationally across podcasts, radio, documentaries, television, speaking events, magazines, and conferences for over 18 years.

Brad is the author and co-author of numerous books exploring spirituality, consciousness, manifestation, and transformation.

Whether through mentoring, manifestation guidance, consciousness education, or transformational methods, Brad’s goal remains the same: To help people reconnect with the deeper potential that already exists within them.`,
  },
];

const intros = [
  {
    title: "Default Podcast Intro",
    text: `Joining us today is Brad Johnson, international metaphysical expert, consciousness researcher, speaker, and founder of The Prime Mentor.

For over 18 years, Brad has explored manifestation, consciousness, transformation, intuition, dream states, and ancient spiritual systems through both research and lived experience.

Featured in Newsweek, Vice TV, documentaries, bestselling publications in Tokyo, Japan, and over 100 media appearances worldwide, Brad shares a grounded yet expansive perspective on practical metaphysics, consciousness, regeneration, and human potential.

Brad, welcome to the show.`,
  },
  {
    title: "Short Podcast Intro",
    text: "Today’s guest is Brad Johnson, international metaphysical expert, consciousness researcher, and founder of The Prime Mentor, where he teaches manifestation, consciousness, transformation, and practical metaphysics through over 18 years of experience and research.",
  },
  {
    title: "Curiosity-Based Intro",
    text: "Today we’re joined by Brad Johnson, an international metaphysical expert and consciousness researcher who has spent nearly two decades exploring manifestation, timelines, consciousness, intuition, extraterrestrial disclosure, ancient spiritual systems, and what may really shape reality.",
  },
];

const hostQuestions = [
  "What is the Prime Mind?",
  "What do you mean by “materialized memory”?",
  "Why does manifestation fail for so many people?",
  "How did your consciousness journey begin?",
  "What drew you into ancient spiritual systems?",
  "What are the Akashic Records?",
  "What is channeling from your perspective?",
  "What role do dreams play in transformation?",
  "Are timelines and parallel realities real?",
  "What are humanity’s biggest misconceptions about consciousness?",
  "What is Trauma Transcendence Technique™?",
  "What inspired RAYD8?",
  "What do you believe humanity is moving toward?",
];

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="relative scroll-mt-28 border-t border-white/8 py-14 sm:py-18">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-8 max-w-3xl text-left">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{title}</h2>
        </div>
        {children}
      </div>
    </section>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={[
        "rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function ButtonLink({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <a
      href={href}
      className={[
        "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition",
        primary ? "bg-cyan-200 text-slate-950 hover:bg-white" : "border border-white/15 text-white hover:bg-white/10",
      ].join(" ")}
    >
      {children}
    </a>
  );
}

function CopyBlock({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <button
          type="button"
          onClick={copy}
          className="rounded-full border border-cyan-200/25 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-300/16"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-4 whitespace-pre-line text-sm leading-7 text-white/68">{text}</p>
    </Card>
  );
}

function LazyYouTubeEmbed({ video }: { video: (typeof videos)[number] }) {
  const [loaded, setLoaded] = useState(false);
  const thumbnail = `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`;

  return (
    <Card className="overflow-hidden p-0">
      <div className="aspect-video bg-black">
        {loaded ? (
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?rel=0&modestbranding=1`}
            title={video.title}
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className="group relative h-full w-full overflow-hidden text-left"
            onClick={() => setLoaded(true)}
            aria-label={`Play ${video.title}`}
          >
            <img
              src={thumbnail}
              alt={`${video.title} video thumbnail`}
              className="h-full w-full object-cover opacity-82 transition duration-300 group-hover:scale-[1.02] group-hover:opacity-100"
              loading="lazy"
              decoding="async"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white/18 text-xl text-white shadow-2xl backdrop-blur-md">
              ▶
            </span>
          </button>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-lg font-semibold text-white">{video.title}</h3>
        <p className="mt-3 text-sm leading-7 text-white/64">{video.description}</p>
        <a href={video.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex text-sm font-semibold text-cyan-100 hover:text-white">
          Open on YouTube
        </a>
      </div>
    </Card>
  );
}

export default function Media() {
  return (
    <main className="relative overflow-hidden text-white">
      <section className="relative overflow-hidden border-b border-white/8 px-6 py-20 sm:py-28">
        <div className="absolute left-1/2 top-0 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.06fr_0.94fr]">
          <div className="text-left">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/70">Media Kit</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-white sm:text-6xl">
              Looking For A Thought-Provoking Podcast Guest?
            </h1>
            <p className="mt-5 text-2xl font-semibold tracking-[-0.035em] text-white">Meet Brad Johnson</p>
            <p className="mt-2 text-base font-semibold text-cyan-100/85">
              International Metaphysical Expert, Consciousness Researcher, Speaker & Founder of The Prime Mentor
            </p>
            <p className="mt-6 max-w-3xl text-base leading-8 text-white/68">
              For over 18 years, Brad Johnson has explored consciousness, manifestation, transformation, ancient spiritual systems, extraterrestrial disclosure, dream work, intuition, and practical metaphysics through global teaching, media appearances, and lived experience.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="#media-contact" primary>Book Brad For Your Podcast</ButtonLink>
              <ButtonLink href="#official-bios">Download Media Kit</ButtonLink>
              <ButtonLink href="#media-contact">Speaking Inquiry</ButtonLink>
            </div>
          </div>
          <Card className="space-y-5 bg-[radial-gradient(circle_at_top,_rgba(94,234,212,0.18),_transparent_46%),rgba(255,255,255,0.05)]">
            <img
              src={bradJohnsonImage}
              alt="Brad Johnson, international metaphysical expert"
              className="mx-auto h-auto max-h-[44rem] w-full rounded-2xl object-contain shadow-2xl"
              loading="lazy"
              decoding="async"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <img src={spiritualLivingImage} alt="Newsweek Spiritual Living cover" className="h-auto w-full rounded-2xl object-contain shadow-2xl" loading="lazy" decoding="async" />
              <img src={spiritualityNowImage} alt="Newsweek Spirituality Now cover" className="h-auto w-full rounded-2xl object-contain shadow-2xl" loading="lazy" decoding="async" />
            </div>
          </Card>
        </div>
      </section>

      <Section id="why-hosts-feature-brad" eyebrow="Why Interview Brad?" title="Why Podcast Hosts Feature Brad Johnson">
        <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
          <Card>
            <p className="text-base leading-8 text-white/68">Brad brings a rare combination of:</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {authorityCards.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/78">{item}</div>
              ))}
            </div>
          </Card>
          <Card>
            <h3 className="text-xl font-semibold text-white">Conversations With Brad Are:</h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {conversationQualities.map((item) => (
                <div key={item} className="rounded-2xl border border-cyan-200/16 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-50">{item}</div>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      <Section id="featured-in" eyebrow="Social Proof" title="Featured In">
        <div className="space-y-5">
          <Card>
            <p className="text-base leading-8 text-white/68">Brad Johnson was featured in both Newsweek Special Edition publications:</p>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <img src={spiritualLivingImage} alt="Newsweek Spiritual Living cover" className="mx-auto h-auto max-h-[34rem] w-full rounded-2xl object-contain shadow-2xl" loading="lazy" decoding="async" />
                <h3 className="mt-5 text-xl font-semibold text-white">Spiritual Living</h3>
                <p className="mt-2 text-sm leading-6 text-white/62">sharing insight into lucid dreaming, dream interpretation, and expanded consciousness.</p>
              </div>
              <div>
                <img src={spiritualityNowImage} alt="Newsweek Spirituality Now cover" className="mx-auto h-auto max-h-[34rem] w-full rounded-2xl object-contain shadow-2xl" loading="lazy" decoding="async" />
                <h3 className="mt-5 text-xl font-semibold text-white">Spirituality Now</h3>
                <p className="mt-2 text-sm leading-6 text-white/62">sharing perspectives on consciousness and spiritual communication.</p>
              </div>
            </div>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {featuredLogos.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center text-sm font-semibold text-white/80">{item}</div>
            ))}
          </div>
          <Card>
            <p className="text-base leading-8 text-white/68">
              Featured across podcasts, television, documentaries, magazines, international speaking engagements, and over 100 media appearances worldwide.
            </p>
          </Card>
        </div>
      </Section>

      <Section id="featured-interviews" eyebrow="Trust Building" title="Featured Interviews & Media">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {videos.map((video) => (
            <LazyYouTubeEmbed key={video.title} video={video} />
          ))}
        </div>
      </Section>

      <Section id="interview-topics" eyebrow="Popular Interview Topics" title="Popular Interview Topics">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {topics.map((topic) => (
            <Card key={topic.title} className="transition duration-300 hover:-translate-y-1 hover:border-cyan-200/24 hover:bg-white/[0.075]">
              <h3 className="text-xl font-semibold tracking-[-0.025em] text-white">{topic.title}</h3>
              <p className="mt-3 text-sm leading-7 text-white/66">{topic.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {topic.areas.map((area) => (
                  <span key={area} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/62">{area}</span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="at-a-glance" eyebrow="Authority Snapshot" title="Brad Johnson At A Glance">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {glanceItems.map((item) => (
            <Card key={item} className="min-h-32">
              <p className="text-2xl font-semibold tracking-[-0.04em] text-white">{item}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="official-bios" eyebrow="Copy-Ready Assets" title="Official Bios">
        <div className="mb-5 rounded-3xl border border-amber-200/18 bg-amber-300/10 p-5 text-sm leading-7 text-amber-50/90">
          Download Media Kit points here until the final PDF asset is available. The copy-ready official bios, intro scripts, and host questions below are the current media-kit assets.
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {bios.map((bio) => (
            <CopyBlock key={bio.title} title={bio.title} text={bio.text} />
          ))}
        </div>
      </Section>

      <Section id="podcast-intros" eyebrow="Host Assets" title="Podcast Intro Scripts">
        <div className="grid gap-5 lg:grid-cols-3">
          {intros.map((intro) => (
            <CopyBlock key={intro.title} title={intro.title} text={intro.text} />
          ))}
        </div>
      </Section>

      <Section id="host-questions" eyebrow="Suggested Host Questions" title="Suggested Host Questions">
        <Card>
          <div className="divide-y divide-white/10">
            {hostQuestions.map((question) => (
              <details key={question} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-white">
                  <span>{question}</span>
                  <span className="text-cyan-100 transition group-open:rotate-45">+</span>
                </summary>
              </details>
            ))}
          </div>
        </Card>
      </Section>

      <section id="media-contact" className="relative scroll-mt-28 border-t border-white/8 px-6 py-18">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(80,120,255,0.18),_transparent_48%),rgba(255,255,255,0.055)] p-8 text-center shadow-[0_22px_70px_rgba(0,0,0,0.3)] backdrop-blur-xl">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">Ready To Book Brad Johnson?</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">Ready To Book Brad Johnson?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/68">
            Looking for a podcast guest who brings depth, curiosity, meaningful insight, and engaging conversation?
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {["podcasts", "interviews", "summits", "conferences", "speaking engagements"].map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/72">{item}</span>
            ))}
          </div>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="#contact-form" primary>Book Brad For Your Show</ButtonLink>
            <ButtonLink href="#contact-form">Media Inquiry</ButtonLink>
          </div>
        </div>
      </section>

      <section id="contact-form" className="relative scroll-mt-28 border-t border-white/8 py-16">
        <ContactPublicContent headingAs="h2" />
      </section>
    </main>
  );
}
