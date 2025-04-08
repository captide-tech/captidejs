# Shareable Links Feature

This guide explains how to implement and use the shareable links feature in your application.

## Overview

The shareable links feature places small link buttons on highlighted document elements, allowing users to easily generate and share links to specific sections of documents. When a colleague opens the link, they'll see the document rendered at the exact same highlighted section.

## Implementation Steps

### 1. Frontend Implementation

#### Basic Setup

```tsx
import { 
  DocumentViewer, 
  DocumentViewerProvider, 
  useDocumentViewer 
} from 'captide';

// In your component:
const YourComponent = () => {
  return (
    <DocumentViewerProvider fetchDocumentFn={yourFetchDocumentFunction}>
      <DocumentViewer 
        shareableLinkBaseUrl="https://your-app-domain.com" 
      />
    </DocumentViewerProvider>
  );
};
```

#### Custom Configuration

You can customize the behavior of the shareable links:

```tsx
<DocumentViewer 
  shareableLinkBaseUrl="https://your-app-domain.com/custom-path"
  shareableLinkButtonColor="#4E7585" // Custom button color (default is blue #2563eb)
/>
```

#### Explicitly Disabling Shareable Links

If you want to provide a base URL but temporarily disable the shareable links feature:

```tsx
<DocumentViewer 
  shareableLinkBaseUrl="https://your-app-domain.com"
  enableShareableLinks={false} // Explicitly disable sharing even with a valid base URL
/>
```

### 2. Backend Implementation

The backend needs to handle two key aspects:

1. Document storage and retrieval
2. Processing of document viewer URLs

#### Document Retrieval

Implement a function that loads documents based on the `sourceLink` parameter:

```typescript
// Example fetchDocumentFn implementation
const fetchDocument = async (sourceLink: string) => {
  const response = await fetch(`/api/documents?sourceLink=${encodeURIComponent(sourceLink)}`);
  const document = await response.json();
  return document;
};
```

#### URL Routing

Create a route in your application that handles the document viewer URLs:

```typescript
// Express.js example
app.get('/document-viewer', async (req, res) => {
  const sourceLink = req.query.sourceLink;
  const elementId = req.query.elementId;
  
  // Render your React app with initial state containing these parameters
  res.render('app', {
    initialState: {
      documentViewer: {
        sourceLink,
        highlightedElementId: elementId
      }
    }
  });
});
```

### 3. App Initialization With URL Parameters

When your app loads, check for document viewer URL parameters:

```tsx
import { parseDocumentViewerParams, useDocumentViewer } from 'captide';

const App = () => {
  const { loadDocument } = useDocumentViewer();
  
  React.useEffect(() => {
    const { sourceLink, elementId } = parseDocumentViewerParams();
    
    if (sourceLink) {
      // Load the document and highlight the element
      loadDocument(sourceLink, elementId);
    }
  }, [loadDocument]);
  
  // Rest of your app
  return (
    <div>
      {/* Your app content */}
    </div>
  );
};
```

## Usage

1. When viewing a document with highlighted sections, users will see a small link button (chain icon) at the top of each highlight
2. The button appears when hovering over a highlighted section
3. Clicking the link button copies a shareable URL to the clipboard
4. When someone opens that URL, they'll see the document with the same section highlighted

## Technical Details

### URL Format

The shareable link format is:
```
https://your-domain.com/document-viewer?sourceLink=encoded-source-link&elementId=element-id
```

### Generated Links

The `generateShareableLink` utility function creates properly formatted URLs:

```typescript
import { generateShareableLink } from 'captide';

const link = generateShareableLink(
  'https://api.example.com/documents/123',
  '#abcd1234',
  'https://your-app.com'
);

// Result: https://your-app.com/document-viewer?sourceLink=https%3A%2F%2Fapi.example.com%2Fdocuments%2F123&elementId=%23abcd1234
```

### Parsing Links

The `parseDocumentViewerParams` utility function extracts parameters from the URL:

```typescript
import { parseDocumentViewerParams } from 'captide';

const { sourceLink, elementId } = parseDocumentViewerParams();
``` 