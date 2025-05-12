# Captide - Financial Document Viewer

Get hundreds of thousands of financial documents into your AI app 🚀

## Features

- Render SEC filings (10-K, 10-Q, 8-K, 20-F, 40-F, 6-K)
- Support for earnings call transcripts
- Element-based highlighting
- Support for PDF and Excel documents
- Shareable links to specific sections
- Zoom controls

## Installation

```bash
npm install captide
# or
yarn add captide
```

## Basic Usage

```jsx
import { DocumentViewer, DocumentViewerProvider } from 'captide';

function App() {
  return (
    <DocumentViewerProvider>
      <div style={{ height: '800px' }}>
        <DocumentViewer 
          enableShareableLinks={true}
          shareableLinkBaseUrl="https://yourdomain.com"
        />
      </div>
    </DocumentViewerProvider>
  );
}
```

## Server-Side Rendering (SSR) Compatibility

Captide is designed to work seamlessly in both client and server environments.

### Next.js App Router Usage (Recommended)

When using Captide with Next.js App Router, add the `'use client'` directive to mark the component as client-side only:

```jsx
'use client';

import { DocumentViewer, DocumentViewerProvider } from 'captide';

export default function DocumentViewerPage() {
  return (
    <DocumentViewerProvider>
      <div style={{ height: '100vh' }}>
        <DocumentViewer />
      </div>
    </DocumentViewerProvider>
  );
}
```

### Next.js Pages Router Usage

When using Captide with Next.js Pages Router, the component will work, but to avoid SSR-related issues with browser-specific APIs like `DOMMatrix`, you may need to use dynamic imports:

```jsx
// pages/document-viewer.js
import dynamic from 'next/dynamic';

// Import with no SSR
const DocumentViewer = dynamic(
  () => import('captide').then(mod => mod.DocumentViewer),
  { ssr: false }
);

const DocumentViewerProvider = dynamic(
  () => import('captide').then(mod => mod.DocumentViewerProvider),
  { ssr: false }
);

export default function DocumentViewerPage() {
  return (
    <DocumentViewerProvider>
      <div style={{ height: '100vh' }}>
        <DocumentViewer />
      </div>
    </DocumentViewerProvider>
  );
}
```

## Document Types

Captide supports various document types:

1. **HTML Documents** - SEC filings, transcripts, and other HTML-based documents
2. **PDF Documents** - Direct PDF viewing with page navigation
3. **Spreadsheet Files** - Excel files with download/open options

The `DocumentViewer` component automatically selects the appropriate viewer based on the document properties.

## API Reference

### DocumentViewer

```jsx
<DocumentViewer
  className="w-full h-full"
  showZoomControls={true}
  enableShareableLinks={true}
  shareableLinkBaseUrl="https://yourdomain.com"
  shareableLinkButtonColor="#2563eb"
  viewerRoutePath="document-viewer"
/>
```

### DocumentViewerProvider

```jsx
<DocumentViewerProvider
  initialState={{
    document: myDocument,
    highlightedElementId: 'section-1',
    zoomLevel: 1.0
  }}
>
  {children}
</DocumentViewerProvider>
```

### useDocumentViewer Hook

```jsx
import { useDocumentViewer } from 'captide';

function MyComponent() {
  const { 
    document,
    highlightedElementId,
    setDocument,
    setHighlightedElementId,
    zoomIn,
    zoomOut,
    resetZoom
  } = useDocumentViewer();
  
  return (
    // Your component implementation
  );
}
```

## License

MIT 