import { ChunkerEngine, ChunkingOptions, DocumentChunkItem } from './chunker.interface';
import { ParsedDocument } from '../parser/parser.interface';
import { normalizeText } from './normalizer';

export class StructureAwareChunker implements ChunkerEngine {
  chunk(parsedDoc: ParsedDocument, options?: ChunkingOptions): DocumentChunkItem[] {
    const chunkSize = options?.chunkSize || 1000;
    const chunkOverlap = options?.chunkOverlap || 150;
    const minChunkSize = options?.minChunkSize || 20;

    const chunks: DocumentChunkItem[] = [];
    let chunkIndex = 0;

    // Strategy 1: Page-Aware Chunking (if pages available e.g., PDF)
    if (parsedDoc.pages && parsedDoc.pages.length > 0) {
      for (const page of parsedDoc.pages) {
        const normalizedPageText = normalizeText(page.text);
        if (!normalizedPageText) continue;

        const subChunks = this.splitTextIntoChunks(normalizedPageText, chunkSize, chunkOverlap, minChunkSize);
        for (const content of subChunks) {
          chunks.push({
            chunkIndex: chunkIndex++,
            content,
            metadata: {
              pageNumber: page.pageNumber,
              characterCount: content.length,
            },
          });
        }
      }
      return chunks;
    }

    // Strategy 2: Section-Aware Chunking (if sections available e.g., Markdown)
    if (parsedDoc.sections && parsedDoc.sections.length > 0) {
      for (const section of parsedDoc.sections) {
        const normalizedSectionText = normalizeText(section.text);
        if (!normalizedSectionText) continue;

        const subChunks = this.splitTextIntoChunks(normalizedSectionText, chunkSize, chunkOverlap, minChunkSize);
        for (const content of subChunks) {
          chunks.push({
            chunkIndex: chunkIndex++,
            content,
            metadata: {
              sectionTitle: section.title,
              characterCount: content.length,
            },
          });
        }
      }
      return chunks;
    }

    // Strategy 3: Standard Sliding Window Chunking
    const fullNormalizedText = normalizeText(parsedDoc.text);
    if (!fullNormalizedText) return [];

    const subChunks = this.splitTextIntoChunks(fullNormalizedText, chunkSize, chunkOverlap, minChunkSize);
    for (const content of subChunks) {
      chunks.push({
        chunkIndex: chunkIndex++,
        content,
        metadata: {
          characterCount: content.length,
        },
      });
    }

    return chunks;
  }

  private splitTextIntoChunks(text: string, chunkSize: number, chunkOverlap: number, minChunkSize: number): string[] {
    const result: string[] = [];
    if (text.length <= chunkSize) {
      if (text.length >= minChunkSize) {
        result.push(text);
      }
      return result;
    }

    // Guard against invalid configuration (overlap must be smaller than the chunk).
    const overlap = Math.max(0, Math.min(chunkOverlap, chunkSize - 1));
    // A break point must leave a chunk longer than the overlap, otherwise the next window
    // (which starts `overlap` characters before the break) would not move forward.
    const minAdvance = Math.max(minChunkSize, overlap + 1);

    let start = 0;
    while (start < text.length) {
      let end = start + chunkSize;

      if (end >= text.length) {
        end = text.length;
      } else {
        // Prefer a paragraph boundary, then a sentence boundary, then whitespace; else hard cut.
        const paragraphBreak = text.lastIndexOf('\n\n', end);
        const sentenceBreak = text.lastIndexOf('. ', end);
        const spaceBreak = text.lastIndexOf(' ', end);

        if (paragraphBreak > start + minAdvance) {
          end = paragraphBreak;
        } else if (sentenceBreak > start + minAdvance) {
          end = sentenceBreak + 1;
        } else if (spaceBreak > start + minAdvance) {
          end = spaceBreak;
        }
      }

      const chunkContent = text.substring(start, end).trim();
      if (chunkContent.length >= minChunkSize) {
        result.push(chunkContent);
      }

      if (end >= text.length) break;

      // Next window starts `overlap` characters before this chunk's end.
      // end - start > overlap is guaranteed above, so `start` strictly increases (termination).
      const next = end - overlap;
      start = next > start ? next : end;
    }

    return result;
  }
}
