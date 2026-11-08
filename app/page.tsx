import QuasarHero from "@/components/QuasarHero";
import AboutSection from "@/components/about/AboutSection";
import StoryModeSection from "@/components/projects/story-mode/StoryModeSection";
import AsbSection from "@/components/projects/awkward-silence-button/AsbSection";

export default function Home() {
  return (
    <main>
      <QuasarHero scrollTo="#content" />

      <AboutSection />

      <StoryModeSection />

      <AsbSection />

      <footer className="border-t border-white/10 px-6 py-10 text-center font-mono text-xs tracking-[0.3em] text-foreground/40">
        SECRET QUASAR
      </footer>
    </main>
  );
}
