import { toNodeHandler } from "better-auth/node";
import { auth } from "../../src/lib/auth";

export default toNodeHandler(auth);
