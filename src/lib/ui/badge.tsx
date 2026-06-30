export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone =
    normalized.includes("success") ||
    normalized.includes("synced") ||
    normalized.includes("active") ||
    normalized.includes("apply") ||
    normalized.includes("in stock")
      ? "success"
      : normalized.includes("fail") || normalized.includes("error") || normalized.includes("out")
        ? "error"
        : normalized.includes("pending") || normalized.includes("missing") || normalized.includes("dry") || normalized.includes("skip") || normalized.includes("draft")
          ? "warn"
          : "";
  return <span className={`badge ${tone}`}>{value}</span>;
}
