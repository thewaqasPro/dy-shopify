import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section className="card">
        <h1>Not found</h1>
        <p className="helper">The page or record could not be found.</p>
        <Link className="btn" href="/">Back to dashboard</Link>
      </section>
    </main>
  );
}
