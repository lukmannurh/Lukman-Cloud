import { useState } from "react";
import { useFetcher } from "react-router";

interface ReviewFormProps {
  skillSlug: string;
  onSubmit?: () => void;
}

export function ReviewForm({ skillSlug, onSubmit }: ReviewFormProps) {
  const [content, setContent] = useState("");
  const fetcher = useFetcher();

  const maxLength = 2000;
  const charCount = content.length;
  const isSubmitting = fetcher.state === "submitting";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || charCount > maxLength || isSubmitting) return;

    fetcher.submit(
      { content: content.trim() },
      {
        method: "post",
        action: `/api/skills/${skillSlug}/review`,
        encType: "application/json",
      }
    );

    setContent("");
    onSubmit?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your experience with this skill..."
          className="w-full rounded-lg border border-sx-border bg-sx-bg px-4 py-3 text-sx-fg placeholder:text-sx-fg-muted focus:border-sx-accent focus:outline-none focus:ring-1 focus:ring-sx-accent"
          rows={4}
          maxLength={maxLength}
          disabled={isSubmitting}
        />
        <div className="mt-1 flex items-center justify-between text-xs">
          <span
            className={
              charCount > maxLength ? "text-red-500" : "text-sx-fg-muted"
            }
          >
            {charCount} / {maxLength} characters
          </span>
        </div>
      </div>
      <button
        type="submit"
        disabled={!content.trim() || charCount > maxLength || isSubmitting}
        className="rounded-lg bg-sx-accent px-6 py-2 text-sm font-medium text-sx-bg transition-colors hover:bg-sx-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Submitting..." : "Submit Review"}
      </button>
    </form>
  );
}
