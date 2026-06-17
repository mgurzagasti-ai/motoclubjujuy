import Link from "next/link";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";

type ConstructionPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function formatSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function ConstructionPage({ params }: ConstructionPageProps) {
  const { slug } = await params;
  const pageTitle = formatSlug(slug) || "Nueva pagina";

  return (
    <>
      <Navbar />
      <main className="container">
        <section className="construction-page">
          <div className="construction-badge">Proximamente</div>
          <h1 className="section-title">
            <span>{pageTitle}</span> en construccion
          </h1>
          <p>
            Esta seccion ya quedo enlazada desde el menu, pero todavia no tiene contenido publicado.
            Cuando quieras, la armamos y la dejamos lista.
          </p>
          <Link className="btn btn-primary" href="/#inicio">
            Volver al inicio
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
