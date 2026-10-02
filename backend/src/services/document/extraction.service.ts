import pdf from 'pdf-parse';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractionResult {
  fullText: string;
  pages: ExtractedPage[];
  totalPages: number;
  mimeType: string;
}

export class ExtractionService {
  /**
   * Extracts clean text and page metadata from uploaded document buffers.
   */
  public async extractText(
    buffer: Buffer,
    mimeType: string,
    fileName: string
  ): Promise<ExtractionResult> {
    if (!buffer || buffer.length === 0) {
      throw new Error(`Uploaded file '${fileName}' is empty (0 bytes).`);
    }

    const normalizedMime = mimeType.toLowerCase();

    if (normalizedMime === 'text/plain' || fileName.toLowerCase().endsWith('.txt')) {
      return this.extractFromPlainText(buffer);
    }

    if (normalizedMime === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
      return this.extractFromPdf(buffer, fileName);
    }

    throw new Error(
      `Unsupported file type '${mimeType}' for file '${fileName}'. Only TXT and PDF documents are currently supported.`
    );
  }

  /**
   * Extracts UTF-8 plain text.
   */
  private extractFromPlainText(buffer: Buffer): ExtractionResult {
    const fullText = buffer.toString('utf-8').trim();
    if (!fullText) {
      throw new Error('TXT document contains no text content.');
    }

    return {
      fullText,
      pages: [{ pageNumber: 1, text: fullText }],
      totalPages: 1,
      mimeType: 'text/plain',
    };
  }

  /**
   * Extracts text and per-page content from PDF buffers using pdf-parse.
   */
  private async extractFromPdf(buffer: Buffer, fileName: string): Promise<ExtractionResult> {
    const pageTexts: ExtractedPage[] = [];

    // Custom pagerender to capture per-page text content
    const customPagerender = async (pageData: any): Promise<string> => {
      const renderOptions = {
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      };

      const textContent = await pageData.getTextContent(renderOptions);
      let pageText = '';
      let lastY: number | null = null;

      for (const item of textContent.items) {
        if (lastY === item.transform[5] || lastY === null) {
          pageText += item.str;
        } else {
          pageText += '\n' + item.str;
        }
        lastY = item.transform[5];
      }

      pageTexts.push({
        pageNumber: pageData.pageIndex + 1,
        text: pageText.trim(),
      });

      return pageText;
    };

    let data;
    try {
      data = await pdf(buffer, {
        pagerender: customPagerender,
      });
    } catch (parseError: any) {
      throw new Error(
        `Failed to parse PDF '${fileName}': ${parseError?.message || 'File may be corrupted or encrypted.'}`
      );
    }

    const fullText = data.text ? data.text.trim() : '';

    if (!fullText || fullText.length === 0) {
      throw new Error(
        `PDF '${fileName}' contains no extractable text. Scanned or image-only PDFs require OCR, which is not supported in this version.`
      );
    }

    return {
      fullText,
      pages: pageTexts.length > 0 ? pageTexts : [{ pageNumber: 1, text: fullText }],
      totalPages: data.numpages || 1,
      mimeType: 'application/pdf',
    };
  }
}

export const extractionService = new ExtractionService();
