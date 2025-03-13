# Captide.js

A complete solution for SEC document question-answering and source linking, featuring a React component for viewing and highlighting content in source documents like SEC filings, 8-K documents, and earnings call transcripts.

## 🔑 Installation

```bash
npm install captide
```

## ✨ Key Features

- Question-answering capabilities on SEC filings and earnings calls using RAG
- Document viewer to display original source documents with highlighting
- Source linking connects answers to their original context
- Documents are ONLY loaded when explicitly requested by user interaction
- Clear separation between document state management and document rendering

## 🔐 Authentication

To use Captide services, you need to obtain an API key:

1. Request your API key at [https://www.captide.co/features/api](https://www.captide.co/features/api)
2. Include the API key in the `X-API-Key` header for all API requests to our REST API
3. Explore our full API documentation at [https://rest-api.captide.co/docs](https://rest-api.captide.co/docs) for detailed endpoint information and testing

## 🤖 Question-Answering API

Captide provides powerful endpoints for question-answering on SEC filings:

### Using RAG Chunks

For custom answer generation with relevant document chunks:

```javascript
// Server-side implementation
async function getRelevantChunks(question) {
  const response = await fetch('https://rest-api.captide.co/api/v1/rag/chunks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'YOUR_API_KEY'
    },
    body: JSON.stringify({ 
      query: question 
    })
  });
  
  return response.json();
}
```

**Example Response (simplified):**
```json
{
  "source_chunks": [
    {
      "text": "Net sales disaggregated by significant products and services...",
      "text_with_ids": "<table id=[#704973e4]>\n...\n|Total net sales|$|124,300 [#3b6b9e8c]|||$|119,575 [#90254ecf]||||||\n</table>",
      "metadata": {
        "chunk_id": "123982fb-9b57-4a59-bcb5-2dadf325a075",
        "document_id": "69443120-e3a3-4ebb-91b1-a55ff2afe141",
        "source_link": "https://rest-api.captide.co/api/v1/document?source_type=10-Q&document_id=69443120-e3a3-4ebb-91b1-a55ff2afe141",
        "source_type": "10-Q",
        "fiscal_period": "Q1 2025",
        "ticker": "AAPL",
        "date": "2025-01-31"
      }
    }
  ]
}
```

### Using Agent Query

For AI-powered answers based on document context:

```javascript
// Server-side implementation
async function getAgentAnswer(question) {
  const response = await fetch('https://rest-api.captide.co/api/v1/rag/agent_query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'YOUR_API_KEY'
    },
    body: JSON.stringify({ 
      query: question 
    })
  });
  
  return response.json();
}
```

**Example Response (simplified):**
```json
{
  "answer": [
    {
      "text": "Apple's revenue for the first quarter of fiscal year 2025 was $124.3 billion...",
      "id": "#f3ea0000",
      "source_link": "https://rest-api.captide.co/api/v1/document?source_type=8-K&document_id=f3eae20d-139d-45da-a62c-36a2db36e8f3"
    }
  ],
  "source_chunks": [/* Similar to the chunks endpoint response */]
}
```

### Using Table Output Format

You can also request table-formatted results:

```javascript
// Server-side implementation
async function getTableAnswer(question) {
  const response = await fetch('https://rest-api.captide.co/api/v1/rag/agent_query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'YOUR_API_KEY'
    },
    body: JSON.stringify({ 
      query: question,
      config: {
        output_type: "table"
      }
    })
  });
  
  return response.json();
}
```

**Example Table Response (simplified):**
```json
{
  "answer": {
    "columns": [
      { "name": "Dec 2024" }
    ],
    "rows": [
      {
        "name": "Total net sales",
        "units": ["$", "million"],
        "values_with_ids": [
          {
            "value": 124300,
            "id": "#3b6b9e8c",
            "source_link": "https://rest-api.captide.co/api/v1/document?source_type=10-Q&document_id=69443120-e3a3-4ebb-91b1-a55ff2afe141"
          }
        ]
      }
    ]
  },
  "source_chunks": [/* Document chunks used to generate the response */]
}
```

## 📄 Document Viewer Integration

To implement source linking, you need to fetch source documents using the API:

```javascript
// Server-side implementation
async function fetchDocument(sourceLink) {
  // The sourceLink is already a complete URL from the API: see Question-Answering API section above
  // Example `sourceLink`: https://rest-api.captide.co/api/v1/document?source_type=10-Q&document_id=69443120-e3a3-4ebb-91b1-a55ff2afe141
  const response = await fetch(sourceLink, {
    method: 'GET',
    headers: {
      'X-API-Key': 'YOUR_API_KEY'
    }
  });
  
  return response.json();
}
```

## 🔍 Basic Usage

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

## 🌟 Example Implementation

For a live example of Captide in action, visit [https://app.captide.co](https://app.captide.co) where this library is used for source linking.

## 🛣️ Roadmap

- **Streaming Responses**: Support for Server-Sent Events (SSE) is coming soon, enabling streaming responses for a more interactive experience.
- More document types and enhanced highlighting features

## 📚 API Reference

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

## 📝 License

MIT 