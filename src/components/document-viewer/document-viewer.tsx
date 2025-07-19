import React, { useRef, useEffect } from 'react';
import { useDocumentViewer } from '@contexts/document-viewer-context';
import PDFViewer from '@components/document-viewer/pdf-viewer';
import SpreadsheetViewer from '@components/document-viewer/spreadsheet-viewer';
import Loader from '@components/document-viewer/shared/loader';

const DocumentViewer: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className = 'w-full h-full',
  style,
}) => {
  const { document, isLoading, zoomLevel, zoomIn, zoomOut, highlightedElementId, citationSnippet } = useDocumentViewer();
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        e.deltaY < 0 ? zoomIn() : zoomOut();
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [zoomIn, zoomOut]);

  if (!document || isLoading) {
    return (
      <Loader />
    );
  }

  switch (document.fileType) {
    case 'pdf':
      return (
        <PDFViewer
          sasUrl={document.originalFileUrl}
          className={className}
          style={style}
          zoomLevel={zoomLevel}
          highlightedElementId={highlightedElementId}
          citationSnippet={citationSnippet}
        />
      );
    case 'xlsx':
      return (
        <SpreadsheetViewer
          sasUrl={document.originalFileUrl}
          className={className}
          style={style}
          zoomLevel={zoomLevel}
          document={document}
        />
      );
    default:
      return (
        <div className="w-full h-full flex items-center justify-center" style={{ background: 'white' }}>
          <div className="text-lg text-gray-500">Unsupported document type</div>
        </div>
      );
  }
};

export default DocumentViewer; 