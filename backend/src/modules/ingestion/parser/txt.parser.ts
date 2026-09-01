import { DocumentParser, ParsedDocument } from './parser.interface';

export class TXTParser implements DocumentParser {
  supportedMimeTypes = ['text/plain'];
  supportedExtensions = ['.txt'];

  canHandle(mimeType: string, extension: string): boolean {
    return (
      this.supportedMimeTypes.includes(mimeType.toLowerCase()) ||
      this.supportedExtensions.includes(extension.toLowerCase())
    );
  }

  async parse(fileBuffer: Buffer, filename: string): Promise<ParsedDocument> {
    const text = fileBuffer.toString('utf8');
    return {
      title: filename,
      text,
      metadata: {
        characterCount: text.length,
      },
    };
  }
}
