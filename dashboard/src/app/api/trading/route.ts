/**
 * Sim broker — replaces Alpaca paper trading.
 *
 * State lives in two Supabase tables (created by setup_db.sql):
 *   sim_account   — single-row ledger (cash, realized_pnl, peak_equity)
 *   sim_positions — one row per open position
 * Fills are recorded in the existing `trades` table (signal_id = null for manual orders).
 *
 * GET  /api/trading?action=account
 * GET  /api/trading?action=positions
 * GET  /api/trading?action=orders[&ticker=NVDA]
 * GET  /api/trading?action=fill_pending   (poll to fill limit orders)
 * POST /api/trading   { action:"order", symbol, qty, side, type, limit_price? }
 * DELETE /api/trading?id=<trade-id>       (cancel pending limit order)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBulkQuotes } from "@/lib/yahoo";

export const dynamic = "force-dynamic";

const SLIPPAGE_BPS = parseFloat(process.env.SIM_SLIPPAGE_BPS ?? "5");
const INITIAL_CAPITAL = parseFloat(process.env.SIM_INITIAL_CAPITAL ?? "100000");

function sb() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

async function ensureAccount(client: ReturnType<typeof createClient>) {
  const { data } = await client.from("sim_account").select("*").eq("id", 1).single();
  if (data) return data as SimAccountRow;
  const fresh = {
    id: 1,
    cash: INITIAL_CAPITAL,
    realized_pnl: 0,
    initial_capital: INITIAL_CAPITAL,
    peak_equity: INITIAL_CAPITAL,
  };
  await client.from("sim_account").insert(fresh);
  return fresh as SimAccountRow;
}

type SimAccountRow = {
  id: number;
  cash: number;
  realized_pnl: number;
  initial_capital: number;
  peak_equity: number;
};

type SimPositionRow = {
  ticker: string;
  qty: number;
  avg_entry_price: number;
};

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const client = sb();
  if (!client) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const action = req.nextUrl.searchParams.get("action");
  const ticker = (req.nextUrl.searchParams.get("ticker") ?? "").toUpperCase();

  // ── account ─────────────────────────────────────────────────────────────
  if (action === "account") {
    const account = await ensureAccount(client);
    const { data: positions } = await client.from("sim_positions").select("*");
    const rows = (positions ?? []) as SimPositionRow[];

    let positionValue = 0;
    if (rows.length) {
      const quotes = await getBulkQuotes(rows.map((p) => p.ticker));
      const pm = new Map(quotes.map((q) => [q.symbol, q.regularMarketPrice]));
      positionValue = rows.reduce((s, p) => s + p.qty * (pm.get(p.ticker) ?? p.avg_entry_price), 0);
    }

    const equity = account.cash + positionValue;
    const newPeak = Math.max(account.peak_equity, equity);
    if (newPeak > account.peak_equity) {
      await client.from("sim_account").update({ peak_equity: newPeak }).eq("id", 1);
    }

    return NextResponse.json({
      cash: account.cash,
      equity,
      position_value: positionValue,
      initial_capital: account.initial_capital,
      realized_pnl: account.realized_pnl,
      total_return_pct: ((equity - account.initial_capital) / account.initial_capital) * 100,
      drawdown_pct: newPeak > 0 ? ((equity - newPeak) / newPeak) * 100 : 0,
    });
  }

  // ── positions ────────────────────────────────────────────────────────────
  if (action === "positions") {
    const { data: positions } = await client.from("sim_positions").select("*");
    const rows = (positions ?? []) as SimPositionRow[];
    if (!rows.length) return NextResponse.json({ positions: [] });

    const quotes = await getBulkQuotes(rows.map((p) => p.ticker));
    const pm = new Map(quotes.map((q) => [q.symbol, q]));

    return NextResponse.json({
      positions: rows.map((p) => {
        const q = pm.get(p.ticker);
        const price = q?.regularMarketPrice ?? p.avg_entry_price;
        const mv = p.qty * price;
        const cost = p.qty * p.avg_entry_price;
        return {
          ticker: p.ticker,
          qty: p.qty,
          avg_entry_price: p.avg_entry_price,
          current_price: price,
          change_pct: q?.regularMarketChangePercent ?? 0,
          market_value: mv,
          unrealized_pnl: mv - cost,
          unrealized_pnl_pct: ((price - p.avg_entry_price) / p.avg_entry_price) * 100,
        };
      }),
    });
  }

  // ── orders ───────────────────────────────────────────────────────────────
  if (action === "orders") {
    // fire-and-forget: fill any pending limits before returning
    fillPendingLimits(client).catch(() => {});

    let query = client
      .from("trades")
      .select("*")
      .is("signal_id", null)
      .order("opened_at", { ascending: false })
      .limit(100);
    if (ticker) query = query.eq("ticker", ticker);
    const { data } = await query;
    return NextResponse.json({ orders: data ?? [] });
  }

  // ── explicit fill_pending ─────────────────────────────────────────────────
  if (action === "fill_pending") {
    const n = await fillPendingLimits(client);
    return NextResponse.json({ filled: n });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const client = sb();
  if (!client) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = await req.json();
  const { action, symbol, qty, side, type: orderType, limit_price } = body;

  if (action !== "order") {
    return NextResponse.json({ error: "Only action=order is supported" }, { status: 400 });
  }
  if (!symbol || !qty || !side) {
    return NextResponse.json({ error: "symbol, qty, side are required" }, { status: 400 });
  }

  const tk = (symbol as string).toUpperCase();
  const quantity = parseInt(String(qty));
  const isBuy = (side as string).toLowerCase() === "buy";
  const isMarket = (orderType ?? "market") === "market";
  const slip = SLIPPAGE_BPS / 10000;

  const account = await ensureAccount(client);

  if (isMarket) {
    const quotes = await getBulkQuotes([tk]);
    const q = quotes[0];
    if (!q) return NextResponse.json({ error: `No quote for ${tk}` }, { status: 400 });

    const fillPrice = isBuy
      ? q.regularMarketPrice * (1 + slip)
      : q.regularMarketPrice * (1 - slip);

    if (isBuy) {
      const cost = quantity * fillPrice;
      if (account.cash < cost) {
        return NextResponse.json({
          error: `Insufficient cash — need $${cost.toFixed(2)}, have $${account.cash.toFixed(2)}`,
        }, { status: 400 });
      }
      await client.from("sim_account").update({
        cash: account.cash - cost,
        peak_equity: Math.max(account.peak_equity, account.cash - cost + quantity * fillPrice),
        updated_at: new Date().toISOString(),
      }).eq("id", 1);
      await upsertPosition(client, tk, quantity, fillPrice);
    } else {
      const { data: pos } = await client.from("sim_positions").select("*").eq("ticker", tk).single();
      const p = pos as SimPositionRow | null;
      if (!p) return NextResponse.json({ error: `No position in ${tk}` }, { status: 400 });
      if (p.qty < quantity) return NextResponse.json({ error: `Only ${p.qty} shares available` }, { status: 400 });

      const proceeds = quantity * fillPrice;
      const realizedPnl = quantity * (fillPrice - p.avg_entry_price);
      await client.from("sim_account").update({
        cash: account.cash + proceeds,
        realized_pnl: account.realized_pnl + realizedPnl,
        updated_at: new Date().toISOString(),
      }).eq("id", 1);
      await closePosition(client, tk, quantity, p);
    }

    const { data: trade } = await client.from("trades").insert({
      ticker: tk,
      direction: isBuy ? "long" : "short",
      quantity,
      entry_price: fillPrice,
      status: "open",
      alpaca_order_id: JSON.stringify({ type: "market", manual: true }),
    }).select().single();

    return NextResponse.json({
      id: (trade as Record<string, unknown> | null)?.id,
      status: "filled",
      fill_price: fillPrice,
      qty: quantity,
      ticker: tk,
      side,
    });
  }

  // limit order
  if (!limit_price) {
    return NextResponse.json({ error: "limit_price required for limit orders" }, { status: 400 });
  }
  const lp = parseFloat(String(limit_price));

  // For buy-limit, pre-check cash
  if (isBuy && account.cash < quantity * lp) {
    return NextResponse.json({
      error: `Insufficient cash for limit order — need $${(quantity * lp).toFixed(2)}, have $${account.cash.toFixed(2)}`,
    }, { status: 400 });
  }

  const { data: trade } = await client.from("trades").insert({
    ticker: tk,
    direction: isBuy ? "long" : "short",
    quantity,
    entry_price: null,
    exit_price: lp,      // temporarily store limit price here while pending
    status: "pending",
    alpaca_order_id: JSON.stringify({ type: "limit", limit_price: lp, manual: true }),
  }).select().single();

  return NextResponse.json({
    id: (trade as Record<string, unknown> | null)?.id,
    status: "pending",
    limit_price: lp,
    qty: quantity,
    ticker: tk,
    side,
  });
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const client = sb();
  if (!client) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data } = await client
    .from("trades")
    .update({ status: "cancelled", closed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .single();

  if (!data) return NextResponse.json({ error: "Order not found or already filled" }, { status: 404 });
  return NextResponse.json({ cancelled: true, id });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function upsertPosition(
  client: ReturnType<typeof createClient>,
  ticker: string,
  qty: number,
  fillPrice: number,
) {
  const { data: existing } = await client.from("sim_positions").select("*").eq("ticker", ticker).single();
  const ex = existing as SimPositionRow | null;
  if (ex) {
    const newQty = ex.qty + qty;
    const newAvg = (ex.avg_entry_price * ex.qty + fillPrice * qty) / newQty;
    await client.from("sim_positions").update({
      qty: newQty,
      avg_entry_price: newAvg,
      updated_at: new Date().toISOString(),
    }).eq("ticker", ticker);
  } else {
    await client.from("sim_positions").insert({ ticker, qty, avg_entry_price: fillPrice });
  }
}

async function closePosition(
  client: ReturnType<typeof createClient>,
  ticker: string,
  qty: number,
  pos: SimPositionRow,
) {
  const remaining = pos.qty - qty;
  if (remaining <= 0) {
    await client.from("sim_positions").delete().eq("ticker", ticker);
  } else {
    await client.from("sim_positions").update({
      qty: remaining,
      updated_at: new Date().toISOString(),
    }).eq("ticker", ticker);
  }
}

async function fillPendingLimits(client: ReturnType<typeof createClient>): Promise<number> {
  const { data: pending } = await client
    .from("trades")
    .select("*")
    .eq("status", "pending")
    .is("signal_id", null);

  if (!pending?.length) return 0;

  type PendingTrade = {
    id: string;
    ticker: string;
    direction: string;
    quantity: number;
    exit_price: number; // limit price stored here
  };

  const rows = pending as PendingTrade[];
  const tickers = [...new Set(rows.map((o) => o.ticker))];
  const quotes = await getBulkQuotes(tickers);
  const pm = new Map(quotes.map((q) => [q.symbol, q.regularMarketPrice]));

  const slip = SLIPPAGE_BPS / 10000;
  let filled = 0;

  for (const order of rows) {
    const currentPrice = pm.get(order.ticker);
    if (!currentPrice) continue;
    const limitPrice = order.exit_price;
    const isBuy = order.direction === "long";

    // Buy limit fills when market price <= limit; sell limit fills when >= limit
    if (isBuy && currentPrice > limitPrice) continue;
    if (!isBuy && currentPrice < limitPrice) continue;

    const fillPrice = isBuy ? currentPrice * (1 + slip) : currentPrice * (1 - slip);
    const account = await ensureAccount(client);

    if (isBuy) {
      const cost = order.quantity * fillPrice;
      if (account.cash < cost) {
        await client.from("trades").update({ status: "cancelled", closed_at: new Date().toISOString() }).eq("id", order.id);
        continue;
      }
      await client.from("sim_account").update({
        cash: account.cash - cost,
        updated_at: new Date().toISOString(),
      }).eq("id", 1);
      await upsertPosition(client, order.ticker, order.quantity, fillPrice);
    } else {
      const { data: pos } = await client.from("sim_positions").select("*").eq("ticker", order.ticker).single();
      const p = pos as SimPositionRow | null;
      if (!p || p.qty < order.quantity) {
        await client.from("trades").update({ status: "cancelled", closed_at: new Date().toISOString() }).eq("id", order.id);
        continue;
      }
      const proceeds = order.quantity * fillPrice;
      const realizedPnl = order.quantity * (fillPrice - p.avg_entry_price);
      await client.from("sim_account").update({
        cash: account.cash + proceeds,
        realized_pnl: account.realized_pnl + realizedPnl,
        updated_at: new Date().toISOString(),
      }).eq("id", 1);
      await closePosition(client, order.ticker, order.quantity, p);
    }

    await client.from("trades").update({
      status: "open",
      entry_price: fillPrice,
      exit_price: null,
      opened_at: new Date().toISOString(),
    }).eq("id", order.id);

    filled++;
  }

  return filled;
}
