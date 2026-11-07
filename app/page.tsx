import QuasarHero from "@/components/QuasarHero";

// Everything below the hero is placeholder content — replace it with your own sections.
const features = [
  {
    title: "Live, not a video",
    body: "The black hole is ray-marched on your GPU every frame — nothing is pre-rendered.",
    accent: "text-neon-cyan",
  },
  {
    title: "Segmented energy rings",
    body: "Seven counter-rotating neon rings on a 30° tilted disk, with pulses racing along them.",
    accent: "text-neon-pink",
  },
  {
    title: "Laser jets",
    body: "Twin beams on the same tilted axis, with charge pulses, sparks and arcade-style bursts.",
    accent: "text-neon-orange",
  },
];

export default function Home() {
  return (
    <main>
      <QuasarHero scrollTo="#content" />

      <section id="content" className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-32">
        <p className="font-mono text-xs tracking-[0.4em] text-neon-cyan/80">ABOUT THE PROJECT</p>
        <h2 className="mt-4 max-w-3xl font-display text-3xl font-bold leading-tight sm:text-5xl">
          A secret hiding in plain sight.
        </h2>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-foreground/70">
          Placeholder copy — this is the rest of your page. The hero above scrolls away like any other
          section, and the quasar stops rendering as soon as it leaves the screen.
        </p>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.title}
              className="rounded-sm border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-neon-cyan/50"
            >
              <h3 className={`font-display text-lg font-semibold tracking-wide ${f.accent}`}>{f.title}</h3>
              <p className="mt-3 leading-7 text-foreground/65">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-10 text-center font-mono text-xs tracking-[0.3em] text-foreground/40">
        SECRET QUASAR
      </footer>
    </main>
  );
}
