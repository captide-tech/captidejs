import React, { useRef, useEffect, useCallback } from 'react';

interface SpreadsheetSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
  matchCount: number;
  currentMatchIndex: number;
  isOpen: boolean;
  onToggle: () => void;
}

/**
 * A search component for the SpreadsheetViewer
 * 
 * Provides search functionality with navigation controls
 */
const SpreadsheetSearch: React.FC<SpreadsheetSearchProps> = ({
  searchQuery,
  onSearchChange,
  onSearch,
  onPrevious,
  onNext,
  onClose,
  matchCount,
  currentMatchIndex,
  isOpen,
  onToggle
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Focus the input when the search bar opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);
  
  // Run search whenever query changes, with proper cleanup
  useEffect(() => {
    // Only run search if there's actual query text
    if (searchQuery.trim().length > 0) {
      // Small delay to not search on every keystroke
      const timer = setTimeout(() => {
        onSearch();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [searchQuery, onSearch]);
  
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  };
  
  // Handle keyboard events
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onPrevious();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onNext();
    }
  }, [onSearch, onClose, onPrevious, onNext]);
  
  // Add global keyboard event listener for navigation
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' && matchCount > 0) {
        e.preventDefault();
        onPrevious();
      } else if (e.key === 'ArrowDown' && matchCount > 0) {
        e.preventDefault();
        onNext();
      }
    };
    
    // Add the global event listener
    window.addEventListener('keydown', handleKeyDown);
    
    // Clean up
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, matchCount, onPrevious, onNext]);
  
  // Styles for the components
  const buttonStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '13px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
    height: '32px',
    minWidth: '70px',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    fontWeight: 'normal',
    transition: 'background-color 0.15s ease',
  };
  
  const searchBarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: '#f1f5f9',
    padding: '0 6px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    height: '32px',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    maxWidth: '100%',
    width: 'auto',
  };
  
  const inputStyle: React.CSSProperties = {
    border: 'none',
    backgroundColor: 'transparent',
    outline: 'none',
    fontSize: '13px',
    width: '100px',
    maxWidth: '100%',
    color: '#333',
  };
  
  const navButtonStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '2px',
    border: 'none',
    background: 'none',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 0.7,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
    borderRadius: '3px',
    transition: 'all 0.15s ease',
    minWidth: '24px',
    height: '24px',
  });
  
  const closeButtonStyle: React.CSSProperties = {
    padding: '2px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
    opacity: 0.7,
    borderRadius: '3px',
    transition: 'all 0.15s ease',
    minWidth: '24px',
    height: '24px',
  };
  
  // Custom CSS to remove focus ring and add hover effects
  const customCSS = `
    .spreadsheet-search-input:focus {
      outline: none;
      box-shadow: none;
    }
    
    .spreadsheet-nav-button:hover:not(:disabled) {
      background-color: #e2e8f0;
      opacity: 1 !important;
    }
    
    .spreadsheet-close-button:hover {
      background-color: #e2e8f0;
      opacity: 1 !important;
    }
    
    .spreadsheet-search-button:hover {
      background-color: #e2e8f0;
    }
    
    /* Add pulsing animation for active search */
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.1); }
      70% { box-shadow: 0 0 0 5px rgba(99, 102, 241, 0); }
      100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
    }
    
    .search-has-results {
      animation: pulse 2s ease-in-out 1;
    }

    /* Media query for small screens */
    @media (max-width: 640px) {
      .spreadsheet-search-bar {
        max-width: 180px;
      }
      
      .spreadsheet-search-input {
        width: 70px !important;
      }
    }
  `;
  
  if (!isOpen) {
    return (
      <>
        <style>{customCSS}</style>
        <button
          onClick={onToggle}
          style={buttonStyle}
          className="spreadsheet-search-button"
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
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          Search
        </button>
      </>
    );
  }
  
  return (
    <>
      <style>{customCSS}</style>
      <div 
        style={searchBarStyle} 
        className={`spreadsheet-search-bar ${matchCount > 0 ? 'search-has-results' : ''}`}
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
          style={{ color: '#475569', flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={handleSearchInputChange}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search..."
          style={inputStyle}
          className="spreadsheet-search-input"
          aria-label="Search spreadsheet"
        />
        
        <div style={{ 
          color: '#64748b', 
          fontSize: '11px',
          minWidth: '45px',
          textAlign: 'center',
          flexShrink: 0
        }}>
          {matchCount > 0 ? 
            `${currentMatchIndex + 1}/${matchCount}` : 
            ''}
        </div>
        
        <div style={{ display: 'flex', gap: '1px', flexShrink: 0 }}>
          <button
            onClick={onPrevious}
            disabled={matchCount === 0}
            style={navButtonStyle(matchCount === 0)}
            className="spreadsheet-nav-button"
            title="Previous match (Up arrow)"
            aria-label="Previous match"
            tabIndex={matchCount === 0 ? -1 : 0}
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
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
          </button>
          
          <button
            onClick={onNext}
            disabled={matchCount === 0}
            style={navButtonStyle(matchCount === 0)}
            className="spreadsheet-nav-button"
            title="Next match (Down arrow)"
            aria-label="Next match"
            tabIndex={matchCount === 0 ? -1 : 0}
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
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
        
        <button
          onClick={onClose}
          style={closeButtonStyle}
          className="spreadsheet-close-button"
          title="Close search (Escape)"
          aria-label="Close search"
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
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </>
  );
};

export default SpreadsheetSearch; 