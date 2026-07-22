import { Star } from "lucide-react";
import { useState } from "react";

interface StarRatingProps {
  value: number;
  onChange?: (score: number) => void;
  readonly?: boolean;
}

export function StarRating({ value, onChange, readonly = false }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const displayValue = hoverValue !== null ? hoverValue : value;
  const maxStars = 10;

  const handleClick = (score: number) => {
    if (!readonly && onChange) {
      onChange(score);
    }
  };

  const handleMouseEnter = (score: number) => {
    if (!readonly) {
      setHoverValue(score);
    }
  };

  const handleMouseLeave = () => {
    if (!readonly) {
      setHoverValue(null);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxStars }, (_, i) => {
        const starValue = i + 1;
        const isFilled = starValue <= displayValue;

        return (
          <button
            key={starValue}
            type="button"
            onClick={() => handleClick(starValue)}
            onMouseEnter={() => handleMouseEnter(starValue)}
            onMouseLeave={handleMouseLeave}
            disabled={readonly}
            className={`transition-colors ${
              readonly ? "cursor-default" : "cursor-pointer hover:scale-110"
            }`}
            aria-label={`Rate ${starValue} out of 10`}
          >
            <Star
              size={20}
              className={
                isFilled
                  ? "fill-sx-accent stroke-sx-accent"
                  : "stroke-sx-border"
              }
            />
          </button>
        );
      })}
      <span className="ml-2 text-sm text-sx-fg-muted">
        {displayValue.toFixed(1)} / 10
      </span>
    </div>
  );
}
