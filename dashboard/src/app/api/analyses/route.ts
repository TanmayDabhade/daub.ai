import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
    : null;

export async function GET(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const ticker = searchParams.get("ticker");
  const agent_type = searchParams.get("agent_type");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  let query = supabase
    .from("agent_analyses")
    .select("*")
    .order("analyzed_at", { ascending: false })
    .limit(limit);

  if (ticker) query = query.eq("ticker", ticker);
  if (agent_type) query = query.eq("agent_type", agent_type);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ analyses: data });
}
