"""Seed the watchlist table with initial tickers."""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agents.config import WATCHLIST, SUPABASE_URL, SUPABASE_KEY


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY in .env")
        print("\nWould insert these tickers:")
        for item in WATCHLIST:
            print(f"  {item['ticker']:6s} {item['company_name']:40s} [{item['sector']}]")
        return

    from supabase import create_client

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    print(f"Seeding {len(WATCHLIST)} tickers into watchlist...")

    for item in WATCHLIST:
        try:
            client.table("watchlist").upsert(
                {
                    "ticker": item["ticker"],
                    "company_name": item["company_name"],
                    "sector": item["sector"],
                    "active": True,
                },
                on_conflict="ticker",
            ).execute()
            print(f"  + {item['ticker']}")
        except Exception as e:
            print(f"  ! {item['ticker']} — {e}")

    print("Done.")


if __name__ == "__main__":
    main()
