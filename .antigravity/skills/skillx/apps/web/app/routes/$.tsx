import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center px-4">
      <div className="text-center">
        <pre className="font-mono text-6xl font-bold text-sx-fg-muted">404</pre>
        <h1 className="mt-4 font-mono text-2xl font-bold text-sx-fg">
          Page Not Found
        </h1>
        <p className="mt-2 text-sx-fg-muted">
          The page you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-lg bg-sx-accent px-6 py-2 font-mono text-sm font-semibold text-white transition-colors hover:bg-sx-accent/90"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
