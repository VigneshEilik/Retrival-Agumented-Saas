export interface ParsedDocumentPage {
  pageNumber: number;
  text: string;
}

export interface ParsedDocumentSection {
  title: string;
  text: string;
}

export interface ParsedDocument {
  title: string;
  text: string;
  metadata: Record<string, any>;
  pages?: ParsedDocumentPage[];
  sections?: ParsedDocumentSection[];
}

export interface DocumentParser {
  supportedMimeTypes: string[];
  supportedExtensions: string[];
  canHandle(mimeType: string, extension: string): boolean;
  parse(fileBuffer: Buffer, filename: string): Promise<ParsedDocument>;
}
