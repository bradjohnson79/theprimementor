import type { ReactNode } from "react";
import { Link } from "react-router-dom";

const spiritualLivingImage = "/about/spiritual_living.jpg";
const spiritualityNowImage = "/about/spirituality_now.jpg";
const bradJohnsonImage = "/about/bradjohnson.png";

const ancientSystems = [
  "Ancient ritual magick",
  "Western Astrology",
  "Vedic Astrology (Jyotish)",
  "Chinese Astrology / BaZi",
  "Sacred geometry systems",
  "Symbolic and consciousness philosophy",
];

const energeticDisciplines = [
  "Wild Goose Qigong",
  "Egyptian Qigong (Renpu Shu)",
  "Kundalini Yoga",
  "Hatha Yoga",
  "Kriya Yoga (initiated practitioner)",
  "Meditation & breath-centered disciplines",
];

const easternTraditions = [
  "Chinese Taoism",
  "Dream-state exploration",
  "Intuitive development",
  "Consciousness cultivation practices",
  "Energetic systems and inner transformation",
];

const evolutionItems = [
  "international workshops",
  "documentaries",
  "published books",
  "media appearances",
  "thousands of interactions with individuals seeking deeper understanding surrounding spirituality and consciousness.",
];

const broaderExploration = [
  "consciousness",
  "manifestation",
  "regeneration",
  "practical metaphysics",
  "direct spiritual insight",
  "transformation",
];

const primeMindItems = [
  "awareness",
  "emotional state",
  "identity",
  "manifestation",
  "inner coherence",
  "transformation",
];

const manifestationItems = [
  "aligned inner state",
  "emotional familiarity",
  "intentional awareness",
  "visualization",
  "embodiment",
  "dissolving resistance",
];

const mediaHighlights = [
  "100+ media appearances since 2008",
  "Featured in Newsweek Spiritual Living",
  "Featured in Newsweek Spirituality Now",
  "Featured on Vice TV’s Mr. Tachyon",
  "Featured in They Call Us Channelers documentary",
  "Featured guest on Dr. Michael Salla’s Exopolitics platform (2025–2026)",
];

const countries = ["Canada", "United States", "Mexico", "England", "South Africa", "Egypt", "Japan"];

const philosophyItems = [
  "practical spirituality",
  "conscious transformation",
  "emotional freedom",
  "awareness",
  "intuition",
  "aligned living",
  "regeneration",
  "embodied wisdom",
];

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="relative border-t border-white/8 py-14 sm:py-18">
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

function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
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

function BulletGrid({ items }: { items: string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white/70">
          {item}
        </div>
      ))}
    </div>
  );
}

function NewsweekCards() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <GlassCard>
        <img
          src={spiritualLivingImage}
          alt="Newsweek Spiritual Living cover"
          className="mx-auto h-auto max-h-[34rem] w-full rounded-2xl object-contain shadow-2xl"
          loading="lazy"
          decoding="async"
        />
        <h3 className="mt-5 text-xl font-semibold text-white">Spiritual Living</h3>
        <p className="mt-2 text-sm leading-6 text-white/62">Featured in Newsweek Spiritual Living</p>
      </GlassCard>
      <GlassCard>
        <img
          src={spiritualityNowImage}
          alt="Newsweek Spirituality Now cover"
          className="mx-auto h-auto max-h-[34rem] w-full rounded-2xl object-contain shadow-2xl"
          loading="lazy"
          decoding="async"
        />
        <h3 className="mt-5 text-xl font-semibold text-white">Spirituality Now</h3>
        <p className="mt-2 text-sm leading-6 text-white/62">Featured in Newsweek Spirituality Now</p>
      </GlassCard>
    </div>
  );
}

export default function About() {
  return (
    <main className="relative overflow-hidden text-white">
      <section className="relative overflow-hidden border-b border-white/8 px-6 py-20 sm:py-28">
        <div className="absolute left-1/2 top-0 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-left">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/70">About Brad Johnson</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-white sm:text-6xl">
              International Metaphysical Expert, Consciousness Researcher, Speaker & Founder of The Prime Mentor
            </h1>
            <div className="mt-6 space-y-4 text-base leading-8 text-white/68">
              <p>For over 18 years, Brad Johnson has dedicated his life to the exploration of consciousness, manifestation, personal transformation, ancient spiritual systems, and the deeper mechanics of reality.</p>
              <p>As the founder of <strong className="text-white">The Prime Mentor</strong>, Brad helps individuals explore practical metaphysics, inner transformation, regeneration, and what he refers to as the <strong className="text-white">Prime Mind</strong>—a heightened state of awareness centered around alignment, intentionality, consciousness, and authentic living.</p>
              <p>Known for his grounded yet expansive approach to spirituality, Brad has spent nearly two decades researching, applying, teaching, and refining transformational methods that bridge ancient wisdom with modern consciousness work.</p>
              <p>His work explores the relationship between mind, energy, identity, intuition, manifestation, and human potential—helping people better understand how inner state influences outer experience.</p>
            </div>
            <blockquote className="mt-8 rounded-3xl border border-cyan-200/20 bg-cyan-300/10 p-5 text-xl font-semibold tracking-[-0.02em] text-cyan-50">
              Transformation happens when wisdom becomes lived experience.
            </blockquote>
          </div>
          <GlassCard className="space-y-5 bg-[radial-gradient(circle_at_top,_rgba(94,234,212,0.18),_transparent_46%),rgba(255,255,255,0.05)]">
            <img
              src={bradJohnsonImage}
              alt="Brad Johnson, international metaphysical expert"
              className="mx-auto h-auto max-h-[44rem] w-full rounded-2xl object-contain shadow-2xl"
              loading="lazy"
              decoding="async"
            />
            <NewsweekCards />
          </GlassCard>
        </div>
      </section>

      <Section id="journey" eyebrow="Section 1" title="A Journey Into Consciousness">
        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <GlassCard>
            <div className="space-y-4 text-sm leading-7 text-white/66 sm:text-base">
              <p>Brad’s journey into consciousness exploration began in <strong className="text-white">2008</strong>, sparked by a deep curiosity surrounding spirituality, human potential, and the greater nature of reality.</p>
              <p>Originally inspired through research into consciousness, extraterrestrial phenomena, and humanity’s place in a much larger universe, Brad immersed himself in meditation, self-inquiry, spiritual exploration, and expanded states of awareness.</p>
              <p>What began as curiosity eventually evolved into a life-changing path of discovery.</p>
              <p>Through years of disciplined practice, dream-state exploration, meditation, consciousness research, and spiritual study, Brad experienced profound inner shifts that inspired him to dedicate his life to helping others better understand transformation, awareness, and human potential.</p>
              <p>Rather than approaching spirituality through belief alone, Brad became deeply interested in direct experience.</p>
            </div>
          </GlassCard>
          <GlassCard>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Questions such as:</p>
            <BulletGrid items={[
              "How does consciousness shape reality?",
              "What role does inner state play in manifestation?",
              "Can awareness transform emotional suffering?",
              "Is there more to human potential than we currently understand?",
            ]} />
            <p className="mt-5 text-sm leading-7 text-white/62">became the foundation of his life’s work.</p>
          </GlassCard>
        </div>
      </Section>

      <Section id="research" eyebrow="Section 2" title="Years of Research, Practice & Ancient Study">
        <div className="space-y-5">
          <GlassCard>
            <p className="text-base leading-8 text-white/68">Over nearly two decades, Brad has immersed himself in the research and practical application of a broad range of consciousness-based, metaphysical, and ancient spiritual systems.</p>
          </GlassCard>
          <div className="grid gap-5 lg:grid-cols-3">
            <GlassCard><h3 className="mb-4 text-lg font-semibold text-white">Ancient Spiritual Systems</h3><BulletGrid items={ancientSystems} /></GlassCard>
            <GlassCard><h3 className="mb-4 text-lg font-semibold text-white">Yogic & Energetic Disciplines</h3><BulletGrid items={energeticDisciplines} /></GlassCard>
            <GlassCard><h3 className="mb-4 text-lg font-semibold text-white">Eastern Philosophy & Consciousness Traditions</h3><BulletGrid items={easternTraditions} /></GlassCard>
          </div>
          <GlassCard>
            <p className="text-base leading-8 text-white/68">Through these years of immersion, Brad developed a practical understanding of how ancient systems, consciousness principles, and transformation intersect.</p>
            <p className="mt-4 text-base leading-8 text-white/68">His work is not built solely upon philosophy.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-5">
              {["lived experience", "experimentation", "practice", "direct application", "continual refinement"].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-semibold text-white">{item}</div>
              ))}
            </div>
          </GlassCard>
        </div>
      </Section>

      <Section id="evolution" eyebrow="Section 3" title="Evolution of the Work">
        <div className="grid gap-5 lg:grid-cols-2">
          <GlassCard>
            <div className="space-y-4 text-sm leading-7 text-white/66 sm:text-base">
              <p>Throughout his career, Brad’s work has continued to evolve alongside his own personal transformation.</p>
              <p>In his earlier years, Brad became widely recognized through consciousness-based teachings, intuitive development, energetic facilitation, and channeling work connected to a multidimensional intelligence known as <strong className="text-white">Adronis</strong>.</p>
            </div>
            <div className="mt-5"><BulletGrid items={evolutionItems} /></div>
          </GlassCard>
          <GlassCard>
            <p className="text-sm leading-7 text-white/66 sm:text-base">Over time, Brad’s work naturally expanded.</p>
            <p className="mt-4 text-sm leading-7 text-white/66 sm:text-base">Rather than focusing exclusively on channeling, his approach evolved into a broader exploration of:</p>
            <div className="mt-5"><BulletGrid items={broaderExploration} /></div>
            <p className="mt-5 text-sm leading-7 text-white/66 sm:text-base">While channeling still remains part of Brad’s work and personal exploration, it is now approached as <strong className="text-white">one aspect of a much broader body of consciousness study and transformational practice</strong>.</p>
            <p className="mt-4 text-sm leading-7 text-white/66 sm:text-base">In recent years, Brad has increasingly emphasized what he describes as a more direct relationship with <strong className="text-white">Spirit Source Consciousness</strong>—an approach centered around intuition, awareness, embodiment, empowerment, and inner intelligence.</p>
            <p className="mt-4 text-sm leading-7 text-white/66 sm:text-base">Today, through <strong className="text-white">The Prime Mentor</strong>, Brad’s mission is to help individuals reconnect with their own capacity for transformation and deeper knowing.</p>
          </GlassCard>
        </div>
      </Section>

      <Section id="prime-mind" eyebrow="Section 4" title="The Prime Mind & Prime Law">
        <div className="grid gap-5 lg:grid-cols-2">
          <GlassCard>
            <p className="text-base leading-8 text-white/68">At the center of Brad’s teachings is a framework known as the <strong className="text-white">Prime Mind</strong> and <strong className="text-white">Prime Law</strong>.</p>
            <p className="mt-4 text-base leading-8 text-white/68">The Prime Mind explores the relationship between:</p>
            <div className="mt-5"><BulletGrid items={primeMindItems} /></div>
          </GlassCard>
          <GlassCard>
            <p className="text-base leading-8 text-white/68">Brad describes manifestation as a process of <strong className="text-white">materialized memory</strong>—the lived familiarity of inner experience becoming reflected through reality.</p>
            <p className="mt-4 text-base leading-8 text-white/68">Rather than emphasizing positive thinking alone, Brad teaches a practical consciousness-centered approach involving:</p>
            <div className="mt-5"><BulletGrid items={manifestationItems} /></div>
            <p className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-white">The goal is embodied transformation.</p>
          </GlassCard>
        </div>
      </Section>

      <Section id="systems" eyebrow="Section 5" title="Creator of Transformational Systems">
        <div className="grid gap-5 lg:grid-cols-3">
          <GlassCard><h3 className="text-xl font-semibold text-white">Trauma Transcendence Technique™ (2025)</h3><p className="mt-3 text-sm leading-7 text-white/64">Creator of the <strong className="text-white">Trauma Transcendence Technique™</strong>, a consciousness-based method designed to help individuals reconcile unresolved emotional conflict and trauma patterns.</p><p className="mt-3 text-sm leading-7 text-white/64">The technique has supported <strong className="text-white">hundreds of clients</strong> and later became the foundation for Brad’s self-published book released in <strong className="text-white">2025</strong>.</p></GlassCard>
          <GlassCard><h3 className="text-xl font-semibold text-white">RAYD8 Scalar Rejuvenation System</h3><p className="mt-3 text-sm leading-7 text-white/64">Inventor of the <strong className="text-white">RAYD8 Scalar Rejuvenation System</strong>, a consciousness-centered rejuvenation platform integrating immersive visuals, energetic harmonics, meditative experiences, and restorative digital wellness principles.</p></GlassCard>
          <GlassCard><h3 className="text-xl font-semibold text-white">AetherX</h3><p className="mt-3 text-sm leading-7 text-white/64">Founder of <strong className="text-white">AetherX</strong>, a platform focused on consciousness tools, transformation, energetic systems, and personal development.</p></GlassCard>
        </div>
      </Section>

      <Section id="recognition" eyebrow="Section 6" title="International Recognition & Media">
        <div className="space-y-5">
          <GlassCard><p className="text-base leading-8 text-white/68">Brad Johnson has been featured internationally across podcasts, radio, documentaries, television, speaking events, magazines, and conferences for over 18 years.</p></GlassCard>
          <NewsweekCards />
          <div className="grid gap-5 lg:grid-cols-2">
            <GlassCard><h3 className="mb-4 text-lg font-semibold text-white">Media Highlights</h3><BulletGrid items={mediaHighlights} /></GlassCard>
            <GlassCard><h3 className="mb-4 text-lg font-semibold text-white">International Speaking</h3><p className="mb-4 text-sm leading-7 text-white/64">Brad has hosted lectures, seminars, workshops, and speaking engagements in:</p><BulletGrid items={countries} /></GlassCard>
          </div>
        </div>
      </Section>

      <Section id="published" eyebrow="Section 7" title="Published Works">
        <div className="grid gap-5 lg:grid-cols-2">
          <GlassCard>
            <p className="text-base leading-8 text-white/68">Brad is the author and co-author of numerous books exploring spirituality, consciousness, manifestation, and transformation.</p>
            <h3 className="mt-5 text-lg font-semibold text-white">Featured Works</h3>
            <BulletGrid items={["Trauma Transcendence Technique (2025)", "The Reality Whisperer", "Rainbow Wisdom"]} />
          </GlassCard>
          <GlassCard>
            <h3 className="text-lg font-semibold text-white">International Publications</h3>
            <div className="mt-5 space-y-4 text-sm leading-7 text-white/66">
              <p><strong className="text-white">The Sixth Density Messenger</strong><br />Published in Tokyo, Japan through <strong className="text-white">VOICE Publications (2019)</strong></p>
              <p><strong className="text-white">Sirius Consciousness: Adronis&apos; Final Message to Humanity</strong><br />Published in Tokyo, Japan through <strong className="text-white">VOICE Publications (2021)</strong></p>
              <p>Including <strong className="text-white">two bestselling publications in Japan</strong>.</p>
            </div>
          </GlassCard>
        </div>
      </Section>

      <Section id="mission" eyebrow="Section 8" title="A Philosophy of Empowerment">
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <GlassCard>
            <p className="text-base leading-8 text-white/68">At the heart of Brad’s work is a simple yet profound belief:</p>
            <blockquote className="mt-5 rounded-3xl border border-cyan-200/20 bg-cyan-300/10 p-5 text-xl font-semibold tracking-[-0.02em] text-cyan-50">
              Every person carries the ability to reconnect with deeper intelligence, transformation, and inner wisdom.
            </blockquote>
            <p className="mt-5 text-base leading-8 text-white/68">Brad’s mission through <strong className="text-white">The Prime Mentor</strong> is not dependence.</p>
            <p className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-white">It is empowerment.</p>
          </GlassCard>
          <GlassCard>
            <p className="mb-4 text-sm leading-7 text-white/64">His work emphasizes:</p>
            <BulletGrid items={philosophyItems} />
            <p className="mt-5 text-base leading-8 text-white/68">Whether through mentoring, manifestation guidance, consciousness education, or transformational methods, Brad’s goal remains the same:</p>
            <blockquote className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-lg font-semibold text-white">
              To help people reconnect with the deeper potential that already exists within them.
            </blockquote>
          </GlassCard>
        </div>
      </Section>

      <section className="relative border-t border-white/8 px-6 py-18">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(80,120,255,0.18),_transparent_48%),rgba(255,255,255,0.055)] p-8 text-center shadow-[0_22px_70px_rgba(0,0,0,0.3)] backdrop-blur-xl">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-200/62">Continue the Journey</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">Continue the Journey</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/68">Whether you are exploring manifestation, consciousness, transformation, intuition, regeneration, dream work, or spiritual understanding, Brad welcomes you to explore the evolving work of <strong className="text-white">The Prime Mentor</strong>.</p>
          <p className="mt-5 text-xl font-semibold text-white">The journey inward is often the beginning of the greatest transformation.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/media" className="rounded-full bg-cyan-200 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white">Explore Media Kit</Link>
            <a href="/#contact" className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Contact The Prime Mentor</a>
          </div>
        </div>
      </section>
    </main>
  );
}
