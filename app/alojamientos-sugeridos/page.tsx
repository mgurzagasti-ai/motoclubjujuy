import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { suggestedLodgingExternalHref } from "@/lib/site-data";

export default function SuggestedLodgingPage() {
  return (
    <>
      <Navbar />
      <main className="container">
        <section className="embedded-page-shell">
          <div className="embedded-page-head">
            <div>
              <div className="eyebrow">6to Motoencuentro Jujuy</div>
              <h1 className="section-title">
                Alojamientos <span>sugeridos</span>
              </h1>
            </div>
            <a
              className="btn btn-secondary"
              href={suggestedLodgingExternalHref}
              target="_blank"
              rel="noreferrer"
            >
              Abrir aparte
            </a>
          </div>
          <article className="embedded-page-fallback">
            <div className="construction-badge">Enlace externo</div>
            <h2>Alojamientos sugeridos</h2>
            <p>
              Google Sites no permite mostrar esta pagina embebida dentro del sitio del club.
              Para verla correctamente, abrila desde el boton oficial.
            </p>
            <a
              className="btn btn-primary"
              href={suggestedLodgingExternalHref}
              target="_blank"
              rel="noreferrer"
            >
              Ver alojamientos sugeridos
            </a>
          </article>
        </section>
      </main>
      <Footer />
    </>
  );
}
