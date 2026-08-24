import type { CSSProperties } from "react";
import { sportBrandFor, type SportBrand } from "@/lib/tregu-sport-branding";

export default function SportBrandMark({
  brand: supplied,
  brandKey,
  size = "md",
  showLabel = false,
}: {
  brand?: SportBrand | null;
  brandKey?: string | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}) {
  const brand = supplied ?? sportBrandFor(brandKey);
  if (!brand) return null;
  return (
    <span
      className="tregu-brand-mark"
      data-size={size}
      style={{
        "--brand-accent": brand.accent,
        "--brand-tint": brand.tint,
      } as CSSProperties}
      title={brand.label}
    >
      {brand.logo ? (
        // Brand images are decorative beside a visible league label.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logo} alt="" aria-hidden />
      ) : (
        <b aria-hidden>{brand.shortLabel}</b>
      )}
      {showLabel && <span>{brand.label}</span>}
    </span>
  );
}
