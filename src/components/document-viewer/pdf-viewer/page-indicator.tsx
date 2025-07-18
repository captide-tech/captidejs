import React from 'react';

interface PageIndicatorProps {
  currentPage: number;
  totalPages: number;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * A standardized page indicator component for document viewers
 * 
 * Displays the current page number and total pages
 */
const PageIndicator: React.FC<PageIndicatorProps> = ({
  currentPage,
  totalPages,
  style = {},
  className = ''
}) => {
  const indicatorStyle: React.CSSProperties = {
    padding: '6px 12px',
    backgroundColor: 'white',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    display: 'inline-flex',
    alignItems: 'center',
    ...style
  };
  
  return (
    <div
      style={indicatorStyle}
      className={className}
    >
      Page {currentPage} of {totalPages}
    </div>
  );
};

export default PageIndicator; 