import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functionsFor } from "@/lib/inngest/registry";

// Inngest calls this endpoint to run background functions. Requests are
// signed with this project's INNGEST_SIGNING_KEY in production.
export const { GET, POST, PUT } = serve({ client: inngest, functions: functionsFor(process.env) });
