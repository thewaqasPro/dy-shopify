import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">DY</div>
          <div>
            <strong>DY Inventory</strong>
            <span>Boss Logics → Shopify</span>
          </div>
          <span>{session.email}</span>
        </div>
        <nav className="nav">
          <Link href="/">Dashboard</Link>
          <Link href="/products">Products</Link>
          <Link href="/runs">Sync runs</Link>
          <Link href="/settings">Settings</Link>
          <form action="/api/logout" method="post">
            <button className="logout" type="submit">Log out</button>
          </form>
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
