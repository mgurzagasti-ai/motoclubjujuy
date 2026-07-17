import { Footer } from "@/components/footer";
import { IntroPresentation } from "@/components/intro-presentation";
import { Navbar } from "@/components/navbar";
import { PublicSections } from "@/components/public-sections";

export default function HomePage() {
  return (
    <>
      <IntroPresentation />
      <Navbar />
      <main className="container" id="sitio">
        <PublicSections />
      </main>
      <Footer />
    </>
  );
}
