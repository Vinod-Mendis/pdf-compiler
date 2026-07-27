import { NextResponse } from 'next/server';
import { PDFDocument } from '@cantoo/pdf-lib';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No PDF files were uploaded' },
        { status: 400 }
      );
    }

    const parsedPdfs = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        continue;
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);

      let pageCount = 0;
      let title = file.name.replace(/\.pdf$/i, '');

      let subject = '';
      let keywords = '';

      try {
        const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
        pageCount = pdfDoc.getPageCount();
        const pdfTitle = pdfDoc.getTitle();
        if (pdfTitle && pdfTitle.trim().length > 0) {
          title = pdfTitle.trim();
        }
        subject = pdfDoc.getSubject() || '';
        keywords = pdfDoc.getKeywords() || '';
      } catch (err: any) {
        console.warn(`Failed to parse metadata for file ${file.name}:`, err);
        pageCount = 1; // Fallback
      }

      const base64 = pdfBuffer.toString('base64');

      parsedPdfs.push({
        id: `upload-${Date.now()}-${i}`,
        title,
        subject,
        keywords,
        filename: file.name,
        sizeBytes: file.size,
        pageCount,
        base64,
      });
    }

    return NextResponse.json({
      success: true,
      pdfs: parsedPdfs,
    });
  } catch (error: any) {
    console.error('Error parsing uploaded PDFs:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to parse uploaded PDFs' },
      { status: 500 }
    );
  }
}
