import Link from "next/link";
import { AdminPanel } from "@/components/admin-panel";

export default function AdminPage() {
  return (
    <main className="container admin-page-shell">
      <div className="admin-topbar">
        <Link className="btn btn-secondary" href="/">
          Volver al sitio
        </Link>
      </div>
      <AdminPanel />
    </main>
  );
}
