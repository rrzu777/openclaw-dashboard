import { NextResponse } from 'next/server';
import { getCronJobs } from '@/lib/cron';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const jobs = await getCronJobs();
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("Cron API Error:", error);
    return NextResponse.json({ error: "Failed to fetch cron jobs" }, { status: 500 });
  }
}
