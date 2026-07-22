import { Link } from "react-router";
import { LogOut } from "lucide-react";
import { signIn, signOut, useSession } from "~/lib/auth/auth-client";

export function AuthButton() {
  const { data: session, isPending } = useSession();

  const handleSignIn = async () => {
    const result = await signIn.social({
      provider: "github",
      callbackURL: "/",
    });
    if (result.error) {
      console.error("Sign-in error:", result.error);
    }
  };

  if (isPending) {
    return (
      <button
        disabled
        className="rounded-lg bg-sx-bg-muted px-4 py-2 text-sm text-sx-fg-muted"
      >
        Loading...
      </button>
    );
  }

  if (session) {
    return (
      <div className="flex items-center gap-4">
        <Link
          to="/profile"
          className="text-sm text-sx-fg-muted transition-colors hover:text-sx-fg"
        >
          {session.user.name || session.user.email}
        </Link>
        <button
          onClick={() => signOut()}
          className="rounded-lg p-2 text-sx-fg-muted transition-colors hover:text-red-400"
          aria-label="Sign Out"
          title="Sign Out"
        >
          <LogOut size={16} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleSignIn}
      className="rounded-lg bg-sx-accent px-4 py-2 text-sm text-white hover:bg-sx-accent-hover"
    >
      Sign In with GitHub
    </button>
  );
}
