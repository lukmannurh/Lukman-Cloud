interface Review {
  id: string;
  user_id: string;
  content: string;
  created_at: number | Date;
  is_agent: boolean | null;
}

interface ReviewListProps {
  reviews: Review[];
}

export function ReviewList({ reviews }: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-lg border border-sx-border bg-sx-bg-elevated p-8 text-center">
        <p className="text-sx-fg-muted">No reviews yet. Be the first to review!</p>
      </div>
    );
  }

  const formatDate = (timestamp: number | Date) => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div
          key={review.id}
          className="rounded-lg border border-sx-border bg-sx-bg-elevated p-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium text-sx-fg">
                {review.user_id.substring(0, 8)}...
              </span>
              {review.is_agent && (
                <span className="rounded-full bg-sx-accent/10 px-2 py-0.5 text-xs text-sx-accent">
                  Agent
                </span>
              )}
            </div>
            <span className="text-xs text-sx-fg-muted">
              {formatDate(review.created_at)}
            </span>
          </div>
          <p className="text-sm text-sx-fg-muted leading-relaxed">
            {review.content}
          </p>
        </div>
      ))}
    </div>
  );
}
