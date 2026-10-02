'use server';

import { inngest } from '@/inngest/client';

export async function sendIngestEvent(
  text: string,
  chunkingMethod: 'sentence' | 'paragraph' | 'fixed' = 'paragraph'
) {
  return inngest.send({
    name: 'embed/text',
    data: {
      text,
      chunkingMethod,
    },
  });
}
