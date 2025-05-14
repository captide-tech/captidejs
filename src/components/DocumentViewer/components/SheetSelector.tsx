import React, { useRef } from 'react';

interface SheetSelectorProps {
  sheets: string[];
  activeSheet: string;
  onChange: (sheetName: string) => void;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * A standardized sheet selector component for spreadsheet viewer
 * 
 * Styled to match the other buttons in the document viewers
 */
const SheetSelector: React.FC<SheetSelectorProps> = ({
  sheets,
  activeSheet,
  onChange,
  style = {},
  className = '',
}) => {
  const selectRef = useRef<HTMLSelectElement>(null);
  
  if (sheets.length <= 1) return null;
  
  // Base styles to match buttons exactly
  const baseStyle: React.CSSProperties = {
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    transition: 'background-color 0.2s ease',
    fontSize: '12px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
    height: '32px',
    ...style
  };
  
  // Select dropdown styles
  const selectStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'inherit',
    fontWeight: 'inherit',
    fontSize: 'inherit',
    cursor: 'pointer',
    outline: 'none',
    paddingRight: '0px',
    // Enhanced arrow removal
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage: 'none',
    width: '100%', // Take full width to capture clicks
    height: '100%', // Take full height
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0, // Make invisible but still capture clicks
  };
  
  // CSS to hide the arrow across all browsers and remove focus ring
  const customCSS = `
    select::-ms-expand {
      display: none;
    }
    
    .spreadsheet-select-wrapper select {
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      background-image: none;
    }
    
    /* Remove focus ring and outline */
    .spreadsheet-select-wrapper select:focus {
      outline: none;
      box-shadow: none;
    }
    
    /* Hide focus outline on the wrapper too */
    .spreadsheet-select-wrapper:focus,
    .spreadsheet-select-wrapper:focus-within {
      outline: none;
      box-shadow: none;
    }

    /* Override browser-specific focus styles */
    .spreadsheet-select-container:focus-within {
      outline: none;
      box-shadow: none;
    }
  `;
  
  // Handle hover states
  const handleMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.backgroundColor = '#e2e8f0';
  };
  
  const handleMouseOut = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.backgroundColor = '#f1f5f9';
  };
  
  // Handle click on the entire component
  const handleContainerClick = () => {
    if (selectRef.current) {
      selectRef.current.focus();
      selectRef.current.click();
    }
  };
  
  return (
    <>
      <style>{customCSS}</style>
      <div 
        className={`spreadsheet-select-container ${className}`}
        style={baseStyle}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        onClick={handleContainerClick}
      >
        {/* Spreadsheet icon */}
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
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="3" y1="15" x2="21" y2="15"></line>
          <line x1="9" y1="3" x2="9" y2="21"></line>
          <line x1="15" y1="3" x2="15" y2="21"></line>
        </svg>
        
        {/* Custom button-like selector */}
        <div 
          className="spreadsheet-select-wrapper"
          style={{ 
            position: 'relative', 
            display: 'flex', 
            alignItems: 'center',
            overflow: 'hidden',
            flexGrow: 1
          }}
        >
          {/* Visible text display */}
          <div style={{
            pointerEvents: 'none',
            zIndex: 1
          }}>
            {activeSheet}
          </div>
          
          {/* Actual select element (invisible but captures clicks) */}
          <select
            ref={selectRef}
            value={activeSheet}
            onChange={(e) => onChange(e.target.value)}
            style={selectStyle}
            title="Select sheet"
          >
            {sheets.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          
          {/* Custom dropdown arrow icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              marginLeft: '2px',
              pointerEvents: 'none',
              flexShrink: 0,
              zIndex: 1
            }}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
    </>
  );
};

export default SheetSelector; 