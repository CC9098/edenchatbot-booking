import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { syncKnowledgeCardsFromArticles } from "../lib/knowledge-card-sync";

dotenv.config({ path: ".env.local" });
dotenv.config();

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    if (arg.includes("=")) {
      const [key, value] = arg.split("=", 2);
      out[key.slice(2)] = value;
      continue;
    }
    if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      out[arg.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const limit = Number(args.limit || "500");
  const actorUserId = args.actorUserId || undefined;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const summary = await syncKnowledgeCardsFromArticles({
    supabase,
    actorUserId,
    limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 500,
  });

  console.log("[sync-knowledge-cards] completed");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("[sync-knowledge-cards] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
