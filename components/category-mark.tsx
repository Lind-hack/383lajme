import { CATEGORY_ICONS } from "@/lib/category-icons";
import { normalizeCategory } from "@/lib/category-map";

/**
 * A section's mark on its own, coloured by the surrounding `color` (line icons
 * take currentColor, the flag shapes are masked with it). Decorative: the
 * section's name always sits next to it.
 */
export default function CategoryMark({ category, size = 16 }: { category: string; size?: number }) {
  const Icon = CATEGORY_ICONS[normalizeCategory(category)];
  if (typeof Icon === "string") {
    return (
      <span
        aria-hidden
        className="category-mark-shape"
        style={{ width: size, height: size, ["--shape" as string]: `url("${Icon}")` }}
      />
    );
  }
  return <Icon aria-hidden size={size} strokeWidth={2.2} />;
}
