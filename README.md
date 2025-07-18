<div align="center">
  <img src="assets/banner.svg" alt="Captide Banner" width="100%" />
  <h1>captide.js</h1>
  <p>
    <a href="https://www.npmjs.com/package/captide"><img src="https://img.shields.io/npm/v/captide.svg?style=flat-square" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/captide"><img src="https://img.shields.io/npm/dm/captide.svg?style=flat-square" alt="npm downloads"></a>
    <a href="https://github.com/captide/captide.js/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT license"></a>
    <a href="https://www.linkedin.com/company/captide"><img src="https://img.shields.io/badge/LinkedIn-Captide-blue?style=flat-square&logo=linkedin" alt="LinkedIn"></a>
  </p>
  <p><strong><a href="https://captide.co">Visit our website</a> | <a href="https://app.captide.co">Try our app</a> | <a href="https://docs.captide.co">Documentation</a></strong></p>
  <br/>
</div>

## Overview

Captide enables precise querying across over millions filings and earnings calls, offering best-in-class accuracy for financial analysis. It streamlines data extraction, investment research, and document review—accessible through a user-friendly interface at [app.captide.co](https://app.captide.co) or directly via API.

## About This Package

This npm package provides a document viewer designed to display source documents obtained via Captide's REST API. It is specifically developed to support source linking to answers given by Captide's AI agents that perform Q&A over financial disclosures. The viewer can display HTML, PDF, or XLSX documents and automatically scroll and highlight specific parts in these source documents that correspond to parts of the answer obtained through the API. This helps attribute the AI agent's outputs—such as specific sentences or metrics—directly to their original sources, rendering SEC filings, earnings call transcripts, and international disclosures with precise highlighting of relevant sections.

# Yarn Usage

This project now uses [Yarn](https://yarnpkg.com/) as its package manager. Please use the following commands:

## Install dependencies

```sh
yarn install
```

## Run the development server

```sh
yarn start
```

## Build for production

```sh
yarn build
```

## Usage Examples

### Basic Document Loading

```javascript
import { useDocumentViewer } from '@contexts/document-viewer-context';

const { loadDocument } = useDocumentViewer();

// Load a document by ID
await loadDocument('document-id-123');
```

### Document Loading with Citation Highlighting

```javascript
import { useDocumentViewer } from '@contexts/document-viewer-context';

const { loadDocument } = useDocumentViewer();

// Load a document and highlight specific text
await loadDocument(
  'document-id-123', 
  'element-id-456', 
  'Total net sales $95,359 $90,753 $219,659 $210,328'
);
```

The citation snippet feature provides intelligent text search that can handle:
- **Table data with varying spacing** (e.g., financial data in rows)
- **Fuzzy matching** when exact text isn't found
- **Cross-page search** if the text appears on different pages
- **Visual highlighting** with animated overlays

### Advanced Usage

```javascript
// Load document with specific element highlighting and citation
await loadDocument(
  'https://api.captide.co/documents/123', 
  'highlight-element-789',
  'Revenue increased 15% year-over-year to $2.5 billion'
);
```

## API Access

To request a Captide API license, please contact our sales team at [sales@captide.co](mailto:sales@captide.co).

> **Important Note**: While this npm package (the document viewer component) is available under the MIT license, access to the Captide REST API for retrieving and querying documents requires a separate commercial license. The MIT license applies only to the frontend code in this repository.

## Resources

- **Documentation**: [docs.captide.co](https://docs.captide.co)
- **Website**: [captide.co](https://captide.co)
- **Application**: [app.captide.co](https://app.captide.co) 