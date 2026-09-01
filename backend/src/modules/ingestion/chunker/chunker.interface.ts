import { ParsedDocument } from '../parser/parser.interface';

export interface ChunkingOptions {
  chunkSize?: number;      // Target characters or tokens per chunk (default 1000)
  chunkOverlap?: number;   // Overlap characters per chunk (default 150)
  minChunkSize?: number;   // Minimum character threshold (default 100)
}

export interface DocumentChunkItem {
  chunkIndex: number;
  content: string;
  metadata: {
    pageNumber?: number;
    sectionTitle?: string;
    characterCount: number;
    [key: string]: any;
  };
}

export interface ChunkerEngine {
  chunk(parsedDoc: ParsedDocument, options?: ChunkingOptions): DocumentChunkItem[];
}
