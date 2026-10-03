import http from 'http';
import { createApp } from '../app';

async function testStream() {
  console.log('--- Testing Real-Time SSE Streaming Endpoint ---');
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;
  console.log(`[StreamTest] Server listening on ${baseUrl}`);

  const res = await fetch(`${baseUrl}/api/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      query: 'Hello, what is VectorMind?',
      stream: true,
    }),
  });

  console.log(`[StreamTest] Response Status: ${res.status}`);
  console.log(`[StreamTest] Content-Type: ${res.headers.get('content-type')}`);

  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}: ${await res.text()}`);
  }

  const text = await res.text();
  console.log(`[StreamTest] Received total stream payload (${text.length} chars)`);
  console.log(`[StreamTest] Preview of stream chunks:\n${text.slice(0, 450)}\n...`);

  const hasMetadata = text.includes('"type":"metadata"');
  const hasChunk = text.includes('"type":"chunk"');
  const hasDone = text.includes('"type":"done"');

  console.log(`✓ Has metadata event: ${hasMetadata}`);
  console.log(`✓ Has chunk tokens: ${hasChunk}`);
  console.log(`✓ Has done event: ${hasDone}`);

  server.close();

  if (hasMetadata && hasChunk && hasDone) {
    console.log('🎉 REAL-TIME SSE STREAMING VERIFIED SUCCESSFULLY!');
  } else {
    throw new Error('Streaming response missing required events');
  }
}

testStream().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
