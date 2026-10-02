import { searchSimilarChunks } from '@/lib/actions/search';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const results = await searchSimilarChunks(query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to search';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

