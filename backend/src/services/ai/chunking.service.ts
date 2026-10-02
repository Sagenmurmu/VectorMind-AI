export type ChunkingMethod = 'sentence' | 'paragraph' | 'fixed';

export interface ChunkItem {
  chunkIndex: number;
  content: string;
  pageNumber?: number;
}

export interface ChunkingOptions {
  method?: ChunkingMethod;
  fixedSize?: number;
}

export class ChunkingService {
  private static readonly DEFAULT_FIXED_SIZE = 500;

  /**
   * Splits a plain text string into discrete text chunks based on the chosen strategy.
   */
  public chunkText(
    text: string,
    options: ChunkingOptions = {}
  ): string[] {
    const method = options.method || 'paragraph';
    const fixedSize = options.fixedSize || ChunkingService.DEFAULT_FIXED_SIZE;

    const trimmed = text.trim();
    if (!trimmed) {
      return [];
    }

    switch (method) {
      case 'sentence':
        return trimmed
          .split('.')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

      case 'paragraph':
        return trimmed
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter((p) => p.length > 0);

      case 'fixed': {
        const chunks: string[] = [];
        const words = trimmed.split(/\s+/);
        let currentChunk = '';

        for (const word of words) {
          if (currentChunk.length + word.length + 1 > fixedSize) {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = word;
          } else {
            currentChunk = currentChunk ? `${currentChunk} ${word}` : word;
          }
        }
        if (currentChunk) chunks.push(currentChunk.trim());
        return chunks;
      }

      default:
        return [trimmed];
    }
  }

  /**
   * Chunks multi-page document extractions while preserving source page provenance.
   */
  public chunkPages(
    pages: Array<{ pageNumber: number; text: string }>,
    options: ChunkingOptions = {}
  ): ChunkItem[] {
    const result: ChunkItem[] = [];
    let globalIndex = 0;

    for (const page of pages) {
      const pageChunks = this.chunkText(page.text, options);
      for (const chunkContent of pageChunks) {
        result.push({
          chunkIndex: globalIndex++,
          content: chunkContent,
          pageNumber: page.pageNumber,
        });
      }
    }

    return result;
  }
}

export const chunkingService = new ChunkingService();
