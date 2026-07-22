import { createAuth } from "./auth-server";
import { redirect } from "react-router";

export async function getSession(request: Request, env: Env) {
  const auth = createAuth(env.DB, env);
  const session = await auth.api.getSession({ headers: request.headers });
  return session;
}

export async function requireAuth(request: Request, env: Env) {
  const session = await getSession(request, env);
  if (!session) throw redirect("/api/auth/signin/github");
  return session;
}
