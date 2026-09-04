import { NextResponse } from "next/server";
import { listSyncJobs } from "@/lib/syncProgress";

export const dynamic = "force-dynamic";

// Dipolling UI tiap beberapa detik selama sync jalan → bar progres per toko.
// Ringan: satu query berindeks, cuma job yang masih jalan / baru selesai.
export async function GET() {
  try {
    const jobs = await listSyncJobs();
    return NextResponse.json(
      {
        jobs: jobs.map((j) => ({
          id: j.id,
          storeName: j.storeName,
          scope: j.scope,
          phase: j.phase,
          storeIndex: j.storeIndex,
          storeTotal: j.storeTotal,
          windowIndex: j.windowIndex,
          windowTotal: j.windowTotal,
          round: j.round,
          ordersDone: j.ordersDone,
          ordersTotal: j.ordersTotal,
          created: j.created,
          updated: j.updated,
          partial: j.partial,
          message: j.message,
          error: j.error,
          startedAt: j.startedAt.toISOString(),
          finishedAt: j.finishedAt ? j.finishedAt.toISOString() : null,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ jobs: [], error: msg }, { status: 500 });
  }
}
