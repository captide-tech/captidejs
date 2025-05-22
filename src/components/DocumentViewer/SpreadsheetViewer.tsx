import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { InternalDocument } from '../../types';
import SheetSelector from './components/SheetSelector';
import SpreadsheetSearch from './components/SpreadsheetSearch';

interface SpreadsheetViewerProps {
  sasUrl: string;
  className?: string;
  style?: React.CSSProperties;
  zoomLevel?: number;
  document?: InternalDocument; // Properly typed document prop
}

// Search-related interfaces
interface SearchMatch {
  sheetName: string;
  rowIndex: number;
  rowData: any[];
  cellIndex?: number;
}

// Update the interface definitions for button components
interface DownloadButtonProps {
  onClick: () => void;
  primary?: boolean;
  minWidth?: number;
}

interface SourceButtonProps {
  onClick: () => void;
  domain: string;
  minWidth?: number;
}

// Helper function to extract domain from URL
const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    // Remove 'www.' if present
    return urlObj.hostname.replace(/^www\./, '');
  } catch (e) {
    return 'website';
  }
};

// Button component definitions
const DownloadButton: React.FC<DownloadButtonProps> = ({ onClick, primary = false, minWidth = 90 }) => (
  <button
    onClick={onClick}
    style={{
      padding: '6px 12px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '13px',
      backgroundColor: primary ? '#3b82f6' : '#f1f5f9',
      color: primary ? 'white' : '#475569',
      border: '1px solid',
      borderColor: primary ? '#2563eb' : '#cbd5e1',
      height: '32px',
      minWidth: `${minWidth}px`, // Ensure minimum button width
      cursor: 'pointer',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
      fontWeight: primary ? 'bold' : 'normal'
    }}
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
);

const SourceButton: React.FC<SourceButtonProps> = ({ onClick, domain, minWidth = 90 }) => (
  <button
    onClick={onClick}
    style={{
      padding: '6px 12px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '13px',
      backgroundColor: '#f1f5f9',
      color: '#475569',
      border: '1px solid #cbd5e1',
      height: '32px',
      minWidth: `${minWidth}px`, // Ensure minimum button width
      cursor: 'pointer',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
    }}
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
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="2" y1="12" x2="22" y2="12"></line>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
    Source
  </button>
);

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

// Helper function to detect invalid/corrupted sheet data
const isValidSheet = (worksheet: XLSX.WorkSheet): boolean => {
  try {
    // Check for XML-like metadata content that indicates a corrupted sheet
    const html = XLSX.utils.sheet_to_html(worksheet);
    
    // Check for common markers of corrupted XML metadata in spreadsheets
    const invalidMarkers = [
      '<OBJECT><META>',
      '<BBOOKS>',
      '<QUERY reftype=',
      '<QUERIES bbk='
    ];
    
    for (const marker of invalidMarkers) {
      if (html.includes(marker)) {
        return false;
      }
    }
    
    return true;
  } catch (e) {
    return false;
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
  
  // Regular function declarations for search functionality
  function navigateToMatch(match: SearchMatch) {
    // Switch to the sheet if needed
    if (activeSheet !== match.sheetName) {
      setActiveSheet(match.sheetName);
      // When switching sheets, we'll rely on the effect that runs after sheet changes
      // to trigger the highlighting
    } else {
      // If already on the correct sheet, just highlight the match
      highlightCurrentMatch();
    }
  }

  function navigateToNextMatch() {
    if (searchMatches.length === 0) return;
    
    const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIndex);
    navigateToMatch(searchMatches[nextIndex]);
  }

  function navigateToPreviousMatch() {
    if (searchMatches.length === 0) return;
    
    const prevIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIndex);
    navigateToMatch(searchMatches[prevIndex]);
  }

  // Search execution function
  const performSearch = useCallback(() => {
    if (!workbook || !searchQuery.trim()) {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }
    
    // Normalize the search query
    const query = searchQuery.toLowerCase().trim();
    
    // Handle number format variations
    let searchTerms = [query];
    
    // Check if the query could be a number (strip any non-digit characters except minus sign)
    const cleanQuery = query.replace(/[^\d-]/g, '');
    if (/^-?\d+$/.test(cleanQuery)) {
      const num = parseInt(cleanQuery, 10);
      const absNum = Math.abs(num);
      
      // Add number format variations
      searchTerms = [
        query,                              // Original query
        String(absNum),                     // Plain number without separators
        absNum.toLocaleString('en-US'),     // With commas (e.g., 1,234)
        absNum.toLocaleString('en-US').replace(/,/g, '.'), // With periods (e.g., 1.234)
        `(${absNum})`,                      // Negative format with parentheses (123)
        `(${absNum.toLocaleString('en-US')})` // Negative with commas and parentheses (1,234)
      ];
      
      // Make all search terms lowercase
      searchTerms = searchTerms.map(term => term.toLowerCase());
    }
    
    const matches: SearchMatch[] = [];
    
    // Search through all valid sheets
    validSheets.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      if (!isValidSheet(worksheet)) return;
      
      // Convert sheet to JSON to make it easier to search
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
      
      // Search each row
      jsonData.forEach((row: any[], rowIndex: number) => {
        // Skip empty rows
        if (!row || row.length === 0) return;
        
        // Check if any cell in this row contains the search query
        const hasMatch = row.some(cell => {
          if (cell === null || cell === undefined) return false;
          
          // Convert cell to string and normalize
          const cellStr = String(cell).toLowerCase();
          
          // For numerical cells, check against all number format variations
          if (typeof cell === 'number' || !isNaN(Number(cell))) {
            return searchTerms.some(term => cellStr.includes(term));
          }
          
          // For text cells, just check the original query
          return cellStr.includes(query);
        });
        
        if (hasMatch) {
          matches.push({
            sheetName,
            rowIndex,
            rowData: row
          });
        }
      });
    });
    
    setSearchMatches(matches);
    // Reset the current match index or set to the first match
    setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
    
    // If we have matches, navigate to the first one
    if (matches.length > 0) {
      navigateToMatch(matches[0]);
    }
  }, [workbook, searchQuery, validSheets]);
  
  // Simplified highlight function
  function highlightCurrentMatch() {
    if (currentMatchIndex === -1 || searchMatches.length === 0 || !tableRef.current) return;
    
    const match = searchMatches[currentMatchIndex];
    
    // Only highlight if we're on the correct sheet
    if (match.sheetName !== activeSheet) return;
    
    const table = window.document.getElementById('spreadsheet-table');
    if (!table) return;
    
    // Clear any previous highlights
    const allRows = table.querySelectorAll('tr');
    allRows.forEach(row => {
      row.classList.remove('search-highlight');
      const cells = row.querySelectorAll('td');
      cells.forEach(cell => {
        (cell as HTMLElement).style.backgroundColor = '';
      });
    });
    
    // Find the matching row by index
    let targetRow: HTMLElement | null = null;
    
    // Add potential offsets to handle header rows
    const possibleRowIndices = [match.rowIndex, match.rowIndex + 1, match.rowIndex + 2];
    
    for (const rowIndex of possibleRowIndices) {
      if (rowIndex >= 0 && rowIndex < allRows.length) {
        targetRow = allRows[rowIndex] as HTMLElement;
        
        // Simple verification - basic check if row is empty
        const rowCells = targetRow.querySelectorAll('td');
        if (rowCells.length === 0) continue;
        
        // Check if this row contains any content
        const hasContent = Array.from(rowCells).some(cell => 
          cell.textContent && cell.textContent.trim() !== ''
        );
        
        if (hasContent) {
          break; // We found a non-empty row at this index
        }
      }
    }
    
    // If we couldn't find a row by index, fall back to searching by content
    if (!targetRow) {
      // Prepare number format variations for the search query
      let searchTerms = [searchQuery.toLowerCase()];
      
      // Check if the query could be a number
      const cleanQuery = searchQuery.toLowerCase().replace(/[^\d-]/g, '');
      if (/^-?\d+$/.test(cleanQuery)) {
        const num = parseInt(cleanQuery, 10);
        const absNum = Math.abs(num);
        
        // Add number format variations
        searchTerms = [
          searchQuery.toLowerCase(),
          String(absNum),
          absNum.toLocaleString('en-US').toLowerCase(),
          absNum.toLocaleString('en-US').replace(/,/g, '.').toLowerCase(),
          `(${absNum})`.toLowerCase(),
          `(${absNum.toLocaleString('en-US')})`.toLowerCase()
        ];
      }
      
      // Search content with all possible formats
      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i] as HTMLElement;
        const rowText = row.textContent?.toLowerCase() || '';
        
        // Check if the row contains any of our search terms
        const hasMatch = searchTerms.some(term => rowText.includes(term));
        if (hasMatch) {
          targetRow = row;
          break;
        }
      }
    }
    
    // Highlight the found row
    if (targetRow) {
      // Add highlight class
      targetRow.classList.add('search-highlight');
      
      // Apply highlight style
      const cells = targetRow.querySelectorAll('td');
      cells.forEach(cell => {
        (cell as HTMLElement).style.backgroundColor = '#FFEB3B50'; // Yellow with 50% opacity
      });
      
      // Scroll the row into view
      targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // If not in browser, return a placeholder
  if (!isBrowser) {
    return <SpreadsheetPlaceholder className={className} style={style} />;
  }

  return (
    <div
      className={className}
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'column',
        padding: '0',
        backgroundColor: '#ffffff',
        borderRadius: '4px',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ backgroundColor: 'white', zIndex: 20 }}>
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
          <div className="text-gray-600 font-medium text-lg mb-2">Loading spreadsheet...</div>
          <div className="text-gray-400 text-sm">Preparing data</div>
        </div>
      )}
      
      {/* Error state */}
      {error && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4" style={{ backgroundColor: 'white', zIndex: 20 }}>
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
            <DownloadButton 
              onClick={handleDownload}
              primary={true}
            />
            
            {webpageUrl && (
              <SourceButton
                onClick={handleOpenSourceWebpage}
                domain={extractDomain(webpageUrl)}
              />
            )}
          </div>
        </div>
      )}

      {/* No valid sheets state */}
      {!isLoading && !error && workbook && validSheets.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4" style={{ backgroundColor: 'white', zIndex: 20 }}>
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
            No valid sheets found in this spreadsheet. You can download the file instead.
          </p>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <DownloadButton 
              onClick={handleDownload}
              primary={true}
            />
            
            {webpageUrl && (
              <SourceButton
                onClick={handleOpenSourceWebpage}
                domain={extractDomain(webpageUrl)}
              />
            )}
          </div>
        </div>
      )}
      
      {/* Content loaded and has valid sheets */}
      {!isLoading && !error && workbook && validSheets.length > 0 && (
        <>
          {/* Header area with controls */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '16px',
            backgroundColor: 'transparent',
          }}>
            <div style={{ 
              minWidth: '120px',
              marginRight: '8px'
            }}>
              {renderSheetSelector()}
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '8px',
              marginLeft: 'auto'
            }}>
              {webpageUrl && (
                <SourceButton
                  onClick={handleOpenSourceWebpage}
                  domain={extractDomain(webpageUrl)}
                  minWidth={90}
                />
              )}
            
              <DownloadButton 
                onClick={handleDownload}
                minWidth={90}
              />
            </div>
          </div>
          
          {/* Main content */}
          <div 
            ref={tableRef}
            style={{
              overflow: 'auto',
              flex: 1,
              paddingTop: '64px',
              paddingLeft: '16px',
            }}
          />
          
          {/* Search panel */}
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            zIndex: 5
          }}>
            <SpreadsheetSearch 
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSearch={performSearch}
              onPrevious={navigateToPreviousMatch}
              onNext={navigateToNextMatch}
              onClose={closeSearch}
              matchCount={searchMatches.length}
              currentMatchIndex={currentMatchIndex}
              isOpen={isSearchOpen}
              onToggle={toggleSearch}
            />
          </div>
        </>
      )}
      
      {/* Add CSS for search highlighting and other styles */}
      <style>
        {`
          .search-highlight {
            transition: background-color 0.2s ease;
          }
        `}
      </style>
    </div>
  );
};

export default SpreadsheetViewer; 