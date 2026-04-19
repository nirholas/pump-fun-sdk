import { NextResponse } from "next/server";
import { mainnetConnection } from "@/lib/rpc";
import { fetchRecentMints } from "@/lib/pump";

export const runtime = "nodejs";
export const revalidate = 30;

export async function GET() {
  try {
    const connection = mainnetConnection();
    const mints = await fetchRecentMints(connection, 20);
    return NextResponse.json({ mints }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
