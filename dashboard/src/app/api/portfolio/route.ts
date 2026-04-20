import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
    : null;

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const [snapshotRes, tradesRes] = await Promise.all([
    supabase
      .from("portfolio_snapshots")
      .select("*")
      .order("snapshot_at", { ascending: false })
      .limit(1),
    supabase
      .from("trades")
      .select("*")
      .eq("status", "open"),
  ]);

  return NextResponse.json({
    snapshot: snapshotRes.data?.[0] ?? null,
    positions: tradesRes.data ?? [],
  });
}
