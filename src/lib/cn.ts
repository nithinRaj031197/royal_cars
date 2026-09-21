import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names, with later Tailwind utilities beating earlier ones.
 *
 * `clsx` handles conditionals; `tailwind-merge` resolves conflicts, so a
 * component's default `p-4` can be overridden by a caller's `p-6` instead of
 * both landing in the class list and the winner depending on CSS order.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
