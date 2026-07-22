import { Heart } from "lucide-react";
import { useEffect } from "react";
import { useFetcher } from "react-router";

interface FavoriteButtonProps {
  skillSlug: string;
  isFavorited: boolean;
  onToggle?: (favorited: boolean) => void;
}

export function FavoriteButton({
  skillSlug,
  isFavorited,
  onToggle,
}: FavoriteButtonProps) {
  const fetcher = useFetcher<{ favorited?: boolean; error?: string }>();

  // Revert optimistic UI if server returned an error
  useEffect(() => {
    if (fetcher.data?.error) {
      onToggle?.(!isFavorited);
    }
  }, [fetcher.data]);

  const handleClick = () => {
    fetcher.submit(null, {
      method: "post",
      action: `/api/skills/${skillSlug}/favorite`,
    });
    onToggle?.(!isFavorited);
  };

  const isLoading = fetcher.state !== "idle";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className="flex items-center gap-2 rounded-lg border border-sx-border bg-sx-bg px-4 py-2 text-sm font-medium transition-colors hover:bg-sx-bg-hover disabled:opacity-50"
      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart
        size={18}
        className={isFavorited ? "fill-sx-accent stroke-sx-accent" : "stroke-sx-fg"}
      />
      <span>{isFavorited ? "Favorited" : "Favorite"}</span>
    </button>
  );
}
