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

// Token ticker detection - let MCP handle all token discovery naturally
const detectTokenTickers = (input: string): string[] => {
  // Extract potential token symbols (2-6 uppercase letters that could be tokens)
  const tokenPattern = /\b[A-Z]{2,6}\b/g;
  const matches = input.match(tokenPattern) || [];
  
  // Filter out common English words that aren't tokens
  const commonWords = ['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HOW', 'ITS', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WHO', 'BOY', 'DID', 'HAD', 'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE', 'WITH', 'THAT', 'THIS', 'HAVE', 'FROM', 'THEY', 'KNOW', 'WANT', 'BEEN', 'GOOD', 'MUCH', 'SOME', 'TIME', 'VERY', 'WHEN', 'COME', 'HERE', 'JUST', 'LIKE', 'LONG', 'MAKE', 'MANY', 'OVER', 'SUCH', 'TAKE', 'THAN', 'THEM', 'WELL', 'WERE'];
  
  const detectedTickers = matches.filter(match => !commonWords.includes(match));
  
  console.log('🪙 Detected potential token tickers (natural detection):', detectedTickers);
  return [...new Set(detectedTickers)]; // Remove duplicates
};

// Network detection utility
const detectNetwork = (input: string): string => {
  const lowerInput = input.toLowerCase();
  
  // Network keywords - prioritize Base since you mentioned it
  if (lowerInput.includes('base')) return 'base';
  if (lowerInput.includes('polygon') || lowerInput.includes('matic')) return 'polygon';
  if (lowerInput.includes('arbitrum')) return 'arbitrum';
  if (lowerInput.includes('optimism')) return 'optimism';
  if (lowerInput.includes('ethereum') || lowerInput.includes('eth') || lowerInput.includes('mainnet')) return 'ethereum';
  
  // Default to ethereum, but we should analyze on multiple networks
  return 'ethereum';
};

// Get network configuration for Nodit API
const getNetworkConfig = (network: string): string => {
  switch (network) {
    case 'base':
      return 'mainnet'; // Base mainnet
    case 'ethereum':
      return 'mainnet'; // Ethereum mainnet
    case 'polygon':
      return 'mainnet'; // Polygon mainnet
    case 'arbitrum':
      return 'mainnet'; // Arbitrum mainnet
    case 'optimism':
      return 'mainnet'; // Optimism mainnet
    default:
      return 'mainnet';
  }
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
  
  console.log('🔎 Running comprehensive detection on input:', input);  // Detect token tickers with natural patterns
  const detectedTokens = detectTokenTickers(input);
  
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
    
    // Group wallet data by address to show all networks
    const walletsByAddress = state.walletData.reduce((acc: any, wallet: any) => {
      if (!acc[wallet.address]) {
        acc[wallet.address] = [];
      }
      acc[wallet.address].push(wallet);
      return acc;
    }, {});
    
    for (const [address, walletDataArray] of Object.entries(walletsByAddress)) {
      analysisResults += `• **Address**: \`${address}\`\n`;
      
      // Show data for each network
      for (const wallet of walletDataArray as any[]) {
        analysisResults += `  - **${wallet.networkChecked || wallet.network} Network:**\n`;
        
        if (wallet.error) {
          analysisResults += `    ❌ Error: ${wallet.error}\n`;
          continue;
        }
        
        if (wallet.type) {
          analysisResults += `    Type: ${wallet.type}\n`;
        }
        
        // Native balance information
        if (wallet.nativeBalance) {
          analysisResults += `    Balance: ${wallet.nativeBalance.formatted} ${wallet.nativeBalance.symbol}\n`;
        } else if (wallet.balanceError) {
          analysisResults += `    Balance: ❌ ${wallet.balanceError}\n`;
        } else {
          analysisResults += `    Balance: 0.000000 ${wallet.network === 'polygon' ? 'MATIC' : 'ETH'}\n`;
        }
        
        // Token activity from transfers
        if (wallet.recentTokenActivity && wallet.recentTokenActivity.tokens.length > 0) {
          analysisResults += `    Recent Token Activity: ${wallet.recentTokenActivity.uniqueTokens} tokens (${wallet.recentTokenActivity.transferCount} transfers)\n`;
          wallet.recentTokenActivity.tokens.slice(0, 3).forEach((token: any, index: number) => {
            analysisResults += `      ${index + 1}. ${token.symbol || 'Unknown'}\n`;
          });
        }
        
        // Activity level
        if (wallet.transactionCount !== undefined) {
          analysisResults += `    Activity: ${wallet.transactionCount} transactions (${wallet.activityLevel || 'Unknown'} activity)\n`;
        }
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
    // Return structured data directly instead of using LLM to format
  console.log('🚀 Generating structured Web3 response');
  console.log('🪙 Detected tokens:', state.detectedTokens);
  console.log('📋 Detected contracts:', state.detectedContracts);
  console.log('👤 Detected wallets:', state.detectedWallets);
  console.log('🔗 MCP Connection Status:', state.mcpConnected);
  console.log('📊 Analysis Stats:', state.analysisStats);
  
  // Create structured response object
  const structuredResponse: any = {
    query: state.input,
    status: state.mcpConnected ? 'live_data' : 'offline_mode',
    data_quality: dataQuality,
    results: {}
  };
  
  // Add token data
  if (state.detectedTokens.length > 0) {
    structuredResponse.results.tokens = state.detectedTokens.map(token => {
      const tokenInfo = state.tokenData.find(t => t.symbol === token);
      if (tokenInfo && tokenInfo.success && tokenInfo.metadata) {
        const meta = tokenInfo.metadata;
        const holderInfo = tokenInfo.holderInfo;
        return {
          symbol: token,
          name: meta.name || 'Unknown',
          contract: tokenInfo.contractAddress,
          type: meta.type || 'ERC20',
          total_supply: meta.totalSupply ? formatTokenSupply(meta.totalSupply, meta.decimals || 18) : null,
          holders: holderInfo?.count || null,
          deployed: meta.deployedAt ? new Date(meta.deployedAt).toLocaleDateString() : null,
          risk_level: getTokenRiskLevel(meta, holderInfo)
        };
      } else if (tokenInfo && tokenInfo.error) {
        return { symbol: token, error: tokenInfo.error };
      } else {
        return { symbol: token, status: 'detected' };
      }
    });
  }
  
  // Add contract data
  if (state.contractData && state.contractData.length > 0) {
    structuredResponse.results.contracts = state.contractData.map(contract => ({
      address: contract.address,
      network: contract.network,
      type: contract.contractType || null,
      verified: contract.checks?.isContract || false,
      token_metadata: contract.tokenMetadata?.[0] ? {
        name: contract.tokenMetadata[0].name,
        symbol: contract.tokenMetadata[0].symbol,
        supply: contract.tokenMetadata[0].totalSupply && contract.tokenMetadata[0].decimals ? 
          formatTokenSupply(contract.tokenMetadata[0].totalSupply, contract.tokenMetadata[0].decimals) : null,
        deployed: contract.tokenMetadata[0].deployedAt ? 
          new Date(contract.tokenMetadata[0].deployedAt).toLocaleDateString() : null
      } : null,
      holders: contract.tokenHolders?.count || null,
      error: contract.error || null
    }));
  }
  
  // Add wallet data
  if (state.walletData && state.walletData.length > 0) {
    const walletsByAddress = state.walletData.reduce((acc: any, wallet: any) => {
      if (!acc[wallet.address]) {
        acc[wallet.address] = {
          address: wallet.address,
          networks: {}
        };
      }
      acc[wallet.address].networks[wallet.networkChecked || wallet.network] = {
        balance: wallet.nativeBalance ? {
          amount: wallet.nativeBalance.formatted,
          symbol: wallet.nativeBalance.symbol
        } : null,
        type: wallet.type || null,
        activity_level: wallet.activityLevel || null,
        transaction_count: wallet.transactionCount || null,
        recent_tokens: wallet.recentTokenActivity?.tokens.slice(0, 3).map((t: any) => t.symbol) || [],
        error: wallet.error || null
      };
      return acc;
    }, {});
    
    structuredResponse.results.wallets = Object.values(walletsByAddress);
  }
  
  // Add analysis summary
  if (state.analysisStats && state.analysisStats.total > 0) {
    structuredResponse.analysis_summary = {
      total_entities: state.analysisStats.total,
      successful: state.analysisStats.successful,
      success_rate: Math.round((state.analysisStats.successful / state.analysisStats.total) * 100)
    };
  }
  
  const responseText = JSON.stringify(structuredResponse, null, 2);

  return {
    messages: [new AIMessage(responseText)],
    output: responseText,
  };
};

// Non-Web3 response node - handles non-Web3 queries
const nonWeb3ResponseNode = async (state: typeof ScoutState.State) => {
  const response = "Error: Non-Web3 query. This API handles cryptocurrency and blockchain data only.";
  
  console.log('❌ Non-Web3 query detected, providing redirect response');
  
  return {
    messages: [new AIMessage(response)],
    output: response,
  };
};

// Token not found response node
const tokenNotFoundNode = async (state: typeof ScoutState.State) => {
  const response = "Error: Token not found. Available tokens: BTC, ETH, USDC, USDT, SOL, MATIC, WETH. Use external API for other tokens.";
  
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

// Enhanced wallet analysis with balance and asset information
async function analyzeWalletAddress(address: string, mcpManager: McpConnectionManager, network: string, networkConfig: string): Promise<any> {
  try {
    console.log(`👤 Analyzing wallet address: ${address} on ${network}/${networkConfig}`);
    
    const walletAnalysis: any = {
      address,
      network,
      timestamp: new Date().toISOString()
    };
    
    // Step 1: Check if address is a contract or wallet using proper Nodit API
    try {
      // Try to get account information first
      const accountResult = await mcpManager.callApi(
        'getAccount',
        network,
        networkConfig,
        { address }
      );
      
      if (accountResult) {
        walletAnalysis.type = accountResult.type || 'Wallet (EOA)';
        walletAnalysis.isContract = accountResult.type === 'contract';
        
        // Get native balance if available
        if (accountResult.balance !== undefined) {
          const balanceInWei = BigInt(accountResult.balance);
          const balanceInEth = Number(balanceInWei) / 1e18;
          
          walletAnalysis.nativeBalance = {
            raw: accountResult.balance,
            formatted: balanceInEth.toFixed(6),
            symbol: network === 'polygon' ? 'MATIC' : 
                   network === 'base' ? 'ETH' : 
                   network === 'arbitrum' ? 'ETH' : 
                   network === 'optimism' ? 'ETH' : 'ETH'
          };
          
          console.log(`💰 Native balance: ${balanceInEth.toFixed(6)} ${walletAnalysis.nativeBalance.symbol}`);
        }
      }
      
    } catch (error) {
      console.warn(`⚠️ getAccount failed for ${address}, trying alternative methods:`, error);
      
      // Fallback: Try to check if it's a contract
      try {
        const contractCheck = await mcpManager.callApi(
          'isContract',
          network,
          networkConfig,
          { address }
        );
        
        walletAnalysis.isContract = contractCheck?.result === true;
        walletAnalysis.type = contractCheck?.result === true ? 'Smart Contract' : 'Wallet (EOA)';
        
      } catch (contractError) {
        console.warn(`⚠️ isContract also failed:`, contractError);
        walletAnalysis.type = 'Wallet (EOA)'; // Default assumption
        walletAnalysis.isContract = false;
      }
    }
    
    // Step 2: Try to get native balance separately if not already obtained
    if (!walletAnalysis.nativeBalance) {
      try {
        const balanceResult = await mcpManager.callApi(
          'getBalance',
          network,
          networkConfig,
          { address }
        );
        
        if (balanceResult && balanceResult.balance !== undefined) {
          const balanceInWei = BigInt(balanceResult.balance);
          const balanceInEth = Number(balanceInWei) / 1e18;
          
          walletAnalysis.nativeBalance = {
            raw: balanceResult.balance,
            formatted: balanceInEth.toFixed(6),
            symbol: network === 'polygon' ? 'MATIC' : 
                   network === 'base' ? 'ETH' : 
                   network === 'arbitrum' ? 'ETH' : 
                   network === 'optimism' ? 'ETH' : 'ETH'
          };
          
          console.log(`💰 Native balance (separate call): ${balanceInEth.toFixed(6)} ${walletAnalysis.nativeBalance.symbol}`);
        }
        
      } catch (error) {
        console.warn(`⚠️ Could not get native balance for ${address}:`, error);
        walletAnalysis.balanceError = 'Balance lookup failed';
      }
    }
    
    // Step 3: Try to get ERC20 token information
    try {
      // Try to get token transfers to see what tokens this address interacts with
      const transfersResult = await mcpManager.callApi(
        'getTokenTransfers',
        network,
        networkConfig,
        {
          address,
          limit: 50
        }
      );
      
      if (transfersResult && transfersResult.transfers && transfersResult.transfers.length > 0) {
        // Extract unique token contracts from recent transfers
        const tokenContracts = [...new Set(transfersResult.transfers.map((t: any) => t.contractAddress))]
          .filter(Boolean)
          .slice(0, 10);
          
        walletAnalysis.recentTokenActivity = {
          transferCount: transfersResult.transfers.length,
          uniqueTokens: tokenContracts.length,
          tokens: tokenContracts.map((contract: any) => ({
            contractAddress: contract,
            // Try to get token symbol/name from transfer data
            symbol: transfersResult.transfers.find((t: any) => t.contractAddress === contract)?.symbol || 'Unknown',
            name: transfersResult.transfers.find((t: any) => t.contractAddress === contract)?.name || 'Unknown Token'
          }))
        };
        
        console.log(`📋 Found ${tokenContracts.length} unique tokens from ${transfersResult.transfers.length} recent transfers`);
      }
      
    } catch (error) {
      console.warn(`⚠️ Could not get token transfers for ${address}:`, error);
      walletAnalysis.tokenError = 'Token activity lookup failed';
    }
    
    // Step 4: Try to get transaction count
    try {
      const txCountResult = await mcpManager.callApi(
        'getTransactionCount',
        network,
        networkConfig,
        { address }
      );
      
      if (txCountResult && txCountResult.count !== undefined) {
        walletAnalysis.transactionCount = txCountResult.count;
        walletAnalysis.activityLevel = txCountResult.count > 1000 ? 'High' : 
                                       txCountResult.count > 100 ? 'Medium' : 
                                       txCountResult.count > 10 ? 'Low' : 'Very Low';
                                       
        console.log(`📊 Transaction count: ${txCountResult.count} (${walletAnalysis.activityLevel} activity)`);
      }
      
    } catch (error) {
      console.warn(`⚠️ Could not get transaction count for ${address}:`, error);
    }
    
    walletAnalysis.success = true;
    return walletAnalysis;
    
  } catch (error) {
    console.error(`❌ Wallet analysis failed for ${address}:`, error);
    return {
      address,
      network,
      error: error instanceof Error ? error.message : 'Wallet analysis failed',
      success: false,
      timestamp: new Date().toISOString()
    };
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
    }    // Analyze wallet addresses on multiple networks (Ethereum and Base)
    const networksToCheck = ['ethereum', 'base']; // Check both main networks
    
    for (const walletAddress of state.detectedWallets) {
      if (!state.detectedContracts.includes(walletAddress)) {
        // Analyze on multiple networks
        for (const networkToCheck of networksToCheck) {
          const networkConfigToCheck = getNetworkConfig(networkToCheck);
          console.log(`🌐 Analyzing ${walletAddress} on ${networkToCheck}/${networkConfigToCheck}`);
          
          const walletAnalysis = await analyzeWalletAddress(walletAddress, mcpManager, networkToCheck, networkConfigToCheck);
          
          // Add network info to the analysis
          walletAnalysis.networkChecked = networkToCheck;
          walletData.push(walletAnalysis);
        }
      }
    }
    
    // Also analyze any addresses initially thought to be contracts but are actually wallets
    for (const contractAnalysis of contractData) {
      if (contractAnalysis.addressType === "wallet") {
        // Re-analyze with enhanced wallet analysis on multiple networks
        for (const networkToCheck of networksToCheck) {
          const networkConfigToCheck = getNetworkConfig(networkToCheck);
          const enhancedWalletAnalysis = await analyzeWalletAddress(contractAnalysis.address, mcpManager, networkToCheck, networkConfigToCheck);
          enhancedWalletAnalysis.networkChecked = networkToCheck;
          walletData.push(enhancedWalletAnalysis);
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
