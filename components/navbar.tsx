"use client";

import Image from "next/image";
import Link from "next/link";
import { defaultContent } from "@/lib/site-data";
import { useMotoclubContent } from "@/lib/use-motoclub-content";

export function Navbar() {
  const { content } = useMotoclubContent();
  const navItems = content.navItems.length ? content.navItems : defaultContent.navItems;

  return (
    <nav className="navbar">
      <Link className="brand" href="/#inicio">
        <Image
          src="/assets/logo-motoclub.jpeg"
          alt="Logo de Moto Club Jujuy"
          width={58}
          height={58}
          priority
        />
        <div className="brand-copy">
          <strong>Moto Club Jujuy</strong>
          <span>@motoclubjujuy.oficial</span>
        </div>
      </Link>

      <div className="nav-links">
        {navItems.map((item) => (
          <Link key={item.id} href={item.href}>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
