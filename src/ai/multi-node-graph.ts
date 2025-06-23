import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadMcpTools } from "@langchain/mcp-adapters";
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Define the graph state with classification and comprehensive detection
const ScoutState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, curr) => prev.concat(curr),
    default: () => [],
  }),
  classification: Annotation<string>({
    reducer: (prev, curr) => curr,
    default: () => "",
  }),
  confidence: Annotation<number>({
    reducer: (prev, curr) => curr,
    default: () => 0,
  }),
  detectedTokens: Annotation<string[]>({
    reducer: (prev, curr) => curr,
    default: () => [],
  }),
  detectedContracts: Annotation<string[]>({
    reducer: (prev, curr) => curr,
    default: () => [],
  }),
  detectedWallets: Annotation<string[]>({
    reducer: (prev, curr) => curr,
    default: () => [],
  }),
  contractData: Annotation<any[]>({
    reducer: (prev, curr) => curr,
    default: () => [],
  }),
  tokenData: Annotation<any[]>({
    reducer: (prev, curr) => curr,
    default: () => [],
  }),
  walletData: Annotation<any[]>({
    reducer: (prev, curr) => curr,
    default: () => [],
  }),
  input: Annotation<string>({
    reducer: (prev, curr) => curr,
    default: () => "",
  }),  output: Annotation<string>({
    reducer: (prev, curr) => curr,
    default: () => "",
  }),  mcpConnected: Annotation<boolean>({
    reducer: (prev, curr) => curr,
    default: () => false,
  }),
  analysisStats: Annotation<any>({
    reducer: (prev, curr) => curr,
    default: () => ({}),
  }),
  });

// Initialize the Groq client
const getLLM = () => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not found in environment variables');
  }
  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama3-8b-8192",
    temperature: 0.7,
  });
};

// Common token tickers for detection (no local database dependency)
const COMMON_TOKENS = [
  'BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK', 'UNI', 'WETH', 'WBTC', 'SHIB', 'DOGE', 'LTC', 'TRX', 'ATOM', 'FTM', 'ICP', 'ALGO', 'VET', 'HBAR', 'NEAR', 'MANA', 'SAND', 'APE', 'CRO', 'LRC', 'ENJ', 'CHZ', 'THETA', 'AAVE', 'MKR', 'SNX', 'COMP', 'YFI', 'SUSHI', 'BAT', 'ZRX', 'KNC', 'REP', 'OMG', 'ANT', 'DNT', 'GNT', 'REN', 'STORJ', 'WMATIC'
];

// Enhanced token detection with better matching patterns
const ENHANCED_TOKEN_PATTERNS = {
  // Major cryptocurrencies with variations
  BTC: ['BTC', 'BITCOIN', 'XBT'],
  ETH: ['ETH', 'ETHEREUM', 'ETHER'],
  USDT: ['USDT', 'TETHER'],
  USDC: ['USDC', 'USD COIN'],
  BNB: ['BNB', 'BINANCE'],
  SOL: ['SOL', 'SOLANA'],
  // Wrapped tokens
  WETH: ['WETH', 'WRAPPED ETH', 'WRAPPED ETHEREUM'],
  WBTC: ['WBTC', 'WRAPPED BTC', 'WRAPPED BITCOIN'],
  // DeFi tokens
  UNI: ['UNI', 'UNISWAP'],
  AAVE: ['AAVE'],
  COMP: ['COMP', 'COMPOUND'],
  MKR: ['MKR', 'MAKER'],
  // Layer 2 tokens
  MATIC: ['MATIC', 'POLYGON'],
  OP: ['OP', 'OPTIMISM'],
  ARB: ['ARB', 'ARBITRUM']
};

// Address detection utilities
const detectEthereumAddresses = (input: string): { contracts: string[], wallets: string[] } => {
  // Ethereum address pattern: 0x followed by 40 hexadecimal characters
  const ethAddressPattern = /0x[a-fA-F0-9]{40}/g;
  const matches = input.match(ethAddressPattern) || [];
  
  // Filter out duplicates
  const uniqueAddresses = [...new Set(matches)];
  
  console.log('🔍 Detected Ethereum addresses:', uniqueAddresses);
  
  // We'll determine if they're contracts or wallets via MCP server
  // For now, assume they could be either
  return {
    contracts: uniqueAddresses,
    wallets: uniqueAddresses
  };
};

// Token ticker detection
const detectTokenTickers = (input: string): string[] => {
  const upperInput = input.toUpperCase();
  const detectedTickers: string[] = [];
  
  // Check for common token tickers
  COMMON_TOKENS.forEach(ticker => {
    const tickerPattern = new RegExp(`\\b${ticker}\\b`, 'i');
    if (tickerPattern.test(input)) {
      detectedTickers.push(ticker);
    }
  });
  
  console.log('🪙 Detected token tickers:', detectedTickers);
  return [...new Set(detectedTickers)]; // Remove duplicates
};

// Enhanced token detection with fuzzy matching
const detectTokenTickersEnhanced = (input: string): string[] => {
  const upperInput = input.toUpperCase();
  const detectedTickers: Set<string> = new Set();
  
  // Check exact matches and variations
  for (const [ticker, variations] of Object.entries(ENHANCED_TOKEN_PATTERNS)) {
    for (const variation of variations) {
      const pattern = new RegExp(`\\b${variation}\\b`, 'i');
      if (pattern.test(input)) {
        detectedTickers.add(ticker);
        break; // Found match, no need to check other variations
      }
    }
  }
  
  // Fallback to original common token detection for tokens not in enhanced patterns
  COMMON_TOKENS.forEach(ticker => {
    if (!ENHANCED_TOKEN_PATTERNS[ticker as keyof typeof ENHANCED_TOKEN_PATTERNS]) {
      const tickerPattern = new RegExp(`\\b${ticker}\\b`, 'i');
      if (tickerPattern.test(input)) {
        detectedTickers.add(ticker);
      }
    }
  });
  
  const result = Array.from(detectedTickers);
  console.log('🪙 Enhanced token detection results:', result);
  return result;
};

// Network detection utility
const detectNetwork = (input: string): string => {
  const lowerInput = input.toLowerCase();
  
  // Network keywords
  if (lowerInput.includes('polygon') || lowerInput.includes('matic')) return 'polygon';
  if (lowerInput.includes('arbitrum')) return 'arbitrum';
  if (lowerInput.includes('optimism')) return 'optimism';
  if (lowerInput.includes('base')) return 'base';
  if (lowerInput.includes('ethereum') || lowerInput.includes('eth') || lowerInput.includes('mainnet')) return 'ethereum';
  
  // Default to ethereum if no specific network mentioned
  return 'ethereum';
};

// Classification node - determines if input is Web3-related
const classificationNode = async (state: typeof ScoutState.State) => {
  const model = getLLM();
  
  try {
    console.log('🔍 Classifying input:', state.input);
    
    const prompt = `You are a Web3/cryptocurrency classifier. Analyze this input and determine if it's related to Web3, cryptocurrency, blockchain, DeFi, NFTs, or token trading.

User input: "${state.input}"

Respond with ONLY a JSON object in this exact format:
{"classification": "web3", "confidence": 0.95}
OR
{"classification": "non-web3", "confidence": 0.95}

Examples:
- Bitcoin questions = web3
- Ethereum questions = web3  
- DeFi questions = web3
- Weather questions = non-web3
- General topics = non-web3`;

    const response = await model.invoke(prompt);
    const result = JSON.parse(response.content as string);
    
    console.log('📊 Classification result:', result);
    
    return {
      classification: result.classification,
      confidence: result.confidence,
    };
  } catch (error) {
    console.error('Classification error:', error);
    // Fallback classification
    return {
      classification: "non-web3",
      confidence: 0.5,
    };
  }
};

// Comprehensive detection node - finds tokens, contracts, and wallet addresses
const comprehensiveDetectionNode = async (state: typeof ScoutState.State) => {
  const input = state.input;
  
  console.log('🔎 Running comprehensive detection on input:', input);
    // Detect token tickers with enhanced patterns
  const detectedTokens = detectTokenTickersEnhanced(input);
  
  // Detect Ethereum addresses (contracts and wallets)
  const addressDetection = detectEthereumAddresses(input);
  
  console.log('🪙 Detected token tickers:', detectedTokens);
  console.log('📋 Detected potential contracts:', addressDetection.contracts);
  console.log('👤 Detected potential wallets:', addressDetection.wallets);
  
  return {
    detectedTokens,
    detectedContracts: addressDetection.contracts,
    detectedWallets: addressDetection.wallets,
  };
};

// Enhanced Web3 response node with improved error handling and formatting
const web3ResponseNode = async (state: typeof ScoutState.State) => {
  const model = getLLM();
  
  let analysisResults = "";
  let dataQuality = "✅ High quality";
  
  // Check data quality and connection status
  if (!state.mcpConnected) {
    dataQuality = "⚠️ Limited (offline mode)";
  } else if (state.analysisStats && state.analysisStats.successful < state.analysisStats.total) {
    dataQuality = `⚠️ Partial (${state.analysisStats.successful}/${state.analysisStats.total} successful)`;
  }
    // Add token analysis with enhanced formatting and risk assessment
  if (state.detectedTokens.length > 0) {
    analysisResults += `\n🪙 **Token Analysis:**\n`;
    for (const token of state.detectedTokens) {
      const tokenInfo = state.tokenData.find(t => t.symbol === token);
      if (tokenInfo) {
        if (tokenInfo.success && tokenInfo.metadata) {
          const meta = tokenInfo.metadata;
          const holderInfo = tokenInfo.holderInfo;
          const riskLevel = getTokenRiskLevel(meta, holderInfo);
          
          analysisResults += `• **${token}** (${meta.name || 'Token'})\n`;
          analysisResults += `  - Contract: \`${tokenInfo.contractAddress}\`\n`;
          analysisResults += `  - Type: ${meta.type || 'ERC20'}\n`;
          
          if (meta.totalSupply) {
            const formattedSupply = formatTokenSupply(meta.totalSupply, meta.decimals || 18);
            analysisResults += `  - Total Supply: ${formattedSupply} ${token}\n`;
          }
          
          if (holderInfo?.count) {
            analysisResults += `  - Holders: ${holderInfo.count.toLocaleString()}\n`;
          }
          
          if (meta.deployedAt) {
            const deployDate = new Date(meta.deployedAt).toLocaleDateString();
            analysisResults += `  - Deployed: ${deployDate}\n`;
          }
          
          analysisResults += `  - Risk Assessment: ${riskLevel}\n`;
          
        } else if (tokenInfo.error) {
          analysisResults += `• **${token}**: ❌ ${tokenInfo.error}\n`;
        } else {
          analysisResults += `• **${token}**: Token detected but analysis incomplete\n`;
        }
      } else {
        analysisResults += `• **${token}**: Token ticker detected\n`;
      }
    }
  }
  
  // Add contract analysis with enhanced error handling
  if (state.contractData && state.contractData.length > 0) {
    analysisResults += `\n📋 **Smart Contract Analysis:**\n`;
    for (const contract of state.contractData) {
      analysisResults += `• **Contract**: \`${contract.address}\`\n`;
      analysisResults += `  - Network: ${contract.network}\n`;
      
      if (contract.error) {
        analysisResults += `  - ❌ Error: ${contract.error}\n`;
        continue;
      }
      
      if (contract.checks) {
        analysisResults += `  - Contract Status: ${contract.checks.isContract ? '✅ Verified' : '❌ Not a contract'}\n`;
      }
      
      if (contract.contractType) {
        analysisResults += `  - Type: ${contract.contractType}\n`;
      }
      
      if (contract.tokenMetadata && contract.tokenMetadata.length > 0) {
        const metadata = contract.tokenMetadata[0];
        analysisResults += `  - **Token Details:**\n`;
        analysisResults += `    • Name: ${metadata.name}\n`;
        analysisResults += `    • Symbol: ${metadata.symbol}\n`;        if (metadata.totalSupply && metadata.decimals) {
          const formattedSupply = formatTokenSupply(metadata.totalSupply, metadata.decimals);
          analysisResults += `    • Supply: ${formattedSupply}\n`;
        }
        if (metadata.deployedAt) {
          const deployDate = new Date(metadata.deployedAt).toLocaleDateString();
          analysisResults += `    • Deployed: ${deployDate}\n`;
        }
      }
      
      if (contract.tokenHolders && contract.tokenHolders.items) {
        const holders = contract.tokenHolders;
        analysisResults += `  - **Holder Statistics:**\n`;
        if (holders.count) {
          analysisResults += `    • Total Holders: ${holders.count.toLocaleString()}\n`;
        }
        analysisResults += `    • Top 3 Holders:\n`;
        holders.items.slice(0, 3).forEach((holder: any, idx: number) => {
          const shortAddr = `${holder.ownerAddress.slice(0, 6)}...${holder.ownerAddress.slice(-4)}`;
          analysisResults += `      ${idx + 1}. ${shortAddr}\n`;
        });
      }
      
      if (contract.tokenMetadataError || contract.tokenHoldersError) {
        analysisResults += `  - ⚠️ Some data unavailable: ${contract.tokenMetadataError || contract.tokenHoldersError}\n`;
      }
    }
  }
  
  // Add wallet analysis with enhanced information
  if (state.walletData && state.walletData.length > 0) {
    analysisResults += `\n👤 **Wallet Address Analysis:**\n`;
    for (const wallet of state.walletData) {
      analysisResults += `• **Address**: \`${wallet.address}\`\n`;
      analysisResults += `  - Network: ${wallet.network}\n`;
      
      if (wallet.error) {
        analysisResults += `  - ❌ Error: ${wallet.error}\n`;
        continue;
      }
      
      if (wallet.isWallet !== undefined) {
        analysisResults += `  - Type: ${wallet.isWallet ? '👤 Wallet (EOA)' : '📋 Smart Contract'}\n`;
      }
      
      if (wallet.note) {
        analysisResults += `  - Note: ${wallet.note}\n`;
      }
      
      if (wallet.isContractCheck) {
        analysisResults += `  - Verification: ${wallet.isContractCheck.result ? 'Contract confirmed' : 'Wallet confirmed'}\n`;
      }
    }
  }
    // Add analysis statistics with insights
  if (state.analysisStats && state.analysisStats.total > 0) {
    analysisResults += `\n📊 **Analysis Summary:**\n`;
    analysisResults += `• Total entities analyzed: ${state.analysisStats.total}\n`;
    analysisResults += `• Successful analyses: ${state.analysisStats.successful}\n`;
    analysisResults += `• Data quality: ${dataQuality}\n`;
  }
  
  // Add insightful analysis summary
  const insights = generateInsightfulResponse({
    tokenData: state.tokenData,
    contractData: state.contractData,
    analysisStats: state.analysisStats
  });
  if (insights) {
    analysisResults += insights;
  }
  
  console.log('🚀 Generating enhanced Web3 response');
  console.log('🪙 Detected tokens:', state.detectedTokens);
  console.log('📋 Detected contracts:', state.detectedContracts);
  console.log('👤 Detected wallets:', state.detectedWallets);
  console.log('🔗 MCP Connection Status:', state.mcpConnected);
  console.log('📊 Analysis Stats:', state.analysisStats);
  
  const statusIndicator = state.mcpConnected ? 
    '✅ Live blockchain data via Nodit MCP' : 
    '⚠️ Offline mode - limited data available';
  
  const prompt = `You are Scout, an expert Web3 and blockchain analysis assistant. You provide clear, informative, and engaging responses about cryptocurrency, blockchain, and DeFi topics.

User Query: "${state.input}"

Analysis Results:
${analysisResults}

Data Source: ${statusIndicator}

Instructions:
- Provide a conversational, helpful response based on the analysis above
- Explain any technical terms in user-friendly language
- If errors occurred, acknowledge them but focus on successful data
- For contract addresses, emphasize what type of contract it is and key details
- For wallet addresses, explain that it's a user wallet and any relevant observations
- For token tickers, provide useful information about the token
- Always end with a reminder about DYOR (Do Your Own Research)
- Keep the tone friendly and informative, like you're helping a crypto enthusiast
- Don't just dump technical data - synthesize it into useful insights
- If multiple entities were analyzed, provide a brief summary

Response length: Aim for 150-250 words unless complex analysis requires more detail.`;

  const response = await model.invoke(prompt);
  const responseText = response.content as string;

  return {
    messages: [new AIMessage(responseText)],
    output: responseText,
  };
};

// Non-Web3 response node - handles non-Web3 queries
const nonWeb3ResponseNode = async (state: typeof ScoutState.State) => {
  const response = "I'm Scout, a Web3 and cryptocurrency specialist. While I can help with general questions, I'm optimized for Web3, blockchain, and cryptocurrency topics. Try asking me about Bitcoin, Ethereum, DeFi protocols, or any other crypto-related topic!";
  
  console.log('❌ Non-Web3 query detected, providing redirect response');
  
  return {
    messages: [new AIMessage(response)],
    output: response,
  };
};

// Token not found response node
const tokenNotFoundNode = async (state: typeof ScoutState.State) => {
  const response = "I understand you're asking about Web3/crypto topics, but I couldn't find the specific token you mentioned in my database. My current database only contains information for a limited set of tokens (BTC, ETH, USDC, USDT, SOL, MATIC, WETH). For other tokens, please check a live crypto data provider like CoinGecko or CoinMarketCap for the most current information.";
  
  console.log('🔍 Web3 query but no tokens detected, providing fallback response');
  
  return {
    messages: [new AIMessage(response)],
    output: response,
  };
};

// Contract analysis node - analyzes contract addresses using Nodit MCP
// Enhanced MCP utilities with robust error handling and better API patterns
class McpConnectionManager {
  private client: any = null;
  private tools: any[] = [];
  private connected: boolean = false;
  private connectionAttempts: number = 0;
  private maxRetries: number = 3;  private apiCallStats = {
    total: 0,
    successful: 0,
    failed: 0,
    avgResponseTime: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  async connect(): Promise<{ success: boolean; error?: string }> {
    this.connectionAttempts++;
    
    try {
      if (!process.env.NODIT_API_KEY) {
        return { success: false, error: "NODIT_API_KEY not configured" };
      }

      // Initialize MCP client with better configuration
      this.client = new Client({
        name: `scout-enhanced-client-${Date.now()}`,
        version: "1.0.0"
      });
      
      const transport = new StdioClientTransport({
        command: "npx",
        args: ["@noditlabs/nodit-mcp-server@latest"],
        env: {
          NODIT_API_KEY: process.env.NODIT_API_KEY
        }
      });

      await this.client.connect(transport);
      this.tools = await loadMcpTools("nodit", this.client);
      this.connected = true;
      
      console.log(`🔗 MCP Connected successfully (attempt ${this.connectionAttempts})`);
      console.log(`🛠️ Loaded ${this.tools.length} MCP tools`);
      
      return { success: true };
      
    } catch (error) {
      console.error(`❌ MCP connection failed (attempt ${this.connectionAttempts}):`, error);
      
      if (this.connectionAttempts < this.maxRetries) {
        console.log(`🔄 Retrying MCP connection in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.connect();
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Connection failed after retries" 
      };
    }
  }
  async callApi(operationId: string, protocol: string, network: string, requestBody: any, retryCount: number = 0): Promise<any> {
    if (!this.connected || !this.tools.length) {
      throw new Error("MCP not connected or no tools available");
    }

    // Create cache key for potential caching
    const cacheKey = `${operationId}-${protocol}-${network}-${JSON.stringify(requestBody)}`;
    
    // Check cache first for read operations (not writes)
    if (operationId.startsWith('get') || operationId.startsWith('search') || operationId === 'isContract') {
      // Note: Cache implementation would go here if we had the cache system
      // For now, we just track cache stats
    }

    const tool = this.tools.find(t => t.name === 'call_nodit_api');
    if (!tool) {
      throw new Error("Nodit API tool not found");
    }

    const startTime = Date.now();
    this.apiCallStats.total++;

    try {
      console.log(`🔧 Calling ${operationId} on ${protocol}/${network}`);
      console.log(`📝 Request body:`, JSON.stringify(requestBody, null, 2));
      
      const result = await tool.call({
        protocol,
        network,
        operationId,
        requestBody
      });
      
      const responseTime = Date.now() - startTime;
      this.apiCallStats.successful++;
      this.updateAverageResponseTime(responseTime);
      
      console.log(`✅ ${operationId} successful (${responseTime}ms)`);
      console.log(`📊 Response preview:`, JSON.stringify(result, null, 2).substring(0, 200) + '...');
      
      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.apiCallStats.failed++;
      console.error(`❌ ${operationId} failed after ${responseTime}ms:`, error);
      
      // Enhanced retry logic with better error categorization
      if (retryCount < 2 && this.shouldRetry(error)) {
        console.log(`🔄 Retrying ${operationId} (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * (retryCount + 1), 3000)));
        return this.callApi(operationId, protocol, network, requestBody, retryCount + 1);
      }
      
      throw error;
    }
  }

  private shouldRetry(error: any): boolean {
    const errorMsg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    
    // Retry on network/timeout errors, but not on validation or auth errors
    return (errorMsg.includes('timeout') || 
           errorMsg.includes('network') || 
           errorMsg.includes('connection') ||
           errorMsg.includes('econnreset') ||
           errorMsg.includes('503') ||
           errorMsg.includes('502')) &&
           !errorMsg.includes('401') &&
           !errorMsg.includes('403') &&
           !errorMsg.includes('invalid');
  }

  private updateAverageResponseTime(responseTime: number): void {
    this.apiCallStats.avgResponseTime = 
      (this.apiCallStats.avgResponseTime * (this.apiCallStats.successful - 1) + responseTime) / 
      this.apiCallStats.successful;
  }

  async close(): Promise<void> {
    if (this.client && this.connected) {
      try {
        await this.client.close();
        console.log('🔌 MCP connection closed');
        console.log('📊 Final API call stats:', this.apiCallStats);
      } catch (error) {
        console.warn('⚠️ Error closing MCP connection:', error);
      }
    }
    this.connected = false;
    this.client = null;
    this.tools = [];
  }

  isConnected(): boolean {
    return this.connected;
  }

  getTools(): any[] {
    return this.tools;
  }

  getStats() {
    return { ...this.apiCallStats };
  }
}

// Enhanced token analysis following proper Nodit API patterns
async function analyzeTokenTicker(ticker: string, mcpManager: McpConnectionManager, network: string, networkConfig: string): Promise<any> {
  try {
    console.log(`🪙 Analyzing token ticker: ${ticker}`);    // Step 1: Search for token contracts by keyword (this is the primary search method)
    let rawSearchResult = await mcpManager.callApi(
      'searchTokenContractMetadataByKeyword',
      network,
      networkConfig,
      { 
        keyword: ticker,
        rpp: 10, // Get top 10 results to find best match
        withCount: true
      }
    );
    
    // Parse the response if it's a JSON string
    let searchResult = rawSearchResult;
    if (typeof rawSearchResult === 'string') {
      try {
        searchResult = JSON.parse(rawSearchResult);
        console.log(`🔧 Parsed JSON response for ${ticker}`);
      } catch (parseError) {
        console.error(`❌ Failed to parse JSON response for ${ticker}:`, parseError);
        return {
          symbol: ticker,
          error: "Failed to parse API response",
          searched: false
        };
      }
    }
    
    console.log(`🔍 Processed search result for ${ticker} - items count:`, searchResult?.items?.length || 0);
    
    if (!searchResult?.items || searchResult.items.length === 0) {
      return {
        symbol: ticker,
        error: "Token not found in blockchain data",
        searched: true,
        searchCount: searchResult?.items?.length || 0
      };
    }

    console.log(`🔍 Found ${searchResult.items.length} potential matches for ${ticker}`);
    
    // Step 2: Find the best match (prioritize exact symbol match and larger supply/holders)
    let bestMatch = null;
    let bestScore = 0;
    
    for (const item of searchResult.items) {
      let score = 0;
      
      // Exact symbol match gets highest priority
      if (item.symbol?.toLowerCase() === ticker.toLowerCase()) {
        score += 100;
      } else if (item.symbol?.toLowerCase().includes(ticker.toLowerCase())) {
        score += 50;
      }
      
      // Name match also helps
      if (item.name?.toLowerCase().includes(ticker.toLowerCase())) {
        score += 25;
      }
      
      // Prefer tokens with larger total supply (more established)
      if (item.totalSupply) {
        const supply = BigInt(item.totalSupply);
        if (supply > BigInt(0)) {
          score += Math.min(Math.log10(Number(supply)), 25);
        }
      }
      
      // Prefer tokens with deployment info (more reliable)
      if (item.deployedAt) {
        score += 10;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }
    
    if (!bestMatch) {
      return {
        symbol: ticker,
        error: "No suitable match found among search results",
        searched: true,
        searchCount: searchResult.items.length
      };
    }
    
    console.log(`🎯 Best match for ${ticker}: ${bestMatch.name} (${bestMatch.symbol}) at ${bestMatch.address} (score: ${bestScore})`);
      // Step 3: Get detailed metadata for the best match (this provides the most complete data)
    try {
      let rawMetadata = await mcpManager.callApi(
        'getTokenContractMetadataByContracts',
        network,
        networkConfig,
        { contractAddresses: [bestMatch.address] }
      );
      
      // Parse metadata response if it's a JSON string
      let detailedMetadata = rawMetadata;
      if (typeof rawMetadata === 'string') {
        try {
          detailedMetadata = JSON.parse(rawMetadata);
        } catch (parseError) {
          console.warn(`⚠️ Failed to parse metadata JSON for ${ticker}:`, parseError);
          detailedMetadata = null;
        }
      }
      
      // Step 4: Get holder information to provide richer analysis
      let holderInfo = null;
      try {
        holderInfo = await mcpManager.callApi(
          'getTokenHoldersByContract',
          network,
          networkConfig,
          { 
            contractAddress: bestMatch.address,
            rpp: 5, // Just top 5 holders
            withCount: true
          }
        );
        console.log(`� Found ${holderInfo?.count || 0} holders for ${ticker}`);
      } catch (holderError) {
        console.warn(`⚠️ Could not get holder info for ${ticker}:`, holderError);
      }
      
      const enrichedMetadata = detailedMetadata?.[0] || bestMatch;
      
      return {
        symbol: ticker,
        searchResult: bestMatch,
        metadata: enrichedMetadata,
        holderInfo: holderInfo,
        contractAddress: bestMatch.address,
        network: network,
        success: true,
        analysisDepth: 'comprehensive',
        confidence: bestScore > 100 ? 'high' : bestScore > 50 ? 'medium' : 'low'
      };
      
    } catch (metadataError) {
      console.warn(`⚠️ Failed to get detailed metadata for ${ticker}:`, metadataError);
      
      // Still return the search result as partial success
      return {
        symbol: ticker,
        searchResult: bestMatch,
        metadata: bestMatch, // Use search result as fallback
        contractAddress: bestMatch.address,
        network: network,
        metadataError: metadataError instanceof Error ? metadataError.message : "Metadata fetch failed",
        success: true,
        analysisDepth: 'basic',
        confidence: bestScore > 100 ? 'medium' : 'low'
      };
    }
    
  } catch (error) {
    console.error(`❌ Token analysis failed for ${ticker}:`, error);
    return {
      symbol: ticker,
      error: error instanceof Error ? error.message : "Analysis failed",
      searched: false,
      analysisDepth: 'failed'
    };
  }
}

// Enhanced contract analysis with comprehensive checks
async function analyzeContractAddress(contractAddress: string, mcpManager: McpConnectionManager, network: string, networkConfig: string): Promise<any> {
  console.log(`📋 Analyzing contract address: ${contractAddress}`);
  
  const analysis: any = {
    address: contractAddress,
    network,
    timestamp: new Date().toISOString(),
    checks: {
      isContract: false,
      hasMetadata: false,
      hasHolders: false
    }
  };

  try {    // Step 1: Check if it's a contract address
    let rawContractResult = await mcpManager.callApi(
      'isContract',
      network,
      networkConfig,
      { address: contractAddress }
    );
    
    // Parse the response if it's a JSON string
    let isContractResult = rawContractResult;
    if (typeof rawContractResult === 'string') {
      try {
        isContractResult = JSON.parse(rawContractResult);
      } catch (parseError) {
        console.warn(`⚠️ Failed to parse isContract JSON:`, parseError);
        isContractResult = { result: false };
      }
    }
    
    analysis.isContractCheck = isContractResult;
    analysis.checks.isContract = isContractResult?.result === true;
    
    if (!analysis.checks.isContract) {
      analysis.addressType = "wallet";
      analysis.note = "This is a wallet address, not a smart contract";
      return analysis;
    }

    analysis.addressType = "contract";
    
    // Step 2: Try to get token metadata (if it's a token contract)
    try {
      const tokenMetaResult = await mcpManager.callApi(
        'getTokenContractMetadataByContracts',
        network,
        networkConfig,
        { contractAddresses: [contractAddress] }
      );
      
      if (tokenMetaResult && tokenMetaResult.length > 0) {
        analysis.tokenMetadata = tokenMetaResult;
        analysis.checks.hasMetadata = true;
        analysis.contractType = "token";
        
        // Step 3: If it's a token, try to get holder information
        try {
          const holdersResult = await mcpManager.callApi(
            'getTokenHoldersByContract',
            network,
            networkConfig,
            { 
              contractAddress: contractAddress,
              rpp: 10,
              withCount: true
            }
          );
          
          if (holdersResult && holdersResult.items) {
            analysis.tokenHolders = holdersResult;
            analysis.checks.hasHolders = true;
          }
          
        } catch (holdersError) {
          console.warn(`⚠️ Failed to get token holders for ${contractAddress}:`, holdersError);
          analysis.tokenHoldersError = holdersError instanceof Error ? holdersError.message : "Holders fetch failed";
        }
        
      } else {
        analysis.contractType = "other";
        analysis.note = "Contract detected but not a standard token contract";
      }
      
    } catch (tokenError) {
      console.warn(`⚠️ Failed to get token metadata for ${contractAddress}:`, tokenError);
      analysis.tokenMetadataError = tokenError instanceof Error ? tokenError.message : "Token metadata fetch failed";
      analysis.contractType = "unknown";
    }
    
    return analysis;
    
  } catch (error) {
    console.error(`❌ Contract analysis failed for ${contractAddress}:`, error);
    analysis.error = error instanceof Error ? error.message : "Analysis failed";
    return analysis;
  }
}

// Comprehensive MCP analysis node with enhanced error handling
const comprehensiveMcpAnalysisNode = async (state: typeof ScoutState.State) => {  console.log('🔗 Starting enhanced comprehensive MCP analysis');
  console.log('🪙 Tokens to analyze:', state.detectedTokens);
  console.log('📋 Contracts to analyze:', state.detectedContracts);
  console.log('👤 Wallets to analyze:', state.detectedWallets);
  
  const mcpManager = new McpConnectionManager();
  
  try {
    // Enhanced connection with retry logic
    const connectionResult = await mcpManager.connect();
    
    if (!connectionResult.success) {
      console.error('❌ MCP connection failed:', connectionResult.error);
      
      return {
        tokenData: state.detectedTokens.map(token => ({
          symbol: token,
          error: connectionResult.error || "MCP connection failed",
          fallback: true
        })),
        contractData: state.detectedContracts.map(address => ({
          address,
          network: detectNetwork(state.input),
          error: connectionResult.error || "MCP connection failed",
          fallback: true
        })),
        walletData: state.detectedWallets.map(address => ({
          address,
          network: detectNetwork(state.input),
          error: connectionResult.error || "MCP connection failed",
          fallback: true
        })),
        mcpConnected: false,
      };
    }
    
    const network = detectNetwork(state.input);
    const networkConfig = network === 'ethereum' || network === 'polygon' ? 'mainnet' : 'mainnet';
    
    console.log(`🌐 Using network: ${network}/${networkConfig}`);
    
    // Results containers
    const tokenData: any[] = [];
    const contractData: any[] = [];
    const walletData: any[] = [];
    
    // Analyze token tickers with enhanced error handling
    for (const ticker of state.detectedTokens) {
      const tokenAnalysis = await analyzeTokenTicker(ticker, mcpManager, network, networkConfig);
      tokenData.push(tokenAnalysis);
    }
    
    // Analyze contract addresses with comprehensive checks
    for (const contractAddress of state.detectedContracts) {
      const contractAnalysis = await analyzeContractAddress(contractAddress, mcpManager, network, networkConfig);
      
      if (contractAnalysis.addressType === "wallet") {
        // Move wallet addresses to wallet data
        walletData.push({
          address: contractAddress,
          network,
          isWallet: true,
          note: contractAnalysis.note,
          isContractCheck: contractAnalysis.isContractCheck
        });
      } else {
        // Keep contract addresses in contract data
        contractData.push(contractAnalysis);
      }
    }
    
    // Analyze wallet addresses (if any detected separately)
    for (const walletAddress of state.detectedWallets) {
      // For wallets detected separately, we can do basic validation
      if (!state.detectedContracts.includes(walletAddress)) {
        try {
          const isContractResult = await mcpManager.callApi(
            'isContract',
            network,
            networkConfig,
            { address: walletAddress }
          );
          
          walletData.push({
            address: walletAddress,
            network,
            isWallet: isContractResult?.result !== true,
            isContractCheck: isContractResult,
            note: isContractResult?.result === true ? 
              "This address is actually a smart contract" : 
              "Confirmed wallet address"
          });
          
        } catch (error) {
          walletData.push({
            address: walletAddress,
            network,
            isWallet: true,
            note: "Wallet address (validation failed)",
            error: error instanceof Error ? error.message : "Validation failed"
          });
        }
      }
    }
    
    await mcpManager.close();
    
    const totalAnalyzed = tokenData.length + contractData.length + walletData.length;
    console.log(`✅ Enhanced MCP analysis complete - Total: ${totalAnalyzed} entities`);
    console.log(`  📊 Tokens: ${tokenData.length} | Contracts: ${contractData.length} | Wallets: ${walletData.length}`);
      // Log success rates with detailed debugging
    console.log(`🔍 Debugging token data:`, tokenData.map(t => ({ symbol: t.symbol, success: t.success, error: t.error })));
    
    const successfulTokens = tokenData.filter(t => t.success).length;
    const successfulContracts = contractData.filter(c => !c.error).length;
    const successfulWallets = walletData.filter(w => !w.error).length;
    
    console.log(`  📈 Success rates - Tokens: ${successfulTokens}/${tokenData.length} | Contracts: ${successfulContracts}/${contractData.length} | Wallets: ${successfulWallets}/${walletData.length}`);
    
    return {
      tokenData,
      contractData,
      walletData,
      mcpConnected: true,
      analysisStats: {
        total: totalAnalyzed,
        successful: successfulTokens + successfulContracts + successfulWallets,
        tokens: { total: tokenData.length, successful: successfulTokens },
        contracts: { total: contractData.length, successful: successfulContracts },
        wallets: { total: walletData.length, successful: successfulWallets }
      }
    };
    
  } catch (error) {
    console.error('❌ Enhanced MCP analysis failed:', error);
    
    await mcpManager.close();
    
    // Enhanced fallback response with more details
    return {
      tokenData: state.detectedTokens.map(token => ({
        symbol: token,
        error: error instanceof Error ? error.message : "Analysis failed",
        fallback: true,
        timestamp: new Date().toISOString()
      })),
      contractData: state.detectedContracts.map(address => ({
        address,
        network: detectNetwork(state.input),
        error: error instanceof Error ? error.message : "Analysis failed",
        fallback: true,
        timestamp: new Date().toISOString()
      })),
      walletData: state.detectedWallets.map(address => ({
        address,
        network: detectNetwork(state.input),
        error: error instanceof Error ? error.message : "Analysis failed",
        fallback: true,
        timestamp: new Date().toISOString()
      })),
      mcpConnected: false,
      analysisStats: {
        total: state.detectedTokens.length + state.detectedContracts.length + state.detectedWallets.length,
        successful: 0,
        error: "MCP analysis failed completely"
      }
    };
  }
};

// Analytics and response enhancement utilities
const formatTokenSupply = (supply: string, decimals: number = 18): string => {
  try {
    const supplyNum = BigInt(supply);
    const divisor = BigInt(10 ** decimals);
    const formatted = Number(supplyNum / divisor);
    
    if (formatted >= 1e12) return `${(formatted / 1e12).toFixed(2)}T`;
    if (formatted >= 1e9) return `${(formatted / 1e9).toFixed(2)}B`;
    if (formatted >= 1e6) return `${(formatted / 1e6).toFixed(2)}M`;
    if (formatted >= 1e3) return `${(formatted / 1e3).toFixed(2)}K`;
    
    return formatted.toLocaleString();
  } catch (error) {
    return 'Unknown';
  }
};

const getTokenRiskLevel = (metadata: any, holderInfo: any): string => {
  let riskScore = 0;
  const issues: string[] = [];
  
  // Check deployment date (newer = higher risk)
  if (metadata.deployedAt) {
    const deployDate = new Date(metadata.deployedAt);
    const daysSinceDeployment = (Date.now() - deployDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDeployment < 30) {
      riskScore += 3;
      issues.push('Recently deployed');
    } else if (daysSinceDeployment < 365) {
      riskScore += 1;
    }
  }
  
  // Check holder count
  if (holderInfo?.count) {
    if (holderInfo.count < 100) {
      riskScore += 2;
      issues.push('Few holders');
    } else if (holderInfo.count < 1000) {
      riskScore += 1;
      issues.push('Limited holders');
    }
  }
  
  // Check total supply (extremely high supply can be risky)
  if (metadata.totalSupply && metadata.decimals) {
    const supply = Number(BigInt(metadata.totalSupply) / BigInt(10 ** metadata.decimals));
    if (supply > 1e15) {
      riskScore += 2;
      issues.push('Extremely high supply');
    }
  }
  
  // Determine risk level
  if (riskScore >= 5) return `🔴 High Risk (${issues.join(', ')})`;
  if (riskScore >= 3) return `🟡 Medium Risk (${issues.join(', ')})`;
  if (riskScore >= 1) return `🟢 Low Risk (${issues.join(', ')})`;
  return '✅ Well-established';
};

const generateInsightfulResponse = (analysisData: any): string => {
  const insights: string[] = [];
  
  // Token insights
  if (analysisData.tokenData && analysisData.tokenData.length > 0) {
    const successfulTokens = analysisData.tokenData.filter((t: any) => t.success);
    if (successfulTokens.length > 0) {
      insights.push(`📊 Analyzed ${successfulTokens.length} token${successfulTokens.length > 1 ? 's' : ''} successfully`);
    }
  }
  
  // Contract insights
  if (analysisData.contractData && analysisData.contractData.length > 0) {
    const contractsWithMetadata = analysisData.contractData.filter((c: any) => c.tokenMetadata);
    if (contractsWithMetadata.length > 0) {
      insights.push(`🔗 Found ${contractsWithMetadata.length} token contract${contractsWithMetadata.length > 1 ? 's' : ''} with full metadata`);
    }
  }
  
  // Network activity insights
  if (analysisData.analysisStats) {
    const { total, successful } = analysisData.analysisStats;
    if (total > 0) {
      const successRate = Math.round((successful / total) * 100);
      insights.push(`⚡ ${successRate}% analysis success rate`);
    }
  }
  
  return insights.length > 0 ? `\n💡 **Quick Insights:**\n${insights.map(i => `• ${i}`).join('\n')}\n` : '';
};


// Routing functions
const routeAfterClassification = (state: typeof ScoutState.State): string => {
  console.log(`🔀 Routing after classification: ${state.classification} (confidence: ${state.confidence})`);
  
  if (state.classification === "web3" && state.confidence > 0.7) {
    return "comprehensiveDetection";
  } else if (state.classification === "web3" && state.confidence <= 0.7) {
    return "generateTokenNotFoundResponse";
  } else {
    return "generateNonWeb3Response";
  }
};

const routeAfterDetection = (state: typeof ScoutState.State): string => {
  console.log(`🔀 Routing after detection: found ${state.detectedTokens.length} tokens, ${state.detectedContracts.length} contracts, ${state.detectedWallets.length} wallets`);
  
  // If we found any tokens, contracts, or wallets, proceed to MCP analysis
  if (state.detectedTokens.length > 0 || state.detectedContracts.length > 0 || state.detectedWallets.length > 0) {
    return "comprehensiveMcpAnalysis";
  }
  // Nothing detected
  else {
    return "generateTokenNotFoundResponse";
  }
};

const routeAfterMcpAnalysis = (state: typeof ScoutState.State): string => {
  console.log(`🔀 Routing after MCP analysis: connected=${state.mcpConnected}`);
  
  // Always proceed to Web3 response after MCP analysis
  return "generateWeb3Response";
};

// Create and configure the multi-node graph
const createScoutGraph = () => {  
  const graph = new StateGraph(ScoutState)
    .addNode("classifyInput", classificationNode)
    .addNode("comprehensiveDetection", comprehensiveDetectionNode)
    .addNode("comprehensiveMcpAnalysis", comprehensiveMcpAnalysisNode)
    .addNode("generateWeb3Response", web3ResponseNode)
    .addNode("generateNonWeb3Response", nonWeb3ResponseNode)
    .addNode("generateTokenNotFoundResponse", tokenNotFoundNode)
    .addEdge(START, "classifyInput")
    .addConditionalEdges("classifyInput", routeAfterClassification, {
      comprehensiveDetection: "comprehensiveDetection",
      generateTokenNotFoundResponse: "generateTokenNotFoundResponse",
      generateNonWeb3Response: "generateNonWeb3Response",
    })
    .addConditionalEdges("comprehensiveDetection", routeAfterDetection, {
      comprehensiveMcpAnalysis: "comprehensiveMcpAnalysis",
      generateTokenNotFoundResponse: "generateTokenNotFoundResponse",
    })
    .addConditionalEdges("comprehensiveMcpAnalysis", routeAfterMcpAnalysis, {
      generateWeb3Response: "generateWeb3Response",
    })
    .addEdge("generateWeb3Response", END)
    .addEdge("generateNonWeb3Response", END)
    .addEdge("generateTokenNotFoundResponse", END);

  return graph.compile();
};

// Compile the graph
export const scoutGraph = createScoutGraph();

// Legacy compatibility function for existing server code
export function createSimpleGraph() {
  return scoutGraph;
}

// Export types
export type ScoutGraphState = typeof ScoutState.State;
