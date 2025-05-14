import React from 'react';

interface SourceButtonProps {
  onClick: () => void;
  domain: string;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * A standardized source button component for document viewers
 * 
 * Used to provide a link to the original source of a document
 */
const SourceButton: React.FC<SourceButtonProps> = ({
  onClick,
  domain,
  style = {},
  className = ''
}) => {
  const buttonStyle: React.CSSProperties = {
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
    fontSize: '12px',
    ...style
  };
  
  const handleMouseOver = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.backgroundColor = '#f8fafc';
  };
  
  const handleMouseOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.backgroundColor = '#ffffff';
  };
  
  return (
    <button
      onClick={onClick}
      style={buttonStyle}
      className={className}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      title={`Open original source website: ${domain}`}
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
      Source: {domain}
    </button>
  );
};

export default SourceButton; 