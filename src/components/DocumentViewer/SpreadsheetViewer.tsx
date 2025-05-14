import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { InternalDocument } from '../../types';

interface SpreadsheetViewerProps {
  sasUrl: string;
  className?: string;
  style?: React.CSSProperties;
  zoomLevel?: number;
  document?: InternalDocument; // Properly typed document prop
}

// Helper function to extract domain from URL
const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    // Remove 'www.' if present
    return urlObj.hostname.replace(/^www\./, '');
  } catch (e) {
    console.error('Error extracting domain:', e);
    return 'website';
  }
};

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
 * Provides an interface for viewing Excel/CSV spreadsheet files using SheetJS.
 * Offers a viewer with download option as a fallback.
 * This component is browser-only to avoid SSR issues.
 */
const SpreadsheetViewer: React.FC<SpreadsheetViewerProps> = ({
  sasUrl,
  className = 'w-full h-full',
  style,
  zoomLevel = 1.0,
  document
}) => {
  // Define all state hooks at the top level
  const [isBrowser, setIsBrowser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [currentZoom, setCurrentZoom] = useState(zoomLevel);
  
  // Extract webpage URL from document metadata if available
  const webpageUrl = document?.metadata?.webpageUrl || null;
  console.log("💕document", document);
  // Check if we're in a browser environment
  useEffect(() => {
    setIsBrowser(typeof window !== 'undefined' && typeof document !== 'undefined');
  }, []);

  // Update current zoom when prop changes
  useEffect(() => {
    setCurrentZoom(zoomLevel);
  }, [zoomLevel]);

  // Fetch and process the spreadsheet
  useEffect(() => {
    if (!sasUrl || !isBrowser) return;

    const loadSpreadsheet = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch the file
        const response = await fetch(sasUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        
        // Parse with SheetJS
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        setWorkbook(wb);
        
        // Set the first sheet as active by default
        if (wb.SheetNames.length > 0) {
          setActiveSheet(wb.SheetNames[0]);
        }
      } catch (err) {
        console.error('Error loading spreadsheet:', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    };

    loadSpreadsheet();
  }, [sasUrl, isBrowser]);

  // Render the selected sheet to HTML
  useEffect(() => {
    if (!workbook || !activeSheet || !tableRef.current) return;
    
    // Get the worksheet
    const worksheet = workbook.Sheets[activeSheet];
    
    // Convert to HTML
    const html = XLSX.utils.sheet_to_html(worksheet, { id: 'spreadsheet-table' });
    
    // Insert into the DOM
    tableRef.current.innerHTML = html;
    
    // Apply styling to the table
    const table = window.document.getElementById('spreadsheet-table');
    if (table) {
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      table.style.fontSize = '13px'; // Smaller default font size
      
      // Apply zoom
      if (currentZoom !== 1) {
        table.style.transform = `scale(${currentZoom})`;
        table.style.transformOrigin = 'top left';
      }
      
      // Style all cells
      const cells = table.querySelectorAll('td, th');
      cells.forEach((cell: Element) => {
        (cell as HTMLElement).style.border = '1px solid #e0e0e0';
        (cell as HTMLElement).style.padding = '4px 6px'; // Smaller padding
        (cell as HTMLElement).style.textAlign = 'left';
      });
      
      // Style headers
      const headers = table.querySelectorAll('th');
      headers.forEach((header: Element) => {
        (header as HTMLElement).style.backgroundColor = '#f5f5f5';
        (header as HTMLElement).style.fontWeight = 'bold';
      });
    }
  }, [workbook, activeSheet, currentZoom]);

  const handleOpenInNewWindow = () => {
    window.open(sasUrl, '_blank');
  };

  const handleDownload = () => {
    // Create a temporary anchor element
    const a = window.document.createElement('a');
    a.href = sasUrl;
    a.download = 'document.xlsx'; // Default filename
    
    try {
      // Try to extract filename from sasUrl if possible
      const urlObj = new URL(sasUrl);
      const pathParts = urlObj.pathname.split('/');
      const potentialFilename = pathParts[pathParts.length - 1];
      
      if (potentialFilename && 
          (potentialFilename.includes('.xlsx') || 
           potentialFilename.includes('.csv') || 
           potentialFilename.includes('.xls'))) {
        a.download = potentialFilename;
      }
    } catch (e) {
      console.error('Error parsing URL for download:', e);
      // Fall back to default name
    }
    
    // Trigger download
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  };
  
  const handleOpenSourceWebpage = () => {
    if (webpageUrl) {
      window.open(webpageUrl, '_blank');
    }
  };

  // Sheet selector for workbooks with multiple sheets
  const renderSheetSelector = () => {
    if (!workbook || workbook.SheetNames.length <= 1) return null;
    
    return (
      <div style={{ marginBottom: '10px' }}>
        <label htmlFor="sheet-selector" style={{ marginRight: '8px', fontWeight: 'bold' }}>
          Sheet:
        </label>
        <select 
          id="sheet-selector"
          value={activeSheet || ''}
          onChange={(e) => setActiveSheet(e.target.value)}
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid #ccc'
          }}
        >
          {workbook.SheetNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>
    );
  };

  // If not in browser, return a placeholder
  if (!isBrowser) {
    return <SpreadsheetPlaceholder className={className} style={style} />;
  }

  // Return the appropriate UI based on component state
  let content;
  
  if (isLoading) {
    content = (
      <div style={{ marginBottom: '20px' }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #475569',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>
          {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          `}
        </style>
      </div>
    );
  } else if (error) {
    content = (
      <>
        <div style={{ marginBottom: '20px', color: '#dc2626' }}>
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
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h2 style={{ margin: '0 0 10px', fontSize: '20px', color: '#333' }}>
          Failed to Load Spreadsheet
        </h2>
        <p style={{ margin: '0 0 20px', color: '#666', textAlign: 'center' }}>
          {error}
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
              fontWeight: 'bold',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)',
              transition: 'background-color 0.2s ease',
              fontSize: '12px'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f4a5c'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#475569'}
          >
            Download Instead
          </button>
          
          {webpageUrl && (
            <button
              onClick={handleOpenSourceWebpage}
              style={{
                padding: '8px 16px',
                backgroundColor: '#ffffff',
                color: '#475569',
                border: '1px solid #475569',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)',
                transition: 'background-color 0.2s ease',
                fontSize: '12px'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
              title={`Open original source website: ${extractDomain(webpageUrl)}`}
            >
              View Source: {extractDomain(webpageUrl)}
            </button>
          )}
        </div>
      </>
    );
  } else if (!workbook) {
    content = (
      <>
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
          Spreadsheet Document
        </h2>
        
        <p style={{ margin: '0 0 20px', color: '#666' }}>
          Unable to render the spreadsheet. You can download it instead.
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
              fontWeight: 'bold',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)',
              transition: 'background-color 0.2s ease',
              fontSize: '12px'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3f4a5c'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#475569'}
          >
            Download
          </button>
          
          {webpageUrl && (
            <button
              onClick={handleOpenSourceWebpage}
              style={{
                padding: '8px 16px',
                backgroundColor: '#ffffff',
                color: '#475569',
                border: '1px solid #475569',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)',
                transition: 'background-color 0.2s ease',
                fontSize: '12px'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
              title={`Open original source website: ${extractDomain(webpageUrl)}`}
            >
              View Source: {extractDomain(webpageUrl)}
            </button>
          )}
        </div>
      </>
    );
  } else {
    // Successful render with workbook
    return (
      <div
        className={className}
        style={{
          ...style,
          display: 'flex',
          flexDirection: 'column',
          padding: '16px',
          backgroundColor: '#ffffff',
          borderRadius: '4px',
          overflow: 'auto'
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          {renderSheetSelector()}
          
          <div style={{ display: 'flex', gap: '8px' }}>
            {webpageUrl && (
              <button
                onClick={handleOpenSourceWebpage}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  transition: 'background-color 0.2s ease',
                  fontSize: '12px'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                title={`Open original source website: ${extractDomain(webpageUrl)}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                Source: {extractDomain(webpageUrl)}
              </button>
            )}
          
            <button
              onClick={handleDownload}
              style={{
                padding: '6px 12px',
                backgroundColor: '#f1f5f9',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                transition: 'background-color 0.2s ease',
                fontSize: '12px'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download
            </button>
          </div>
        </div>
        
        <div 
          ref={tableRef}
          style={{
            overflow: 'auto',
            flex: 1
          }}
        />
      </div>
    );
  }

  // For loading, error, and no workbook states
  if (isLoading || error || !workbook) {
    return (
      <div 
        className={className}
        style={{
          ...style,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          backgroundColor: '#f9f9f9',
          border: isLoading ? 'none' : '1px solid #e0e0e0',
          borderRadius: '4px',
          textAlign: 'center'
        }}
      >
        {content}
        {isLoading && (
          <p style={{ margin: '0', color: '#666' }}>
            Loading spreadsheet...
          </p>
        )}
      </div>
    );
  }

  // Default return (should never reach here due to conditions above)
  return null;
};

export default SpreadsheetViewer; 