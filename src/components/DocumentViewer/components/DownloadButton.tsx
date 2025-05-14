import React from 'react';

interface DownloadButtonProps {
  onClick: () => void;
  label?: string;
  style?: React.CSSProperties;
  className?: string;
  primary?: boolean;
}

/**
 * A standardized download button component for document viewers
 * 
 * Can be styled as primary (solid background) or secondary (light background) button
 */
const DownloadButton: React.FC<DownloadButtonProps> = ({
  onClick,
  label = 'Download',
  style = {},
  className = '',
  primary = false
}) => {
  // Base styles for both primary and secondary buttons
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
    ...style
  };
  
  // Primary button styles (for emphasis)
  const primaryStyle: React.CSSProperties = {
    ...baseStyle,
    backgroundColor: '#475569',
    color: '#ffffff',
    border: '1px solid #475569',
  };
  
  // Secondary button styles (less emphasis)
  const secondaryStyle: React.CSSProperties = {
    ...baseStyle,
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
  };
  
  // Use the appropriate style based on the primary prop
  const buttonStyle = primary ? primaryStyle : secondaryStyle;
  
  // Handle hover states
  const handleMouseOver = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.backgroundColor = primary ? '#3f4a5c' : '#e2e8f0';
  };
  
  const handleMouseOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.backgroundColor = primary ? '#475569' : '#f1f5f9';
  };
  
  return (
    <button
      onClick={onClick}
      style={buttonStyle}
      className={className}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      title={`Download ${label}`}
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
      {label}
    </button>
  );
};

export default DownloadButton; 