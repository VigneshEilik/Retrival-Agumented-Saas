import { PDFParse } from 'pdf-parse';
import { DocumentParser, ParsedDocument, ParsedDocumentPage } from './parser.interface';
import { logger } from '../../../utils/logger';

/**
 * PDF text extraction with per-page output (pdf-parse v2 / pdf.js).
 * Page numbers flow into chunk metadata and from there into citations.
 * Scanned (image-only) PDFs yield no text: OCR is not part of this release, so
 * those fail with a clear message instead of producing an empty index.
 */
export class PDFParser implements DocumentParser {
  supportedMimeTypes = ['application/pdf'];
  supportedExtensions = ['.pdf'];

  canHandle(mimeType: string, extension: string): boolean {
    return (
      this.supportedMimeTypes.includes(mimeType.toLowerCase()) ||
      this.supportedExtensions.includes(extension.toLowerCase())
    );
  }

  async parse(fileBuffer: Buffer, filename: string): Promise<ParsedDocument> {
    // pdf.js takes ownership of the buffer it is given, so pass a copy.
    const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
    try {
      const result = await parser.getText();
      const pages: ParsedDocumentPage[] = result.pages
        .map((p) => ({ pageNumber: p.num, text: (p.text || '').trim() }))
        .filter((p) => p.text.length > 0);

      if (pages.length === 0) {
        throw new Error('No extractable text found (the PDF may be scanned images; OCR is not supported)');
      }

      return {
        title: filename,
        text: pages.map((p) => p.text).join('\n\n'),
        metadata: { numpages: result.total },
        pages,
      };
    } catch (error) {
      logger.error({ err: (error as Error).message, filename }, 'Failed to parse PDF document');
      throw new Error(`PDF parsing failed: ${(error as Error).message}`);
    } finally {
      await parser.destroy().catch(() => {});
    }
  }
}
