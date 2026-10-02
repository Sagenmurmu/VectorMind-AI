import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Fetch recent events from Inngest dev server if running
    const inngestDevUrl =
      process.env.INNGEST_DEV_SERVER_URL || 'http://127.0.0.1:8288';
    try {
      const res = await fetch(`${inngestDevUrl}/v0/events`, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 0 },
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ events: data.data || data.events || [] });
      }
    } catch {
      // Inngest dev server may not be active
    }

    return NextResponse.json({ events: [] });
  } catch (error) {
    console.error('Failed to fetch Inngest events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

