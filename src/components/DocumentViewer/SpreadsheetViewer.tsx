import React, { useState, useEffect } from 'react';

interface SpreadsheetViewerProps {
  sasUrl: string;
  className?: string;
  style?: React.CSSProperties;
}

// Simple placeholder component for non-browser environments
const SpreadsheetPlaceholder: React.FC<{className?: string; style?: React.CSSProperties}> = ({
  className = 'w-full h-full', 
  style
}) => (
  <div className={className} style={{
    ...style,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: '#f5f5f5',
    color: '#666'
  }}>
    Spreadsheet Viewer requires a browser environment
  </div>
);

/**
 * Spreadsheet Viewer Component
 * 
 * Provides a simple interface for viewing Excel/spreadsheet files.
 * For Excel files, we offer a viewer placeholder with download option
 * since browser support for embedded XLSX viewing is limited.
 * This component is browser-only to avoid SSR issues.
 */
const SpreadsheetViewer: React.FC<SpreadsheetViewerProps> = ({
  sasUrl,
  className = 'w-full h-full',
  style
}) => {
  const [isBrowser, setIsBrowser] = useState(false);

  // Check if we're in a browser environment
  useEffect(() => {
    setIsBrowser(typeof window !== 'undefined' && typeof document !== 'undefined');
  }, []);

  // If not in browser, return a placeholder
  if (!isBrowser) {
    return <SpreadsheetPlaceholder className={className} style={style} />;
  }

  const handleOpenInNewWindow = () => {
    window.open(sasUrl, '_blank');
  };

  const handleDownload = () => {
    // Create a temporary anchor element
    const a = document.createElement('a');
    a.href = sasUrl;
    a.download = 'document.xlsx'; // Default filename
    
    try {
    // Try to extract filename from sasUrl if possible
    const urlObj = new URL(sasUrl);
    const pathParts = urlObj.pathname.split('/');
    const potentialFilename = pathParts[pathParts.length - 1];
    
    if (potentialFilename && potentialFilename.includes('.xlsx')) {
      a.download = potentialFilename;
      }
    } catch (e) {
      console.error('Error parsing URL for download:', e);
      // Fall back to default name
    }
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className={className}
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        padding: '20px',
        backgroundColor: '#f9f9f9',
        border: '1px solid #e0e0e0',
        borderRadius: '4px'
      }}
    >
      <div style={{ marginBottom: '20px' }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: '#475569' }}
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="8" y1="12" x2="16" y2="12"></line>
          <line x1="8" y1="16" x2="16" y2="16"></line>
          <line x1="8" y1="8" x2="11" y2="8"></line>
        </svg>
      </div>

      <h2 style={{ margin: '0 0 10px', fontSize: '20px', color: '#333' }}>
        Excel Document
      </h2>
      
      <p style={{ margin: '0 0 20px', color: '#666' }}>
        We'll support rendering Excel files soon. For now, please download the file.
      </p>
      
      <div style={{ display: 'flex', gap: '10px' }}>
        
        <button
          onClick={handleDownload}
          style={{
            padding: '8px 16px',
            backgroundColor: '#475569',
            color: '#ffffff',
            border: '1px solid #475569',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Download
        </button>
      </div>
    </div>
  );
};

export default SpreadsheetViewer; 