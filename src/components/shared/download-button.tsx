import React from 'react';

interface DownloadButtonProps {
  onClick: () => void;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * A simple icon-only download button component
 */
const DownloadButton: React.FC<DownloadButtonProps> = ({
  onClick,
  style = {},
  className = ''
}) => {
  const buttonStyle: React.CSSProperties = {
    width: '32px',
    height: '32px',
    padding: '8px',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    color: '#475569',
    border: '1px solid rgba(203, 213, 225, 0.5)',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    transition: 'background-color 0.2s ease',
    ...style
  };
  
  // Handle hover states
  const handleMouseOver = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.backgroundColor = '#f8fafc';
  };
  
  const handleMouseOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
  };
  
  return (
    <button
      onClick={onClick}
      style={buttonStyle}
      className={className}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      title="Download PDF"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
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
    </button>
  );
};

export default DownloadButton; 