"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section className="card" style={{ maxWidth: 760 }}>
        <h1>Something went wrong</h1>
        <p className="error">{error.message}</p>
        <button className="btn" onClick={() => reset()}>Try again</button>
      </section>
    </main>
  );
}
