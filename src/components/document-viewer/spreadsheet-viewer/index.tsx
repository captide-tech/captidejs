import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Document } from '@types';
import SheetSelector from '@components/document-viewer/spreadsheet-viewer/sheet-selector';
import SpreadsheetSearch from '@components/document-viewer/spreadsheet-viewer/spreadsheet-search';
import DownloadButton from '@components/document-viewer/shared/download-button';
import SourceButton from '@components/document-viewer/shared/source-button';

interface SpreadsheetViewerProps {
  sasUrl: string;
  className?: string;
  style?: React.CSSProperties;
  zoomLevel?: number;
  document?: Document;
}

interface SearchMatch {
  row: number;
  col: number;
  text: string;
}

// Helper function to check if a sheet is valid for display
const isValidSheet = (worksheet: XLSX.WorkSheet): boolean => {
  if (!worksheet) return false;
  
  // Check if the sheet has any data
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
  if (range.e.r === 0 && range.e.c === 0) return false;
  
  // Check if there are any non-empty cells
  let hasData = false;
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
        hasData = true;
        break;
      }
    }
    if (hasData) break;
  }
  
  return hasData;
};

// Helper function to search for text in a worksheet
const searchInWorksheet = (worksheet: XLSX.WorkSheet, query: string): SearchMatch[] => {
  if (!worksheet || !query) return [];
  
  const matches: SearchMatch[] = [];
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
  
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      
      if (cell && cell.v !== undefined && cell.v !== null) {
        const cellText = String(cell.v).toLowerCase();
        if (cellText.includes(query.toLowerCase())) {
          matches.push({
            row: row + 1, // Convert to 1-based for display
            col: col + 1,
            text: String(cell.v)
          });
        }
      }
    }
  }
  
  return matches;
};

// Helper function to extract domain from URL
const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch (e) {
    return 'website';
  }
};

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
  const [validSheets, setValidSheets] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const [currentZoom, setCurrentZoom] = useState(zoomLevel);
  
  // Search-related state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  
  // Extract webpage URL from document metadata if available
  const webpageUrl = document?.metadata?.webpageUrl || null;
  
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
        
        // Filter out invalid sheets
        const validSheetNames = wb.SheetNames.filter(sheetName => {
          const worksheet = wb.Sheets[sheetName];
          return isValidSheet(worksheet);
        });
        
        setValidSheets(validSheetNames);
        
        // Set the first valid sheet as active by default if available
        if (validSheetNames.length > 0) {
          setActiveSheet(validSheetNames[0]);
        } else if (wb.SheetNames.length > 0) {
          // If no valid sheets, still keep the workbook but don't set active sheet
          setWorkbook(wb);
        }
      } catch (err) {
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
    
    // Skip rendering if the sheet is invalid
    if (!isValidSheet(worksheet)) {
      tableRef.current.innerHTML = '<div style="padding: 20px; color: #666;">This sheet contains invalid or corrupted data and cannot be displayed.</div>';
      return;
    }
    
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
      
      // Apply highlighting to search matches if we're on the active sheet
      if (searchMatches.length > 0 && currentMatchIndex !== -1) {
        // Add a small delay to ensure the table is fully rendered
        setTimeout(() => {
          highlightCurrentMatch();
        }, 50);
      }
    }
  }, [workbook, activeSheet, currentZoom, currentMatchIndex, searchMatches]);

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
    if (!workbook || validSheets.length <= 1) return null;
    
    return (
      <SheetSelector
        sheets={validSheets}
        activeSheet={activeSheet || validSheets[0]}
        onChange={setActiveSheet}
      />
    );
  };
  
  // Search functionality
  const toggleSearch = () => {
    setIsSearchOpen(!isSearchOpen);
  };
  
  const closeSearch = () => {
    setIsSearchOpen(false);
  };

  const performSearch = useCallback((query: string) => {
    if (!workbook || !activeSheet || !query.trim()) {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }
    
    const worksheet = workbook.Sheets[activeSheet];
    const matches = searchInWorksheet(worksheet, query);
    setSearchMatches(matches);
    setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
  }, [workbook, activeSheet]);

  const highlightCurrentMatch = useCallback(() => {
    if (!tableRef.current || searchMatches.length === 0 || currentMatchIndex === -1) return;
    
    // Remove previous highlights
    const cells = tableRef.current.querySelectorAll('td, th');
    cells.forEach((cell: Element) => {
      (cell as HTMLElement).style.backgroundColor = '';
    });
    
    // Highlight current match
    const match = searchMatches[currentMatchIndex];
    if (match) {
      const table = tableRef.current.querySelector('table');
      if (table) {
        const rows = table.querySelectorAll('tr');
        if (rows[match.row - 1]) {
          const cells = rows[match.row - 1].querySelectorAll('td, th');
          if (cells[match.col - 1]) {
            (cells[match.col - 1] as HTMLElement).style.backgroundColor = '#ffeb3b';
            cells[match.col - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    }
  }, [searchMatches, currentMatchIndex]);

  const nextMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    setCurrentMatchIndex(prev => (prev + 1) % searchMatches.length);
  }, [searchMatches.length]);

  const previousMatch = useCallback(() => {
    if (searchMatches.length === 0) return;
    setCurrentMatchIndex(prev => prev === 0 ? searchMatches.length - 1 : prev - 1);
  }, [searchMatches.length]);

  // Handle search query changes
  useEffect(() => {
    performSearch(searchQuery);
  }, [searchQuery, performSearch]);

  // Handle current match changes
  useEffect(() => {
    highlightCurrentMatch();
  }, [currentMatchIndex, highlightCurrentMatch]);

  // Render for SSR
  if (!isBrowser) {
    return (
      <div className={className} style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: '#f5f5f5',
        color: '#666'
      }}>
        Spreadsheet viewer loading...
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`relative ${className}`} style={style}>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ backgroundColor: 'white' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #475569',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '20px'
          }} />
          <style>
            {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            `}
          </style>
          <div className="text-gray-600 font-medium text-lg mb-2">Loading Spreadsheet...</div>
          <div className="text-gray-400 text-sm">Preparing document...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`relative ${className}`} style={style}>
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4" style={{ backgroundColor: 'white' }}>
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
          <button 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
          <div className="mt-4 ml-2">
            <DownloadButton 
              onClick={handleDownload} 
              label="Download Spreadsheet" 
              primary={true}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!workbook || validSheets.length === 0) {
    return (
      <div className={`relative ${className}`} style={style}>
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4" style={{ backgroundColor: 'white' }}>
          <div className="text-gray-600 font-medium text-lg mb-2">No Valid Data</div>
          <div className="text-gray-400 text-sm">This spreadsheet contains no valid data to display.</div>
          <div className="mt-4">
            <DownloadButton onClick={handleDownload} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={style}>
      {/* Toolbar */}
      <div className="absolute top-2 left-2 right-2 z-10 flex justify-between items-center bg-white bg-opacity-90 backdrop-blur-sm rounded-lg p-2 shadow-sm">
        <div className="flex items-center space-x-2">
          {renderSheetSelector()}
          <button
            onClick={toggleSearch}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded border"
            title="Search in spreadsheet"
          >
            🔍 Search
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          {webpageUrl && (
            <SourceButton 
              onClick={handleOpenSourceWebpage} 
              domain={extractDomain(webpageUrl)}
            />
          )}
          <DownloadButton onClick={handleDownload} />
        </div>
      </div>

      {/* Search overlay */}
      {isSearchOpen && (
        <SpreadsheetSearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearch={() => performSearch(searchQuery)}
          onClose={closeSearch}
          matchCount={searchMatches.length}
          currentMatchIndex={currentMatchIndex}
          onNext={nextMatch}
          onPrevious={previousMatch}
          isOpen={isSearchOpen}
          onToggle={toggleSearch}
        />
      )}

      {/* Main content */}
      <div 
        ref={tableRef}
        className="w-full h-full overflow-auto pt-16"
        style={{ backgroundColor: 'white' }}
      />
    </div>
  );
};

export default SpreadsheetViewer; 