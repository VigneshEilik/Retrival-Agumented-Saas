// Developer utility: parse + chunk the smoke fixtures and print a summary.
import fs from 'fs';
import path from 'path';
import { getParserForFile } from '../../src/modules/ingestion/parser';
import { StructureAwareChunker } from '../../src/modules/ingestion/chunker/structure.chunker';

const files: Array<[string, string, string]> = [
  ['employee-handbook.pdf', 'application/pdf', '.pdf'],
  ['it-security-standard.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
];
(async () => {
  for (const [f, m, e] of files) {
    const doc = await getParserForFile(m, e).parse(fs.readFileSync(path.join(__dirname, 'fixtures', f)), f);
    const chunks = new StructureAwareChunker().chunk(doc);
    console.log(f, '| pages', doc.pages?.length || 0, '| sections', doc.sections?.length || 0, '| chunks', chunks.length);
    for (const c of chunks) console.log('   ', JSON.stringify(c.metadata), c.content.slice(0, 60).replace(/\n/g, ' '));
  }
})().catch((err) => {
  console.error('ERR', err.message);
  process.exit(1);
});
