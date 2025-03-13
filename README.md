# Captide Document Viewer

A React component for viewing and highlighting content in source documents like SEC filings, 8-K documents, and earnings call transcripts.

## Installation

```bash
npm install captide
```

## Key Design Principles

- Documents are ONLY loaded when explicitly requested by user interaction
- Document fetching never happens automatically during component initialization
- Clear separation between document state management and document rendering

## Basic Usage

```jsx
import React from 'react';
import { DocumentViewer, DocumentViewerProvider, useDocumentViewer } from 'captide';

// Function to fetch document content from your API
const fetchDocument = async (sourceLink) => {
  const response = await fetch('/your-api/document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_link: sourceLink })
  });
  
  return response.json();
};

// Example component using the DocumentViewer
function App() {
  return (
    <DocumentViewerProvider fetchDocumentFn={fetchDocument}>
      <DocumentViewerDemo />
    </DocumentViewerProvider>
  );
}

function DocumentViewerDemo() {
  const { loadDocument } = useDocumentViewer();
  
  const handleSourceLinkClick = async (sourceLink, elementId) => {
    // Load document and highlight specific element
    await loadDocument(sourceLink, elementId);
  };
  
  return (
    <div>
      <button 
        onClick={() => handleSourceLinkClick(
          'https://your-api.com/document?source_type=10-K&document_id=123',
          '#ab12ef34'
        )}
      >
        View Source
      </button>
      
      <div style={{ height: '600px', width: '100%', border: '1px solid #ccc' }}>
        <DocumentViewer />
      </div>
    </div>
  );
}

export default App;
```

## Advanced Usage: Adapter Pattern

For more complex applications, you might want to create an adapter that connects your document service with the Captide component:

```jsx
// CaptideViewerAdapter.jsx
import React from 'react';
import { DocumentViewerProvider } from 'captide';
import { yourDocumentService } from './services';

export const CaptideViewerAdapter = ({ children }) => {
  const fetchDocument = async (sourceLink) => {
    // Add validation and error handling
    if (!sourceLink) {
      throw new Error('Cannot fetch document: sourceLink is required');
    }
    
    // Use your application's document service
    const document = await yourDocumentService.fetchDocument(sourceLink);
    
    // Add the sourceLink property required by Captide
    return {
      ...document,
      sourceLink
    };
  };

  return (
    <DocumentViewerProvider fetchDocumentFn={fetchDocument}>
      {children}
    </DocumentViewerProvider>
  );
};
```

## API Reference

### `<DocumentViewerProvider>`

Provider component for managing DocumentViewer state.

#### Props

- `children`: React nodes to be wrapped by the provider
- `fetchDocumentFn` (optional): Function for fetching documents by sourceLink

### `<DocumentViewer>`

The document viewer component that renders an iframe with document content.

#### Props

- `className` (optional): Custom CSS class name
- `style` (optional): Inline styles

### `useDocumentViewer()`

Hook for accessing the DocumentViewer context.

#### Returns

- `document`: Current document being displayed
- `sourceType`: Type of source document
- `highlightedElementId`: ID of highlighted element
- `isLoading`: Loading state
- `setDocument(document)`: Set a document directly
- `highlightElement(elementId)`: Highlight an element
- `loadDocument(sourceLink, elementId?)`: Load a document and optionally highlight an element
- `setFetchDocumentFn(fn)`: Set the function for fetching documents

### SourceDocument

Interface for document data:

```typescript
interface SourceDocument {
  htmlContent: string;
  sourceType: '10-K' | '10-Q' | '8-K' | 'transcript';
  date: string;
  fiscalPeriod: string;
  ticker: string;
  companyName: string;
  sourceLink: string;
  pageNumber?: number;
}
```

## License

MIT 