export function ProductImage({ src, alt, size = "md" }: { src?: string | null; alt: string; size?: "sm" | "md" | "lg" }) {
  if (!src) {
    return (
      <div className={`product-image product-image-${size} placeholder`} aria-label="No product image">
        <span>DY</span>
      </div>
    );
  }

  return (
    <img
      className={`product-image product-image-${size}`}
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
