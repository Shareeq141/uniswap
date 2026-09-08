import { supabase } from "./supabase";

export async function fetchWishlistListingIds(userId: string) {
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("listing_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return {
    data: (data || []).map((item) => item.listing_id as string),
    error,
  };
}

export async function addWishlistItem(userId: string, listingId: string) {
  return supabase.from("wishlist_items").insert({
    user_id: userId,
    listing_id: listingId,
  });
}

export async function removeWishlistItem(userId: string, listingId: string) {
  return supabase
    .from("wishlist_items")
    .delete()
    .eq("user_id", userId)
    .eq("listing_id", listingId);
}
