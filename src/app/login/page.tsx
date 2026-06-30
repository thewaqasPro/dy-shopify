import { redirect } from "next/navigation";
import { getEnv } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");
  const env = getEnv();

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section className="card" style={{ width: "100%", maxWidth: 520 }}>
        <div className="brand" style={{ marginBottom: 24 }}>
          <strong>DY Shopify Inventory</strong>
          <span>Secure admin login</span>
        </div>
        <LoginForm defaultEmail={env.ADMIN_EMAIL} />
      </section>
    </main>
  );
}
