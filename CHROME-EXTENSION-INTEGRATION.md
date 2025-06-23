# Scout Chrome Extension - Backend Integration Guide

## 🎯 Overview
This guide provides complete instructions for integrating the Scout Chrome Extension with the Scout Backend LangGraph.js server for real-time Web3 AI analysis.

## 🏗️ Architecture Overview

```
Chrome Extension (Frontend) ←→ Scout Backend (LangGraph.js) ←→ Nodit MCP Server ←→ Blockchain Data
      ↓                              ↓                           ↓                    ↓
  Content Scripts              Multi-Node Graph              Live APIs           Ethereum/Polygon
  Background Script            AI Classification             Token Data          Smart Contracts
  Popup Interface              Entity Detection              Contract Info       Wallet Addresses
```

## 🚀 Quick Start

### 1. Start the Backend Server
```bash
cd backend
pnpm install
pnpm run dev  # Development mode with hot reload
# OR
pnpm run build && pnpm start  # Production mode
```

Backend will be available at: `http://localhost:3001`

### 2. Verify Backend Health
```bash
curl http://localhost:3001/health
# Expected response: {"status":"healthy","timestamp":"...","version":"1.0.0"}
```

## 📡 API Integration

### Primary Analysis Endpoint

**POST** `/analyze`

#### Request Format
```javascript
const analyzeRequest = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  body: JSON.stringify({
    input: "user's Web3 query here",
    options: {
      includeRiskAssessment: true,
      includeHolderInfo: true,
      maxResponseTime: 15000  // Optional timeout
    }
  })
};

const response = await fetch('http://localhost:3001/analyze', analyzeRequest);
const result = await response.json();
```

#### Response Format
```javascript
{
  // Classification Results
  "classification": "web3" | "non-web3",
  "confidence": 0.95,
  
  // Detected Entities
  "detectedTokens": ["BTC", "ETH", "USDT"],
  "detectedContracts": ["0xdAC17F958D2ee523a2206206994597C13D831ec7"],
  "detectedWallets": ["0xF977814e90dA44bFA03b6295A0616a897441aceC"],
  
  // Analysis Data
  "tokenData": [
    {
      "symbol": "USDT",
      "contractAddress": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      "metadata": {
        "name": "Tether USD",
        "symbol": "USDT",
        "decimals": 6,
        "totalSupply": "48904830845102264",
        "deployedAt": "2017-11-28T00:41:21.000Z"
      },
      "holderInfo": {
        "count": 7900000,
        "items": [...]
      },
      "success": true,
      "riskLevel": "✅ Well-established"
    }
  ],
  
  "contractData": [
    {
      "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      "network": "ethereum",
      "addressType": "contract",
      "contractType": "token",
      "tokenMetadata": [...],
      "tokenHolders": {...}
    }
  ],
  
  "walletData": [
    {
      "address": "0xF977814e90dA44bFA03b6295A0616a897441aceC",
      "network": "ethereum",
      "isWallet": true,
      "note": "Confirmed wallet address"
    }
  ],
  
  // System Status
  "mcpConnected": true,
  "analysisStats": {
    "total": 3,
    "successful": 3,
    "tokens": { "total": 2, "successful": 2 },
    "contracts": { "total": 1, "successful": 1 },
    "wallets": { "total": 1, "successful": 1 }
  },
  
  // AI Response
  "output": "Hey there! I've analyzed your Web3 query about USDT...",
  
  // Performance
  "processingTime": 8500,
  "dataQuality": "✅ High quality"
}
```

## 🔧 Chrome Extension Implementation

### 1. Background Script Integration

```javascript
// background.js or background.ts
class ScoutBackendAPI {
  constructor() {
    this.baseURL = 'http://localhost:3001';
    this.timeout = 15000;
  }

  async analyzeWeb3Content(input, options = {}) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseURL}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          input,
          options: {
            includeRiskAssessment: true,
            includeHolderInfo: true,
            ...options
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('Scout Backend API Error:', error);
      return {
        success: false,
        error: error.message,
        fallbackResponse: this.getFallbackResponse(input)
      };
    }
  }

  getFallbackResponse(input) {
    return {
      classification: "unknown",
      confidence: 0.5,
      output: "I'm having trouble connecting to the analysis server. Please try again in a moment.",
      mcpConnected: false,
      detectedTokens: [],
      detectedContracts: [],
      detectedWallets: []
    };
  }

  async checkHealth() {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

const scoutAPI = new ScoutBackendAPI();

// Message handler for content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeWeb3') {
    scoutAPI.analyzeWeb3Content(request.input, request.options)
      .then(sendResponse);
    return true; // Async response
  }
  
  if (request.action === 'checkBackendHealth') {
    scoutAPI.checkHealth().then(sendResponse);
    return true;
  }
});
```

### 2. Content Script Integration

```javascript
// content.js
class ScoutContentAnalyzer {
  constructor() {
    this.isAnalyzing = false;
    this.cache = new Map();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Analyze selected text
    document.addEventListener('mouseup', () => {
      const selectedText = window.getSelection().toString().trim();
      if (selectedText && this.couldBeWeb3Content(selectedText)) {
        this.analyzeContent(selectedText);
      }
    });

    // Monitor for Web3 patterns in page content
    this.observePageChanges();
  }

  couldBeWeb3Content(text) {
    const web3Patterns = [
      /0x[a-fA-F0-9]{40}/,           // Ethereum addresses
      /\b(BTC|ETH|USDT|USDC|BNB|SOL|MATIC|WETH|WBTC|UNI|AAVE)\b/i, // Token tickers
      /\b(bitcoin|ethereum|crypto|defi|nft|web3|blockchain)\b/i       // Keywords
    ];
    
    return web3Patterns.some(pattern => pattern.test(text));
  }

  async analyzeContent(input) {
    if (this.isAnalyzing || !input) return;
    
    // Check cache first
    const cacheKey = input.toLowerCase();
    if (this.cache.has(cacheKey)) {
      this.displayResult(this.cache.get(cacheKey));
      return;
    }

    this.isAnalyzing = true;
    this.showLoadingIndicator();

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'analyzeWeb3',
        input: input,
        options: {
          includeRiskAssessment: true,
          includeHolderInfo: true
        }
      });

      if (result.success) {
        this.cache.set(cacheKey, result.data);
        this.displayResult(result.data);
      } else {
        this.displayError(result.error);
      }

    } catch (error) {
      console.error('Analysis error:', error);
      this.displayError('Analysis failed. Please try again.');
    } finally {
      this.isAnalyzing = false;
      this.hideLoadingIndicator();
    }
  }

  displayResult(data) {
    // Create and show Scout analysis popup
    const popup = this.createResultPopup(data);
    document.body.appendChild(popup);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
    }, 10000);
  }

  createResultPopup(data) {
    const popup = document.createElement('div');
    popup.className = 'scout-analysis-popup';
    popup.innerHTML = `
      <div class="scout-popup-header">
        <span class="scout-logo">🔍 Scout AI</span>
        <button class="scout-close">&times;</button>
      </div>
      <div class="scout-popup-content">
        ${this.formatAnalysisResult(data)}
      </div>
    `;

    // Add styles
    this.addPopupStyles();
    
    // Close button handler
    popup.querySelector('.scout-close').addEventListener('click', () => {
      popup.remove();
    });

    return popup;
  }

  formatAnalysisResult(data) {
    let html = '';
    
    // Classification
    html += `<div class="scout-classification">
      <strong>Classification:</strong> ${data.classification} 
      <span class="scout-confidence">(${Math.round(data.confidence * 100)}% confidence)</span>
    </div>`;

    // Tokens
    if (data.detectedTokens?.length > 0) {
      html += `<div class="scout-tokens">
        <strong>🪙 Tokens:</strong> ${data.detectedTokens.join(', ')}
      </div>`;
    }

    // Contracts
    if (data.detectedContracts?.length > 0) {
      html += `<div class="scout-contracts">
        <strong>📋 Contracts:</strong> ${data.detectedContracts.length} detected
      </div>`;
    }

    // Wallets
    if (data.detectedWallets?.length > 0) {
      html += `<div class="scout-wallets">
        <strong>👤 Wallets:</strong> ${data.detectedWallets.length} detected
      </div>`;
    }

    // AI Response
    if (data.output) {
      html += `<div class="scout-response">
        <strong>Analysis:</strong>
        <p>${data.output.substring(0, 200)}${data.output.length > 200 ? '...' : ''}</p>
      </div>`;
    }

    // Status
    html += `<div class="scout-status">
      <span class="scout-mcp ${data.mcpConnected ? 'connected' : 'disconnected'}">
        ${data.mcpConnected ? '🟢 Live Data' : '🔴 Offline'}
      </span>
      <span class="scout-timing">${data.processingTime || 0}ms</span>
    </div>`;

    return html;
  }

  addPopupStyles() {
    if (document.getElementById('scout-popup-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'scout-popup-styles';
    styles.textContent = `
      .scout-analysis-popup {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 350px;
        background: white;
        border: 2px solid #007acc;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        line-height: 1.4;
      }
      
      .scout-popup-header {
        background: linear-gradient(135deg, #007acc, #0056b3);
        color: white;
        padding: 12px 16px;
        border-radius: 10px 10px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .scout-logo {
        font-weight: bold;
        font-size: 16px;
      }
      
      .scout-close {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
      }
      
      .scout-popup-content {
        padding: 16px;
      }
      
      .scout-classification,
      .scout-tokens,
      .scout-contracts,
      .scout-wallets,
      .scout-response {
        margin-bottom: 12px;
      }
      
      .scout-confidence {
        color: #666;
        font-size: 12px;
      }
      
      .scout-response p {
        margin: 4px 0 0 0;
        color: #333;
        font-style: italic;
      }
      
      .scout-status {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 12px;
        border-top: 1px solid #eee;
        font-size: 12px;
      }
      
      .scout-mcp.connected { color: #28a745; }
      .scout-mcp.disconnected { color: #dc3545; }
      
      .scout-timing {
        color: #6c757d;
      }
    `;
    
    document.head.appendChild(styles);
  }

  showLoadingIndicator() {
    // Implementation for loading state
  }

  hideLoadingIndicator() {
    // Implementation for hiding loading state
  }

  displayError(error) {
    console.error('Scout analysis error:', error);
  }

  observePageChanges() {
    // Monitor for dynamic content changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Check new nodes for Web3 content
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE && this.couldBeWeb3Content(node.textContent)) {
              // Handle new Web3 content
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ScoutContentAnalyzer();
  });
} else {
  new ScoutContentAnalyzer();
}
```

### 3. Popup Interface Integration

```javascript
// popup.js
class ScoutPopup {
  constructor() {
    this.api = new ScoutBackendAPI();
    this.init();
  }

  async init() {
    this.setupUI();
    await this.checkBackendStatus();
    this.setupEventListeners();
  }

  setupUI() {
    document.body.innerHTML = `
      <div class="scout-popup">
        <header class="scout-header">
          <h1>🔍 Scout AI</h1>
          <div class="scout-status" id="status">
            <span id="status-indicator">🟡</span>
            <span id="status-text">Checking...</span>
          </div>
        </header>
        
        <main class="scout-main">
          <div class="scout-input-section">
            <textarea 
              id="query-input" 
              placeholder="Enter Web3 query (tokens, contracts, wallets)..."
              rows="3"
            ></textarea>
            <button id="analyze-btn" disabled>Analyze</button>
          </div>
          
          <div class="scout-results" id="results" style="display: none;">
            <!-- Results will be populated here -->
          </div>
          
          <div class="scout-examples">
            <h3>Try these examples:</h3>
            <div class="scout-example-buttons">
              <button class="example-btn" data-query="what is Bitcoin">Bitcoin Info</button>
              <button class="example-btn" data-query="0xdAC17F958D2ee523a2206206994597C13D831ec7">USDT Contract</button>
              <button class="example-btn" data-query="swap ETH for USDC">Token Swap</button>
            </div>
          </div>
        </main>
      </div>
    `;
  }

  async checkBackendStatus() {
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const analyzeBtn = document.getElementById('analyze-btn');

    try {
      const isHealthy = await this.api.checkHealth();
      if (isHealthy) {
        statusIndicator.textContent = '🟢';
        statusText.textContent = 'Connected';
        analyzeBtn.disabled = false;
      } else {
        throw new Error('Backend not responding');
      }
    } catch (error) {
      statusIndicator.textContent = '🔴';
      statusText.textContent = 'Disconnected';
      analyzeBtn.disabled = true;
    }
  }

  setupEventListeners() {
    const analyzeBtn = document.getElementById('analyze-btn');
    const queryInput = document.getElementById('query-input');

    analyzeBtn.addEventListener('click', () => {
      this.analyzeQuery(queryInput.value.trim());
    });

    queryInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.analyzeQuery(queryInput.value.trim());
      }
    });

    // Example buttons
    document.querySelectorAll('.example-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const query = btn.dataset.query;
        queryInput.value = query;
        this.analyzeQuery(query);
      });
    });
  }

  async analyzeQuery(query) {
    if (!query) return;

    const resultsDiv = document.getElementById('results');
    const analyzeBtn = document.getElementById('analyze-btn');

    // Show loading
    analyzeBtn.textContent = 'Analyzing...';
    analyzeBtn.disabled = true;
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = '<div class="loading">🔄 Analyzing your Web3 query...</div>';

    try {
      const result = await this.api.analyzeWeb3Content(query);
      
      if (result.success) {
        this.displayResults(result.data);
      } else {
        this.displayError(result.error);
      }
    } catch (error) {
      this.displayError(error.message);
    } finally {
      analyzeBtn.textContent = 'Analyze';
      analyzeBtn.disabled = false;
    }
  }

  displayResults(data) {
    const resultsDiv = document.getElementById('results');
    
    let html = `
      <div class="result-header">
        <h3>Analysis Results</h3>
        <div class="result-meta">
          <span class="classification ${data.classification}">${data.classification}</span>
          <span class="confidence">${Math.round(data.confidence * 100)}%</span>
          <span class="timing">${data.processingTime || 0}ms</span>
        </div>
      </div>
    `;

    // Entities
    if (data.detectedTokens?.length || data.detectedContracts?.length || data.detectedWallets?.length) {
      html += '<div class="entities-section">';
      
      if (data.detectedTokens?.length) {
        html += `<div class="entity-group">
          <strong>🪙 Tokens (${data.detectedTokens.length}):</strong>
          <div class="entity-tags">
            ${data.detectedTokens.map(token => `<span class="tag token">${token}</span>`).join('')}
          </div>
        </div>`;
      }

      if (data.detectedContracts?.length) {
        html += `<div class="entity-group">
          <strong>📋 Contracts (${data.detectedContracts.length}):</strong>
          <div class="entity-list">
            ${data.detectedContracts.map(addr => 
              `<div class="contract-item">${addr.substring(0,10)}...${addr.substring(38)}</div>`
            ).join('')}
          </div>
        </div>`;
      }

      if (data.detectedWallets?.length) {
        html += `<div class="entity-group">
          <strong>👤 Wallets (${data.detectedWallets.length}):</strong>
          <div class="entity-list">
            ${data.detectedWallets.map(addr => 
              `<div class="wallet-item">${addr.substring(0,10)}...${addr.substring(38)}</div>`
            ).join('')}
          </div>
        </div>`;
      }

      html += '</div>';
    }

    // AI Response
    if (data.output) {
      html += `<div class="ai-response">
        <strong>🤖 Scout Analysis:</strong>
        <p>${data.output}</p>
      </div>`;
    }

    // Status
    html += `<div class="analysis-status">
      <div class="status-item">
        <span class="label">Data Source:</span>
        <span class="value ${data.mcpConnected ? 'connected' : 'offline'}">
          ${data.mcpConnected ? '🟢 Live Blockchain' : '🔴 Offline Mode'}
        </span>
      </div>
      ${data.analysisStats ? `
        <div class="status-item">
          <span class="label">Success Rate:</span>
          <span class="value">${data.analysisStats.successful}/${data.analysisStats.total}</span>
        </div>
      ` : ''}
    </div>`;

    resultsDiv.innerHTML = html;
  }

  displayError(error) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `
      <div class="error-message">
        <h3>❌ Analysis Failed</h3>
        <p>${error}</p>
        <button onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  new ScoutPopup();
});
```

## 🎨 CSS Styling

Add this to your extension's CSS files:

```css
/* popup.css */
.scout-popup {
  width: 400px;
  max-height: 600px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.scout-header {
  background: linear-gradient(135deg, #007acc, #0056b3);
  color: white;
  padding: 16px;
  text-align: center;
}

.scout-header h1 {
  margin: 0 0 8px 0;
  font-size: 20px;
}

.scout-status {
  font-size: 12px;
  opacity: 0.9;
}

.scout-main {
  padding: 16px;
}

.scout-input-section {
  margin-bottom: 20px;
}

.scout-input-section textarea {
  width: 100%;
  border: 2px solid #ddd;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  resize: vertical;
  margin-bottom: 12px;
}

.scout-input-section button {
  width: 100%;
  background: #007acc;
  color: white;
  border: none;
  padding: 12px;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}

.scout-input-section button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.scout-examples {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.scout-example-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.example-btn {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.example-btn:hover {
  background: #e9ecef;
}

/* Results styling */
.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}

.result-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
}

.classification.web3 { background: #d4edda; color: #155724; padding: 2px 8px; border-radius: 4px; }
.classification.non-web3 { background: #f8d7da; color: #721c24; padding: 2px 8px; border-radius: 4px; }

.entities-section {
  margin: 16px 0;
}

.entity-group {
  margin-bottom: 12px;
}

.entity-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.tag {
  background: #007acc;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
}

.ai-response {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 8px;
  margin: 16px 0;
}

.ai-response p {
  margin: 8px 0 0 0;
  line-height: 1.5;
}

.analysis-status {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #eee;
  font-size: 12px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.value.connected { color: #28a745; }
.value.offline { color: #dc3545; }

.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
}
```

## 📋 Manifest Configuration

Update your `manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Scout - Web3 AI Assistant",
  "version": "1.0.0",
  "description": "AI-powered Web3 analysis for tokens, contracts, and wallets",
  
  "permissions": [
    "activeTab",
    "storage",
    "scripting"
  ],
  
  "host_permissions": [
    "http://localhost:3001/*",
    "https://your-backend-domain.com/*"
  ],
  
  "background": {
    "service_worker": "background.js"
  },
  
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle"
    }
  ],
  
  "action": {
    "default_popup": "popup.html",
    "default_title": "Scout Web3 AI"
  },
  
  "icons": {
    "16": "icons/icon16.svg",
    "48": "icons/icon48.svg",
    "128": "icons/icon128.svg"
  }
}
```

## 🔧 Error Handling & Fallbacks

### Backend Connectivity Issues
```javascript
class BackendFallbackHandler {
  constructor() {
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  async analyzeWithRetry(input, attempt = 1) {
    try {
      return await scoutAPI.analyzeWeb3Content(input);
    } catch (error) {
      if (attempt < this.retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        return this.analyzeWithRetry(input, attempt + 1);
      }
      
      // Final fallback
      return this.getOfflineResponse(input);
    }
  }

  getOfflineResponse(input) {
    // Basic pattern matching for offline mode
    const patterns = {
      address: /0x[a-fA-F0-9]{40}/,
      token: /\b(BTC|ETH|USDT|USDC|BNB)\b/i
    };

    let response = "I'm currently offline, but I can see this might be Web3 related. ";
    
    if (patterns.address.test(input)) {
      response += "This looks like an Ethereum address. ";
    }
    
    if (patterns.token.test(input)) {
      response += "I detected cryptocurrency token mentions. ";
    }
    
    response += "Please try again when I'm back online for detailed analysis.";
    
    return {
      success: true,
      data: {
        classification: "web3",
        confidence: 0.7,
        output: response,
        mcpConnected: false,
        detectedTokens: [],
        detectedContracts: [],
        detectedWallets: [],
        offline: true
      }
    };
  }
}
```

## 📊 Testing Integration

### 1. Backend Health Check
```bash
# Test basic connectivity
curl -X GET http://localhost:3001/health

# Test analysis endpoint
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{"input": "what is Bitcoin"}'
```

### 2. Extension Testing
1. Load unpacked extension in Chrome
2. Open extension popup
3. Check connection status (should be green)
4. Test example queries
5. Test on web pages with crypto content

### 3. End-to-End Test Scenarios
```javascript
const testScenarios = [
  { input: "Bitcoin price", expected: "web3" },
  { input: "0xdAC17F958D2ee523a2206206994597C13D831ec7", expected: "contract" },
  { input: "weather today", expected: "non-web3" },
  { input: "swap ETH for USDC", expected: "multi-token" }
];
```

## 🚀 Production Deployment

### Backend Deployment
1. Deploy to cloud service (Heroku, Railway, etc.)
2. Update extension to use production URL
3. Set up environment variables
4. Configure CORS for your domain

### Extension Publishing
1. Test thoroughly with production backend
2. Update manifest with production permissions
3. Submit to Chrome Web Store
4. Set up analytics and monitoring

## 📞 Support & Troubleshooting

### Common Issues

**Connection Refused**
- Ensure backend is running on port 3001
- Check firewall settings
- Verify CORS configuration

**Timeout Errors**
- Increase timeout values
- Check MCP server connectivity
- Monitor backend logs

**Classification Errors**
- Review Groq API key and limits
- Check input validation
- Monitor LLM response format

### Debug Mode
Enable debug logging:
```javascript
localStorage.setItem('scout-debug', 'true');
```

## 🚀 Quick Fetch Examples for Chrome Extension

### 1. Simple Token Analysis

```javascript
// Example: Analyze KAITO token
async function analyzeKaitoToken() {
  try {
    const response = await fetch('http://localhost:3001/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        input: "hey that's my KAITO",
        messages: []
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('🪙 KAITO Analysis Result:', result);
    
    // Access specific data
    if (result.tokenData && result.tokenData.length > 0) {
      const kaitoData = result.tokenData[0];
      console.log(`Token: ${kaitoData.symbol}`);
      console.log(`Contract: ${kaitoData.contractAddress}`);
      console.log(`Network: ${kaitoData.network}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ KAITO analysis failed:', error);
    throw error;
  }
}

// Usage in extension
analyzeKaitoToken();
```

### 2. Contract Address Analysis

```javascript
// Example: Analyze a contract address
async function analyzeContract(contractAddress) {
  const response = await fetch('http://localhost:3001/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: `Analyze contract ${contractAddress}`,
      messages: []
    })
  });

  const result = await response.json();
  
  // Check if contract was analyzed
  if (result.contractData && result.contractData.length > 0) {
    const contract = result.contractData[0];
    console.log('📋 Contract Type:', contract.contractType);
    console.log('📋 Is Contract:', !contract.error);
  }
  
  return result;
}

// Usage
analyzeContract('0xA0b73E1Ff0B80914AB6fe0444E65848C4C34450b');
```

### 3. Multi-Entity Analysis

```javascript
// Example: Analyze multiple entities at once
async function analyzeMultipleEntities() {
  const query = "Compare ETH and BTC tokens, also check contract 0xA0b73E1Ff0B80914AB6fe0444E65848C4C34450b";
  
  const response = await fetch('http://localhost:3001/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: query, messages: [] })
  });

  const result = await response.json();
  
  console.log('🪙 Detected Tokens:', result.detectedTokens);
  console.log('📋 Detected Contracts:', result.detectedContracts);
  console.log('📊 Token Data:', result.tokenData);
  console.log('🏗️ Contract Data:', result.contractData);
  
  return result;
}
```

### 4. Health Check

```javascript
// Simple health check
async function checkBackendHealth() {
  try {
    const response = await fetch('http://localhost:3001/health');
    const health = await response.json();
    console.log('🏥 Backend Health:', health);
    return health.status === 'healthy';
  } catch (error) {
    console.error('❌ Backend is down:', error);
    return false;
  }
}
```

### 5. Chrome Extension Message Handler

```javascript
// In background.js - Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ANALYZE_WEB3') {
    analyzeWeb3Query(request.data.query)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Will respond asynchronously
  }
});

async function analyzeWeb3Query(query) {
  const response = await fetch('http://localhost:3001/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: query, messages: [] })
  });
  
  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`);
  }
  
  return await response.json();
}
```

### 6. Content Script Auto-Detection

```javascript
// In content.js - Auto-detect and analyze crypto content
function detectAndAnalyzeCrypto() {
  const text = document.body.innerText;
  
  // Detect tokens (2-6 uppercase letters)
  const tokens = text.match(/\b[A-Z]{2,6}\b/g);
  
  // Detect Ethereum addresses
  const addresses = text.match(/0x[a-fA-F0-9]{40}/g);
  
  if (tokens || addresses) {
    let query = '';
    if (tokens && tokens.includes('KAITO')) {
      query = "hey that's my KAITO";
    } else if (tokens) {
      query = `Tell me about ${tokens[0]} token`;
    } else if (addresses) {
      query = `Analyze address ${addresses[0]}`;
    }
    
    // Send to background script for analysis
    chrome.runtime.sendMessage({
      action: 'ANALYZE_WEB3',
      data: { query }
    }, (response) => {
      if (response.success) {
        displayAnalysisOverlay(response.data);
      }
    });
  }
}

// Run detection when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', detectAndAnalyzeCrypto);
} else {
  detectAndAnalyzeCrypto();
}
```

### 7. Error Handling with Retries

```javascript
async function analyzeWithRetry(query, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('http://localhost:3001/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: query, messages: [] }),
        timeout: 10000
      });

      if (response.ok) {
        return await response.json();
      }
      
      if (response.status >= 500 && attempt < maxRetries) {
        console.warn(`Attempt ${attempt} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      
    } catch (error) {
      if (attempt === maxRetries) {
        console.error('❌ All retry attempts failed:', error);
        throw error;
      }
      console.warn(`Attempt ${attempt} failed:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

This comprehensive integration guide should enable seamless connection between your Chrome extension and the Scout Backend system! 🚀
