import Image from "next/image";
import Link from "next/link";

const navItems = [
  { href: "/#inicio", label: "Inicio" },
  { href: "/#evento", label: "Evento 2026" },
  { href: "/#quienes", label: "Quiénes somos" },
  { href: "/#fotos", label: "Galería" },
  { href: "/admin", label: "Admin" },
];

export function Navbar() {
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
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
