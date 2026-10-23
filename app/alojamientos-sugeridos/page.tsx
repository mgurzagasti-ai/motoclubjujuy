"use client";

import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import Image from "next/image";
import { useState } from "react";
import { imageUrl } from "@/lib/public-content";
import { useMotoclubContent } from "@/lib/use-motoclub-content";

export default function SuggestedLodgingPage() {
  const { siteSettings } = useMotoclubContent();
  const [failedImage, setFailedImage] = useState("");
  const title = siteSettings.lodgingTitle ?? "Alojamientos sugeridos";
  const description = siteSettings.lodgingDescription ?? "Consultá las opciones de alojamiento para el encuentro.";
  const linkUrl = siteSettings.lodgingLinkUrl?.trim() || "";
  const linkLabel = siteSettings.lodgingLinkLabel ?? "Ver alojamientos sugeridos";
  const lodgingImage = imageUrl(siteSettings.lodgingImageUrl);
  return (
    <>
      <Navbar />
      <main className="container">
        <section className="embedded-page-shell">
          <div className="embedded-page-head">
            <div>
              {(siteSettings.lodgingEyebrow ?? "6to Motoencuentro Jujuy").trim() ? <div className="eyebrow">{siteSettings.lodgingEyebrow ?? "6to Motoencuentro Jujuy"}</div> : null}
              {title.trim() ? <h1 className="section-title">{title}</h1> : null}
            </div>
            {linkUrl && linkLabel.trim() ? <a
              className="btn btn-secondary"
              href={linkUrl}
              target="_blank"
              rel="noreferrer"
            >
              {linkLabel}
            </a> : null}
          </div>
          {(description.trim() || (lodgingImage && failedImage !== lodgingImage) || (linkUrl && linkLabel.trim())) ? <article className="embedded-page-fallback">
            {description.trim() ? <p>{description}</p> : null}
            {lodgingImage && failedImage !== lodgingImage ? <Image src={lodgingImage} alt={title} width={900} height={600} style={{ maxWidth: "100%", height: "auto" }} unoptimized onError={() => setFailedImage(lodgingImage)} /> : null}
            {linkUrl && linkLabel.trim() ? <a
              className="btn btn-primary"
              href={linkUrl}
              target="_blank"
              rel="noreferrer"
            >
              {linkLabel}
            </a> : null}
          </article> : null}
        </section>
      </main>
      <Footer />
    </>
  );
}
