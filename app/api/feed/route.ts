import { NextResponse } from 'next/server';
import { getRecentActivity } from '@/lib/sessions';

export const dynamic = 'force-dynamic'; // Always refresh, no caching

export async function GET() {
  try {
    const activities = await getRecentActivity(50);
    return NextResponse.json({ activities });
  } catch (error) {
    console.error("Feed API Error:", error);
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }
}
