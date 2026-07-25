import { NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from '@cantoo/pdf-lib';

export const runtime = 'nodejs';

interface DocSpec {
  id: string;
  title: string;
  pageCount: number;
  color: [number, number, number]; // RGB 0-1
}

const DOC_SPECS: DocSpec[] = [
  { id: 'doc-1', title: 'Element A', pageCount: 3, color: [0.15, 0.35, 0.75] }, // Deep Blue
  { id: 'doc-2', title: 'Element B', pageCount: 4, color: [0.1, 0.55, 0.35] },  // Emerald Green
  { id: 'doc-3', title: 'Element C', pageCount: 2, color: [0.85, 0.45, 0.1] },  // Amber/Orange
  { id: 'doc-4', title: 'Element D', pageCount: 3, color: [0.55, 0.2, 0.65] },  // Purple
];

export async function POST() {
  try {
    const generatedPdfs = [];

    for (const spec of DOC_SPECS) {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

      for (let i = 1; i <= spec.pageCount; i++) {
        const page = pdfDoc.addPage([600, 400]);
        const { width, height } = page.getSize();
        const [r, g, b] = spec.color;

        // Background header banner
        page.drawRectangle({
          x: 0,
          y: height - 80,
          width: width,
          height: 80,
          color: rgb(r, g, b),
        });

        // Banner text
        page.drawText(spec.title, {
          x: 30,
          y: height - 50,
          size: 28,
          font: font,
          color: rgb(1, 1, 1),
        });

        // Page indicator text
        page.drawText(`Page ${i} of ${spec.pageCount}`, {
          x: width - 180,
          y: height - 48,
          size: 18,
          font: fontRegular,
          color: rgb(0.9, 0.9, 0.9),
        });

        // Center card body
        page.drawRectangle({
          x: 30,
          y: 40,
          width: width - 60,
          height: height - 140,
          color: rgb(0.96, 0.97, 0.98),
          borderColor: rgb(r, g, b),
          borderWidth: 2,
        });

        // Center visual label
        const centerText = `${spec.title} — Page ${i}`;
        const textSize = 32;
        const textWidth = font.widthOfTextAtSize(centerText, textSize);

        page.drawText(centerText, {
          x: (width - textWidth) / 2,
          y: height / 2,
          size: textSize,
          font: font,
          color: rgb(r, g, b),
        });

        // Footer note
        const footerText = `POC Test Document • ${spec.id} • Page ${i} of ${spec.pageCount}`;
        page.drawText(footerText, {
          x: 40,
          y: 18,
          size: 11,
          font: fontRegular,
          color: rgb(0.5, 0.5, 0.5),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const base64 = Buffer.from(pdfBytes).toString('base64');

      generatedPdfs.push({
        id: spec.id,
        title: spec.title,
        pageCount: spec.pageCount,
        base64,
      });
    }

    return NextResponse.json({
      success: true,
      pdfs: generatedPdfs,
    });
  } catch (error: any) {
    console.error('Error generating PDFs:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate PDFs' },
      { status: 500 }
    );
  }
}
