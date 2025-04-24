import React, { useState } from 'react';
import { generateShareableLink } from '../utils/shareableLinks';

interface ShareableLinkTooltipProps {
  /**
   * Whether the tooltip is visible
   */
  isVisible: boolean;
  
  /**
   * Position of the tooltip
   */
  position: {
    x: number;
    y: number;
  };
  
  /**
   * The document's source link
   */
  sourceLink: string;
  
  /**
   * The highlighted element ID (with # prefix)
   */
  elementId: string | null;
  
  /**
   * Optional custom base URL for the shareable link
   * Defaults to current origin in generateShareableLink
   */
  baseUrl?: string;
  
  /**
   * Optional callback when tooltip is closed
   */
  onClose?: () => void;

  /**
   * Color for the copy button
   * @default #2563eb
   */
  buttonColor?: string;
  
  /**
   * Custom route path for the document viewer
   * @default document-viewer
   */
  viewerRoutePath?: string;
}

/**
 * A tooltip component that appears when clicking the link button on highlighted document elements,
 * providing the ability to copy a shareable link to the highlighted content.
 */
const ShareableLinkTooltip: React.FC<ShareableLinkTooltipProps> = ({
  isVisible,
  position,
  sourceLink,
  elementId,
  baseUrl,
  onClose,
  buttonColor = '#2563eb',
  viewerRoutePath = 'document-viewer'
}) => {
  const [copied, setCopied] = useState(false);
  
  // Generate the shareable link
  const shareableLink = generateShareableLink(sourceLink, elementId, baseUrl, viewerRoutePath);
  
  // Debug logging
  React.useEffect(() => {
    if (isVisible) {
      console.log('ShareableLinkTooltip visible:', { 
        position,
        sourceLink,
        elementId,
        shareableLink
      });
    }
  }, [isVisible, position, sourceLink, elementId, shareableLink]);
  
  // Handle copying the link to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopied(true);
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };
  
  // If not visible, don't render anything
  if (!isVisible) return null;

  // Convert buttonColor to RGB for transparency
  const getRgbColor = (hexColor: string) => {
    // Remove the # if it exists
    const hex = hexColor.replace('#', '');
    
    // Parse the hex values to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return { r, g, b };
  };
  
  const { r, g, b } = getRgbColor(buttonColor);
  const textColor = "text-white";
  
  return (
    <div 
      className="absolute z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-80 shareable-link-tooltip-container"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateX(-25%)', // Offset slightly to align with the left button
      }}
    >
      {/* Arrow pointing up to the link button */}
      <div 
        className="absolute w-4 h-4 bg-white border-t border-l border-gray-200 transform rotate-45"
        style={{
          top: '-2px',
          left: '25%', // Position arrow to align with the left-side button
          marginLeft: '-2px',
        }}
      />
      
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <svg 
            className="w-4 h-4 mr-2"
            style={{ color: buttonColor }}
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
          <span className="text-sm font-medium">Share this highlight</span>
        </div>
        <button 
          className="text-gray-400 hover:text-gray-600 transition-colors"
          onClick={onClose}
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div className="text-xs text-gray-500 mb-2">
        Anyone with this link can view this highlighted section:
      </div>
      
      <div className="flex items-center">
        <input
          type="text"
          value={shareableLink}
          readOnly
          className="flex-1 p-2 text-sm border rounded-l-md bg-gray-50 text-gray-700 overflow-hidden text-ellipsis focus:outline-none"
        />
        <button
          onClick={copyToClipboard}
          className={`px-3 py-2 rounded-r-md text-sm font-medium ${textColor} transition-colors`}
          style={{
            backgroundColor: copied ? '#10B981' : buttonColor
          }}
        >
          {copied ? (
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Copied</span>
            </div>
          ) : (
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Copy</span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
};

export default ShareableLinkTooltip; 