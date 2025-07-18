import React from 'react';

interface LoaderProps {
  message?: string;
  className?: string;
  style?: React.CSSProperties;
}

const Loader: React.FC<LoaderProps> = ({ message = 'Loading...', className = '', style }) => (
  <div className={`flex flex-col items-center justify-center w-full h-full ${className}`} style={style}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '3px solid #f3f3f3',
      borderTop: '3px solid #475569',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      marginBottom: '20px'
    }} />
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
    <div className="text-gray-600 font-medium text-lg mb-2">{message}</div>
  </div>
);

export default Loader; 