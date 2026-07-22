import { Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";

interface SearchInputProps {
  defaultValue?: string;
  onSubmit?: (query: string) => void;
}

export function SearchInput({ defaultValue = "", onSubmit }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get("q") as string;

    if (onSubmit) {
      onSubmit(query);
    } else {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <div className="relative flex items-center">
        <Search
          className="absolute left-4 text-sx-fg-subtle"
          size={18}
        />
        <input
          ref={inputRef}
          type="text"
          name="q"
          defaultValue={defaultValue}
          placeholder="Search skills..."
          className="w-full rounded-lg border border-sx-border bg-sx-bg-elevated py-3 pl-11 pr-16 font-mono text-sm text-sx-fg placeholder:text-sx-fg-muted focus:border-sx-accent focus:outline-none"
        />
        <kbd className="absolute right-4 rounded border border-sx-border bg-sx-bg px-2 py-0.5 font-mono text-xs text-sx-fg-subtle">
          /
        </kbd>
      </div>
    </form>
  );
}
