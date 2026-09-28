import { ChartNoAxesColumnIncreasing, Clapperboard, Cpu, Earth, Trophy, type LucideIcon } from "lucide-react";
import type { NavCategory } from "@/lib/category-map";

/**
 * Each section's mark, shared by the category row under the nav, "Kalo te"
 * and the Top 5 chips so a section is recognised by the same shape everywhere.
 *
 * Kosovë and Shqipëri use the shapes from their public-domain flags (the map
 * and the eagle, in /public/images/categories), tinted through a CSS mask so
 * they take the section colour like the line icons do. Render a string entry
 * as a masked span; see CategoryMark.
 */
export const CATEGORY_ICONS: Record<NavCategory, LucideIcon | string> = {
  Kosovë: "/images/categories/kosove.svg",
  Shqipëri: "/images/categories/shqiperi.svg",
  Sport: Trophy,
  Teknologji: Cpu,
  Ekonomi: ChartNoAxesColumnIncreasing,
  Botë: Earth,
  Showbiz: Clapperboard,
};
