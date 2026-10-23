"use client";

import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import Image from "next/image";
import { suggestedLodgingExternalHref } from "@/lib/site-data";
import { useMotoclubContent } from "@/lib/use-motoclub-content";

export default function SuggestedLodgingPage() {
  const { siteSettings } = useMotoclubContent();
  const title = siteSettings.lodgingTitle || "Alojamientos sugeridos";
  const description = siteSettings.lodgingDescription || "Consultá las opciones de alojamiento para el encuentro.";
  const linkUrl = siteSettings.lodgingLinkUrl || suggestedLodgingExternalHref;
  const linkLabel = siteSettings.lodgingLinkLabel || "Ver alojamientos sugeridos";
  return (
    <>
      <Navbar />
      <main className="container">
        <section className="embedded-page-shell">
          <div className="embedded-page-head">
            <div>
              <div className="eyebrow">{siteSettings.lodgingEyebrow || "6to Motoencuentro Jujuy"}</div>
              <h1 className="section-title">{title}</h1>
            </div>
            <a
              className="btn btn-secondary"
              href={linkUrl}
              target="_blank"
              rel="noreferrer"
            >
              {linkLabel}
            </a>
          </div>
          <article className="embedded-page-fallback">
            <h2>{title}</h2>
            <p>{description}</p>
            {siteSettings.lodgingImageUrl ? <Image src={siteSettings.lodgingImageUrl} alt={title} width={900} height={600} style={{ maxWidth: "100%", height: "auto" }} unoptimized /> : null}
            <a
              className="btn btn-primary"
              href={linkUrl}
              target="_blank"
              rel="noreferrer"
            >
              {linkLabel}
            </a>
          </article>
        </section>
      </main>
      <Footer />
    </>
  );
}
