import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, StreamData } from 'ai';
import { searchSimilarChunks } from '@/lib/actions/search';
import { QueryResultRow } from 'pg';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1];

    // Create StreamData instance
    const data = new StreamData();

    // Get search results safely
    let searchResults: QueryResultRow[] = [];
    try {
      searchResults = await searchSimilarChunks(lastMessage.content);
    } catch (searchError: any) {
      console.warn('Vector search warning:', searchError?.message);
      if (
        searchError?.message?.includes('credits') ||
        searchError?.message?.includes('quota')
      ) {
        throw new Error(searchError.message);
      }
    }

    // Format context with metadata
    const contextDetails = searchResults?.length
      ? searchResults.map((r: QueryResultRow) => ({
          chunk: r.chunk,
          metadata: {
            distance:
              typeof r.distance === 'number'
                ? r.distance.toFixed(3)
                : String(r.distance),
            createdAt: new Date(r.createdAt).toLocaleDateString(),
            ...r.metadata,
          },
        }))
      : [];

    // Append context to stream data
    data.append({ contextDetails });

    const context = contextDetails.length
      ? `Relevant context:\n${contextDetails
          .map(
            (r) =>
              `${r.chunk}\n(Distance: ${r.metadata.distance}, Created: ${r.metadata.createdAt}, Method: ${r.metadata.chunkingMethod}, Index: ${r.metadata.chunkIndex}/${r.metadata.totalChunks})`
          )
          .join('\n\n')}\n\n`
      : '';

    const google = createGoogleGenerativeAI({
      apiKey:
        process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
        process.env.GEMINI_API_KEY ||
        '',
    });

    const result = await streamText({
      model: google('gemini-flash-lite-latest'),
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful AI assistant. Use the provided context to answer questions when available. Always start your response with a brief mention of which context you used, if any.',
        },
        ...(context
          ? [
              {
                role: 'system',
                content: context,
              },
            ]
          : []),
        ...messages,
      ],
      onFinish: () => {
        data.close();
      },
    });

    return result.toDataStreamResponse({ data });
  } catch (error: any) {
    console.error('Chat API error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to process chat request';
    return new Response(message, { status: 500 });
  }
}

