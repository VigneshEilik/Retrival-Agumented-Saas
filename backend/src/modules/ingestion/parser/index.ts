import { DocumentParser } from './parser.interface';
import { PDFParser } from './pdf.parser';
import { DOCXParser } from './docx.parser';
import { TXTParser } from './txt.parser';
import { MarkdownParser } from './markdown.parser';
import { HTMLParser } from './html.parser';

const parsers: DocumentParser[] = [
  new PDFParser(),
  new DOCXParser(),
  new TXTParser(),
  new MarkdownParser(),
  new HTMLParser(),
];

export function getParserForFile(mimeType: string, extension: string): DocumentParser {
  // The file extension is authoritative (it was validated and content-sniffed at upload);
  // browsers often send generic MIME types (text/plain for .md/.html, octet-stream).
  const ext = (extension || '').toLowerCase();
  const parser =
    parsers.find((p) => ext && p.supportedExtensions.includes(ext)) ||
    parsers.find((p) => p.canHandle(mimeType, extension));
  if (!parser) {
    throw new Error(`Unsupported document file format: MIME='${mimeType}', Extension='${extension}'`);
  }
  return parser;
}

export * from './parser.interface';
export * from './pdf.parser';
export * from './docx.parser';
export * from './txt.parser';
export * from './markdown.parser';
export * from './html.parser';
