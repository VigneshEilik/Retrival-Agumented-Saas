const pdfParse = require('pdf-parse');
import { DocumentParser, ParsedDocument, ParsedDocumentPage } from './parser.interface';
import { logger } from '../../../utils/logger';

export class PDFParser implements DocumentParser {
  supportedMimeTypes = ['application/pdf'];
  supportedExtensions = ['.pdf'];

  canHandle(mimeType: string, extension: string): boolean {
    return (
      this.supportedMimeTypes.includes(mimeType.toLowerCase()) ||
      this.supportedExtensions.includes(extension.toLowerCase())
    );
  }

  async parse(fileBuffer: Buffer, filename: string): Promise<ParsedDocument> {
    const pages: ParsedDocumentPage[] = [];

    // Custom pager callback to track text per page
    const pageRender = (pageData: any) => {
      return pageData.getTextContent().then((textContent: any) => {
        let lastY, text = '';
        for (let item of textContent.items) {
          if (lastY == item.transform[5] || !lastY) {
            text += item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = item.transform[5];
        }

        pages.push({
          pageNumber: pages.length + 1,
          text: text.trim(),
        });

        return text;
      });
    };

    try {
      const data = await pdfParse(fileBuffer, { pagerender: pageRender });
      return {
        title: filename,
        text: data.text,
        metadata: {
          numpages: data.numpages,
          info: data.info,
          version: data.version,
        },
        pages,
      };
    } catch (error) {
      logger.error({ error, filename }, 'Failed to parse PDF document');
      throw new Error(`PDF parsing failed for ${filename}: ${(error as Error).message}`);
    }
  }
}
