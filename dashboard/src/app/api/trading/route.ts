/**
 * Alpaca paper trading API proxy.
 *
 * GET  /api/trading?action=account
 * GET  /api/trading?action=positions
 * GET  /api/trading?action=orders
 * POST /api/trading   body: { action: "order", ...orderParams }
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getAccount,
  getPositions,
  getOrders,
  submitOrder,
  isConfigured,
} from "@/lib/alpaca";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Alpaca not configured" }, { status: 503 });
  }
  const action = req.nextUrl.searchParams.get("action");
  if (action === "account") return NextResponse.json(await getAccount());
  if (action === "positions") return NextResponse.json(await getPositions());
  if (action === "orders") return NextResponse.json(await getOrders());
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Alpaca not configured" }, { status: 503 });
  }
  const body = await req.json();
  const { action, ...order } = body;
  if (action !== "order") {
    return NextResponse.json({ error: "Only action=order supported" }, { status: 400 });
  }
  try {
    const result = await submitOrder(order);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
