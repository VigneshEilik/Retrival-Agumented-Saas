import { StructureAwareChunker, normalizeText } from '../src/modules/ingestion/chunker';
import { ParsedDocument } from '../src/modules/ingestion/parser';

describe('Text Normalizer & Structure-Aware Chunker', () => {
  it('should normalize Unicode, newlines, and remove non-printable characters', () => {
    const raw = 'Header\r\n\r\nLine 1\x00\x07\n\n\nLine 2';
    const normalized = normalizeText(raw);
    expect(normalized).toBe('Header\n\nLine 1\n\nLine 2');
  });

  it('should chunk document preserving page numbers when pages exist', () => {
    const chunker = new StructureAwareChunker();
    const doc: ParsedDocument = {
      title: 'manual.pdf',
      text: 'Page 1 text. Page 2 text.',
      metadata: {},
      pages: [
        { pageNumber: 1, text: 'This is the full text content of Page 1 in the PDF user manual.' },
        { pageNumber: 2, text: 'This is the full text content of Page 2 in the PDF user manual.' },
      ],
    };

    const chunks = chunker.chunk(doc, { chunkSize: 200, chunkOverlap: 20 });
    expect(chunks.length).toBe(2);
    expect(chunks[0].metadata.pageNumber).toBe(1);
    expect(chunks[1].metadata.pageNumber).toBe(2);
  });

  it('should chunk document preserving section titles when sections exist', () => {
    const chunker = new StructureAwareChunker();
    const doc: ParsedDocument = {
      title: 'guide.md',
      text: 'Section 1. Section 2.',
      metadata: {},
      sections: [
        { title: 'Security Protocol', text: 'All API calls require HTTPS and JWT authentication tokens.' },
        { title: 'Data Retention', text: 'Data is retained for 90 days before automated archiving.' },
      ],
    };

    const chunks = chunker.chunk(doc, { chunkSize: 200, chunkOverlap: 20 });
    expect(chunks.length).toBe(2);
    expect(chunks[0].metadata.sectionTitle).toBe('Security Protocol');
    expect(chunks[1].metadata.sectionTitle).toBe('Data Retention');
  });
});
