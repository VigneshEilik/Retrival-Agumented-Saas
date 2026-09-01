import { DocumentParser, ParsedDocument, ParsedDocumentSection } from './parser.interface';

export class MarkdownParser implements DocumentParser {
  supportedMimeTypes = ['text/markdown', 'text/x-markdown'];
  supportedExtensions = ['.md', '.markdown'];

  canHandle(mimeType: string, extension: string): boolean {
    return (
      this.supportedMimeTypes.includes(mimeType.toLowerCase()) ||
      this.supportedExtensions.includes(extension.toLowerCase())
    );
  }

  async parse(fileBuffer: Buffer, filename: string): Promise<ParsedDocument> {
    const text = fileBuffer.toString('utf8');
    const sections: ParsedDocumentSection[] = [];

    // Extract headings and sections
    const lines = text.split('\n');
    let currentTitle = 'Introduction';
    let currentLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('#')) {
        if (currentLines.length > 0) {
          sections.push({ title: currentTitle, text: currentLines.join('\n').trim() });
          currentLines = [];
        }
        currentTitle = line.replace(/^#+\s*/, '').trim();
      } else {
        currentLines.push(line);
      }
    }
    if (currentLines.length > 0) {
      sections.push({ title: currentTitle, text: currentLines.join('\n').trim() });
    }

    return {
      title: filename,
      text,
      metadata: {
        sectionCount: sections.length,
      },
      sections,
    };
  }
}
