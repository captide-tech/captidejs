import { SourceType } from '../../types';

export interface DocumentViewerProps {
  /**
   * Optional custom CSS class name
   */
  className?: string;
  
  /**
   * Optional inline styles
   */
  style?: React.CSSProperties;
  
  /**
   * Whether to show zoom controls
   * @default true
   */
  showZoomControls?: boolean;

  /**
   * Whether to explicitly disable the hover-to-share feature
   * Set this to false to disable sharing even when shareableLinkBaseUrl is provided
   * @default true
   */
  enableShareableLinks?: boolean;
  
  /**
   * Base URL for shareable links
   * When provided, sharing features are automatically enabled (unless explicitly disabled)
   */
  shareableLinkBaseUrl?: string;

  /**
   * Color for the shareable link button
   * @default #2563eb
   */
  shareableLinkButtonColor?: string;
  
  /**
   * Custom route path for the document viewer
   * @default document-viewer
   */
  viewerRoutePath?: string;
}

export interface TooltipPosition {
  x: number;
  y: number;
} 