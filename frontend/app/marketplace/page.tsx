import { redirect } from "next/navigation";

/**
 * The marketplace was renamed to Business Ads so the section says what it is.
 * Kept as a redirect: any existing link or bookmark still lands in the right
 * place rather than on a 404.
 */
export default function MarketplacePage() {
  redirect("/business-ads");
}
