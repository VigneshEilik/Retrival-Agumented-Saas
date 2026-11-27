import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { DocumentParser, ParsedDocument } from './parser.interface';
import { MarkdownParser } from './markdown.parser';

/**
 * DOCX → HTML (mammoth keeps heading structure) → Markdown → MarkdownParser.
 * Reusing the Markdown parser gives DOCX files section-aware chunking, so
 * citations can name the section ("Passwords", "Incident Reporting", ...).
 * Legacy binary .doc files are not supported.
 */
export class DOCXParser implements DocumentParser {
  supportedMimeTypes = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  supportedExtensions = ['.docx'];
  private markdown = new MarkdownParser();

  canHandle(mimeType: string, extension: string): boolean {
    return (
      this.supportedMimeTypes.includes(mimeType.toLowerCase()) ||
      this.supportedExtensions.includes(extension.toLowerCase())
    );
  }

  async parse(fileBuffer: Buffer, filename: string): Promise<ParsedDocument> {
    const result = await mammoth.convertToHtml({ buffer: fileBuffer });
    const markdownText = new TurndownService({ headingStyle: 'atx' }).turndown(result.value || '');
    if (!markdownText.trim()) {
      throw new Error('No extractable text found in the DOCX file');
    }
    const parsed = await this.markdown.parse(Buffer.from(markdownText, 'utf8'), filename);
    return {
      ...parsed,
      title: filename,
      metadata: { ...(parsed.metadata || {}), warnings: result.messages.map((m) => m.message) },
    };
  }
}
