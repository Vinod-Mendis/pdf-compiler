'use client';

import dynamic from 'next/dynamic';

const PDFViewerClient = dynamic(() => import('./PDFViewerClient'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 rounded-md border border-zinc-200 dark:border-zinc-800">
      <span className="text-xs font-mono">Loading PDF viewer...</span>
    </div>
  ),
});

interface PDFViewerWrapperProps {
  pdfUrl: string;
  expectedPageCount?: number;
}

export default function PDFViewerWrapper({ pdfUrl, expectedPageCount }: PDFViewerWrapperProps) {
  return <PDFViewerClient pdfUrl={pdfUrl} expectedPageCount={expectedPageCount} />;
}
