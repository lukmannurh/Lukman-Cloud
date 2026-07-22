import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { createAuth } from "~/lib/auth/auth-server";

function getAuth(context: LoaderFunctionArgs["context"]) {
  return createAuth(context.cloudflare.env.DB, context.cloudflare.env);
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  return getAuth(context).handler(request);
}

export async function action({ request, context }: ActionFunctionArgs) {
  return getAuth(context).handler(request);
}
