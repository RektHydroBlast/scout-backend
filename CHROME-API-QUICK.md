# Chrome Extension API Guide

## 🚀 Quick API Reference

### Endpoints
- **Health**: `GET /health`
- **Analysis**: `POST /api/process`
- **Streaming**: `POST /api/stream`

### 1. Basic Token Analysis

```javascript
// Request
fetch('http://localhost:3001/api/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "hey that's my KAITO"
  })
});

// Response
{
  "success": true,
  "result": {
    "mcpConnected": true,
    "classification": "web3",
    "confidence": 0.95,
    "detectedTokens": ["KAITO"],
    "tokenData": [
      {
        "symbol": "KAITO",
        "success": true,
        "contractAddress": "0xa548304ED84AaD7ED99316be765Da112a3D29B271",
        "metadata": {
          "name": "Kaito.AI",
          "symbol": "Kaito",
          "totalSupply": "10000000000000000000000000000",
          "decimals": 18
        }
      }
    ],
    "output": "JSON response with analysis"
  }
}
```

### 2. Contract Analysis

```javascript
// Request
fetch('http://localhost:3001/api/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "Analyze contract 0xA0b73E1Ff0B80914AB6fe0444E65848C4C34450b"
  })
});

// Response includes contractData array with contract info
```

### 3. Multi-Entity Query

```javascript
// Request
fetch('http://localhost:3001/api/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "Compare ETH and BTC tokens"
  })
});

// Response includes multiple tokens in tokenData array
```

### 4. Health Check

```javascript
// Request
fetch('http://localhost:3001/health');

// Response
{ "status": "OK", "message": "LangGraph Backend Server is running" }
```

## 📋 Response Structure

```javascript
{
  "success": true,
  "result": {
    // Detection
    "detectedTokens": ["ETH", "BTC"],
    "detectedContracts": ["0x..."],
    "detectedWallets": ["0x..."],
    
    // Analysis Data
    "tokenData": [...],
    "contractData": [...],
    "walletData": [...],
    
    // Status
    "mcpConnected": true,
    "classification": "web3",
    "confidence": 0.95,
    "output": "AI response as JSON string"
  }
}
```

## 🔧 Chrome Extension Usage

```javascript
// Background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ANALYZE') {
    fetch('http://localhost:3001/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: request.query })
    })
    .then(response => response.json())
    .then(data => sendResponse({ success: true, data }))
    .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Content script
chrome.runtime.sendMessage({
  action: 'ANALYZE',
  query: 'hey that\'s my KAITO'
}, (response) => {
  if (response.success) {
    console.log('Analysis:', response.data.result);
  }
});
```
