import { Heart } from "lucide-react";

type WishlistButtonProps = {
  saved: boolean;
  loading?: boolean;
  onToggle: () => void;
  className?: string;
};

export default function WishlistButton({ saved, loading = false, onToggle, className = "" }: WishlistButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
      aria-pressed={saved}
      className={`inline-flex items-center justify-center rounded-full transition disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      <Heart size={18} className={saved ? "fill-red-500 text-red-500" : ""} />
    </button>
  );
}
