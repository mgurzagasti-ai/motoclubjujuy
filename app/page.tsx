import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { PublicSections } from "@/components/public-sections";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="container">
        <PublicSections />
      </main>
      <Footer />
    </>
  );
}
