import { NextResponse } from 'next/server';

/**
 * DEPRECATED in Phase 4:
 * Legacy Next.js route superseded by the Express backend search endpoint at /api/v1/search.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'DEPRECATED_ENDPOINT',
      message:
        'This Next.js API route was deprecated in Phase 4. All semantic vector search queries are now served by the Express backend at /api/v1/search.',
    },
    { status: 410 }
  );
}
