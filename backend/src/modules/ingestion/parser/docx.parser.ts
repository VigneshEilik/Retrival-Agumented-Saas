import mammoth from 'mammoth';
import { DocumentParser, ParsedDocument } from './parser.interface';

export class DOCXParser implements DocumentParser {
  supportedMimeTypes = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
  supportedExtensions = ['.docx', '.doc'];

  canHandle(mimeType: string, extension: string): boolean {
    return (
      this.supportedMimeTypes.includes(mimeType.toLowerCase()) ||
      this.supportedExtensions.includes(extension.toLowerCase())
    );
  }

  async parse(fileBuffer: Buffer, filename: string): Promise<ParsedDocument> {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return {
      title: filename,
      text: result.value,
      metadata: {
        warnings: result.messages,
      },
    };
  }
}
