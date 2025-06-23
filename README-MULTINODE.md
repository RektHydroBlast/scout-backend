# Scout: Multi-Node LangGraph Backend with MCP Integration

A sophisticated LangGraph.js backend server that powers the Scout Web3 Chrome extension. The system uses a multi-node workflow to classify user input, detect token mentions, fetch live blockchain data via Nodit MCP server, and provide intelligent Web3 responses.

## 🏗️ Architecture Overview

### Multi-Node Workflow
```
User Input
    ↓
┌─────────────────┐
│ classifyInput   │ ← Classification Node
└─────────────────┘
    ↓
   🔀 Route based on classification
    ↓
┌─────────────────┐    ┌─────────────────────────────┐
│ detectTokens    │    │ generateNonWeb3Response     │
└─────────────────┘    └─────────────────────────────┘
    ↓                              ↓
   🔀 Route based on tokens          END
    ↓
┌─────────────────┐    ┌─────────────────────────────┐
│ fetchMcpData    │    │ generateTokenNotFoundResponse │
└─────────────────┘    └─────────────────────────────┘
    ↓                              ↓
   🔀 Route after MCP fetch          END
    ↓
┌─────────────────┐
│ generateWeb3Response │
└─────────────────┘
    ↓
   END
```

### Node Functions

1. **Classification Node** (`classifyInput`)
   - Determines if input is Web3/crypto-related or not
   - Uses AI classification with confidence scoring
   - Routes to appropriate next node based on classification

2. **Token Detection Node** (`detectTokens`)
   - Searches for known token symbols and aliases in user input
   - Uses local token database with 6+ popular tokens
   - Detects: BTC, ETH, USDC, USDT, SOL, MATIC and their aliases

3. **MCP Data Fetch Node** (`fetchMcpData`)
   - Connects to Nodit MCP server for live blockchain data
   - Fetches real-time token information and market data
   - Falls back to local database if MCP connection fails

4. **Response Generation Nodes**
   - `generateWeb3Response`: Provides informed crypto/Web3 responses
   - `generateNonWeb3Response`: Redirects non-crypto queries
   - `generateTokenNotFoundResponse`: Handles Web3 queries without tokens

## 🚀 Features

### ✅ Multi-Node LangGraph Workflow
- **Smart Classification**: AI-powered input classification (Web3 vs non-Web3)
- **Token Detection**: Automatic detection of cryptocurrency mentions
- **Live Data Integration**: Real-time blockchain data via Nodit MCP server
- **Graceful Fallbacks**: Local database backup when MCP unavailable

### ✅ Nodit MCP Integration
- **Real-time Data**: Live blockchain data from Nodit APIs
- **Multi-chain Support**: Access to multiple blockchain networks
- **Error Handling**: Robust fallback to local data sources
- **Configurable**: Optional MCP integration with API key

### ✅ Token Database
- **Local Storage**: JSON-based token database
- **Comprehensive Data**: Symbol, name, description, category, aliases
- **Extensible**: Easy to add new tokens and data fields

## 📋 Installation & Setup

### Prerequisites
- Node.js 18+ 
- pnpm package manager
- Groq API key (required)
- Nodit API key (optional, for MCP integration)

### 1. Install Dependencies
```bash
cd backend
pnpm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
```

Edit `.env` with your API keys:
```env
# Required
GROQ_API_KEY=your_groq_api_key_here

# Optional - for MCP integration
NODIT_API_KEY=your_nodit_api_key_here

# Server Config
PORT=3001
NODE_ENV=development
```

### 3. Build & Test
```bash
# Build the project
pnpm run build

# Test the multi-node workflow
pnpm run test:multi

# Start development server
pnpm run dev
```

## 🧪 Testing

### Multi-Node Workflow Tests
```bash
pnpm run test:multi
```

The test suite covers:
- ✅ Web3 token queries (Bitcoin, ETH + MATIC)
- ✅ Non-Web3 queries (weather, general topics)
- ✅ Token-specific queries (USDC price)
- ✅ General Web3 queries (DeFi explanation)
- ✅ MCP connection status and fallbacks

### API Endpoint Tests
```bash
# Health check
curl http://localhost:3001/health

# Process query
curl -X POST http://localhost:3001/api/process \
  -H "Content-Type: application/json" \
  -d '{"message": "What is Bitcoin?"}'
```

## 🔧 API Endpoints

### `GET /health`
Health check endpoint
```json
{
  "status": "OK",
  "message": "LangGraph Backend Server is running"
}
```

### `POST /api/process`
Main processing endpoint
```json
{
  "message": "What is Bitcoin and how does it work?",
  "data": {} // optional extension data
}
```

Response:
```json
{
  "success": true,
  "result": "AI-generated response about Bitcoin...",
  "metadata": {
    "timestamp": "2025-06-22T...",
    "processedBy": "LangGraph"
  }
}
```

### `POST /api/stream`
Streaming endpoint for real-time responses
```json
{
  "message": "Tell me about ETH",
  "data": {}
}
```

## 🗄️ Token Database

Location: `src/data/token-database.json`

Structure:
```json
{
  "tokens": [
    {
      "symbol": "BTC",
      "name": "Bitcoin", 
      "decimals": 8,
      "description": "The first and most well-known cryptocurrency",
      "category": "cryptocurrency",
      "aliases": ["bitcoin", "btc", "$btc"]
    }
  ]
}
```

### Supported Tokens
- **BTC** (Bitcoin) - The original cryptocurrency
- **ETH** (Ethereum) - Smart contract platform
- **USDC** (USD Coin) - Dollar-backed stablecoin
- **USDT** (Tether) - Popular stablecoin
- **SOL** (Solana) - High-performance blockchain
- **MATIC** (Polygon) - Ethereum scaling solution

## 🔗 MCP Integration

### Nodit MCP Server Configuration
The system integrates with Nodit's MCP server for live blockchain data:

```json
{
  "mcpServers": {
    "nodit": {
      "command": "npx",
      "args": ["@noditlabs/nodit-mcp-server@latest"],
      "env": {
        "NODIT_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### MCP Features
- **Real-time Data**: Live token prices and blockchain state
- **Multi-chain Support**: Ethereum, Polygon, Solana, and more
- **API Discovery**: Automatic discovery of available Nodit APIs
- **Error Resilience**: Graceful fallback to local data

### Without MCP Integration
The system works perfectly without MCP:
- Uses local token database
- Provides static token information
- Still offers intelligent Web3 responses
- Clear indication of data source limitations

## 📁 Project Structure

```
backend/
├── src/
│   ├── ai/
│   │   ├── multi-node-graph.ts    # Main LangGraph workflow
│   │   └── simple-graph.ts        # Legacy single-node graph
│   ├── data/
│   │   └── token-database.json    # Local token database
│   └── server.ts                  # Express server
├── test-multi-node.ts             # Multi-node workflow tests
├── package.json                   # Dependencies and scripts
└── .env.example                   # Environment template
```

## 🔮 Future Enhancements

### Phase 1: Enhanced MCP Integration
- [ ] Real-time price fetching via Nodit APIs
- [ ] Portfolio tracking and analysis
- [ ] Transaction history analysis
- [ ] Multi-chain wallet insights

### Phase 2: Advanced Features  
- [ ] Sentiment analysis of crypto news
- [ ] DeFi protocol risk assessment
- [ ] NFT collection analysis
- [ ] Yield farming opportunities

### Phase 3: Chrome Extension Integration
- [ ] Page content analysis for Web3 elements
- [ ] Transaction simulation and preview
- [ ] Phishing detection and warnings
- [ ] Wallet interaction assistance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

---

**Scout Backend** - Intelligent Web3 AI Assistant powered by LangGraph.js and Nodit MCP 🚀
