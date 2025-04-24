# Captide.js

A complete solution for SEC document question-answering and source linking, featuring a React component for viewing and highlighting content in source documents like SEC filings, 8-K documents, and earnings call transcripts.

## 📚 Documentation

For comprehensive documentation, including installation instructions, API references, and advanced usage examples, please visit our official documentation:

[https://docs.captide.co](https://docs.captide.co)

## 🌟 Example Implementation

For a live example of Captide in action, visit [https://app.captide.co](https://app.captide.co) where this library is used for source linking.

```jsx
import React from 'react';
import { DocumentViewer, DocumentViewerProvider, useDocumentViewer } from 'captide';

// Function to fetch document content from your backend that calls our API
const fetchDocument = async (sourceLink) => {
  const response = await fetch('/your-backend/document', {
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
  
  // IMPORTANT: sourceLink and elementId come from your API response
  // - sourceLink: The 'source_link' field from the API response
  // - elementId: The 'id' field from either:
  //   * The 'answer' field when using /rag/agent_query endpoint
  //   * The 'metadata' field when using /rag/chunks endpoint
  const handleSourceLinkClick = async (sourceLink, elementId) => {
    // Load document and highlight specific element
    await loadDocument(sourceLink, elementId);
  };
  
  return (
    <div>
      <button 
        onClick={() => handleSourceLinkClick(
          'https://rest-api.captide.co/api/v1/document?source_type=10-Q&document_id=69443120-e3a3-4ebb-91b1-a55ff2afe141',
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

## 📝 License

MIT 