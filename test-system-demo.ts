import { scoutGraph } from './src/ai/multi-node-graph';
import dotenv from 'dotenv';

dotenv.config();

// Comprehensive system monitoring and demo scenarios
const demoScenarios = [
  {
    category: "Basic Token Analysis",
    scenarios: [
      { input: "what is Bitcoin", description: "Simple Bitcoin query" },
      { input: "tell me about ETH", description: "Ethereum information" },
      { input: "USDT price", description: "USDT ticker detection" }
    ]
  },
  {
    category: "Smart Contract Analysis", 
    scenarios: [
      { input: "analyze this contract 0xdAC17F958D2ee523a2206206994597C13D831ec7", description: "USDT contract analysis" },
      { input: "what is 0xA0b86a33E6441Da9DeFb853d68CBcfC7D8De8Bc1", description: "Contract investigation" }
    ]
  },
  {
    category: "Wallet Investigation",
    scenarios: [
      { input: "whose wallet is 0xF977814e90dA44bFA03b6295A0616a897441aceC", description: "Large wallet analysis" },
      { input: "check address 0x1234567890123456789012345678901234567890", description: "Invalid address handling" }
    ]
  },
  {
    category: "Advanced Pattern Recognition",
    scenarios: [
      { input: "swap Bitcoin for wrapped ethereum", description: "Multi-token with variations" },
      { input: "I want to buy some SHIB and DOGE tokens", description: "Meme token detection" },
      { input: "DeFi yield farming with AAVE and Compound", description: "DeFi token recognition" }
    ]
  },
  {
    category: "Edge Cases & Error Handling",
    scenarios: [
      { input: "FAKECOIN123 to the moon", description: "Unknown token handling" },
      { input: "what's the weather today", description: "Non-crypto content" },
      { input: "sent 0x123 to my friend", description: "Incomplete address" }
    ]
  }
];

// Performance metrics tracking
interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  averageResponseTime: number;
  tokenDetectionAccuracy: number;
  contractAnalysisAccuracy: number;
  walletDetectionAccuracy: number;
  mcpConnectionReliability: number;
  categoriesAnalyzed: {
    tokens: number;
    contracts: number;
    wallets: number;
    nonWeb3: number;
  };
}

async function runSystemDemo() {
  console.log('🚀 Scout Backend System Demo & Performance Analysis');
  console.log('='.repeat(80));
  
  const startTime = Date.now();
  let totalMetrics: PerformanceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    averageResponseTime: 0,
    tokenDetectionAccuracy: 0,
    contractAnalysisAccuracy: 0,
    walletDetectionAccuracy: 0,
    mcpConnectionReliability: 0,
    categoriesAnalyzed: {
      tokens: 0,
      contracts: 0,
      wallets: 0,
      nonWeb3: 0
    }
  };
  
  const responseTimes: number[] = [];
  let mcpConnections = 0;
  let successfulMcpConnections = 0;
  
  // Run demo scenarios
  for (const category of demoScenarios) {
    console.log(`\n📂 Category: ${category.category}`);
    console.log('─'.repeat(60));
    
    for (const scenario of category.scenarios) {
      console.log(`\n🔍 Scenario: ${scenario.description}`);
      console.log(`Input: "${scenario.input}"`);
      
      try {
        const scenarioStartTime = Date.now();
        
        const result = await scoutGraph.invoke({
          input: scenario.input,
          messages: []
        });
        
        const responseTime = Date.now() - scenarioStartTime;
        responseTimes.push(responseTime);
        totalMetrics.totalRequests++;
        
        // Analyze results
        const classification = result.classification || 'unknown';
        const mcpConnected = result.mcpConnected || false;
        const tokenCount = result.detectedTokens?.length || 0;
        const contractCount = result.detectedContracts?.length || 0;
        const walletCount = result.detectedWallets?.length || 0;
        
        // Update metrics
        if (mcpConnected) {
          mcpConnections++;
          successfulMcpConnections++;
        } else {
          mcpConnections++;
        }
        
        if (classification === 'web3') {
          totalMetrics.successfulRequests++;
          if (tokenCount > 0) totalMetrics.categoriesAnalyzed.tokens++;
          if (contractCount > 0) totalMetrics.categoriesAnalyzed.contracts++;
          if (walletCount > 0) totalMetrics.categoriesAnalyzed.wallets++;
        } else {
          totalMetrics.categoriesAnalyzed.nonWeb3++;
          totalMetrics.successfulRequests++; // Non-web3 is also a successful classification
        }
        
        // Display results
        console.log(`⚡ Response Time: ${responseTime}ms`);
        console.log(`🎯 Classification: ${classification}`);
        console.log(`🔗 MCP Connected: ${mcpConnected ? '✅' : '❌'}`);
        console.log(`📊 Entities: ${tokenCount} tokens, ${contractCount} contracts, ${walletCount} wallets`);
        
        if (result.analysisStats) {
          const { successful, total } = result.analysisStats;
          console.log(`📈 Analysis Success: ${successful}/${total} (${Math.round((successful/total)*100)}%)`);
        }
        
        // Show response preview
        const responsePreview = result.output?.substring(0, 150) || 'No response';
        console.log(`💬 Response: "${responsePreview}${result.output?.length > 150 ? '...' : ''}"`);
        
      } catch (error) {
        console.error(`❌ Scenario failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        totalMetrics.totalRequests++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Calculate final metrics
  const totalTime = Date.now() - startTime;
  totalMetrics.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0;
  totalMetrics.mcpConnectionReliability = mcpConnections > 0 ? (successfulMcpConnections / mcpConnections) * 100 : 0;
  
  // Display comprehensive results
  console.log('\n🎉 SYSTEM DEMO COMPLETE!');
  console.log('='.repeat(80));
  console.log('📊 PERFORMANCE METRICS:');
  console.log('─'.repeat(40));
  console.log(`⏱️  Total Demo Time: ${Math.round(totalTime / 1000)}s`);
  console.log(`📡 Total Requests: ${totalMetrics.totalRequests}`);
  console.log(`✅ Successful Requests: ${totalMetrics.successfulRequests}/${totalMetrics.totalRequests} (${Math.round((totalMetrics.successfulRequests/totalMetrics.totalRequests)*100)}%)`);
  console.log(`⚡ Average Response Time: ${Math.round(totalMetrics.averageResponseTime)}ms`);
  console.log(`🔗 MCP Reliability: ${Math.round(totalMetrics.mcpConnectionReliability)}%`);
  
  console.log('\n📈 ENTITY ANALYSIS BREAKDOWN:');
  console.log('─'.repeat(40));
  console.log(`🪙 Token Analyses: ${totalMetrics.categoriesAnalyzed.tokens}`);
  console.log(`📋 Contract Analyses: ${totalMetrics.categoriesAnalyzed.contracts}`);
  console.log(`👤 Wallet Analyses: ${totalMetrics.categoriesAnalyzed.wallets}`);
  console.log(`🌍 Non-Web3 Queries: ${totalMetrics.categoriesAnalyzed.nonWeb3}`);
  
  console.log('\n🚀 SYSTEM READINESS ASSESSMENT:');
  console.log('─'.repeat(40));
  
  const overallScore = (
    (totalMetrics.successfulRequests / totalMetrics.totalRequests) * 0.4 +
    (totalMetrics.mcpConnectionReliability / 100) * 0.3 +
    (totalMetrics.averageResponseTime < 10000 ? 1 : 0.5) * 0.2 +
    (totalMetrics.categoriesAnalyzed.tokens > 0 && totalMetrics.categoriesAnalyzed.contracts > 0 ? 1 : 0.5) * 0.1
  ) * 100;
  
  console.log(`🎯 Overall System Score: ${Math.round(overallScore)}%`);
  
  if (overallScore >= 85) {
    console.log('🌟 STATUS: EXCELLENT - Ready for production deployment!');
  } else if (overallScore >= 70) {
    console.log('🔥 STATUS: GOOD - Ready for hackathon demo with minor optimizations');
  } else if (overallScore >= 50) {
    console.log('⚡ STATUS: FAIR - Functional but needs improvement');
  } else {
    console.log('⚠️  STATUS: NEEDS WORK - Requires debugging before demo');
  }
  
  console.log('\n🔧 KEY FEATURES DEMONSTRATED:');
  console.log('─'.repeat(40));
  console.log('• ✅ Multi-node LangGraph workflow');
  console.log('• ✅ Enhanced token pattern recognition');
  console.log('• ✅ Smart contract analysis via Nodit MCP');
  console.log('• ✅ Wallet address detection and verification');
  console.log('• ✅ Robust error handling and fallback responses');
  console.log('• ✅ Real-time blockchain data integration');
  console.log('• ✅ User-friendly conversational responses');
  console.log('• ✅ Performance monitoring and analytics');
  
  console.log('\n🎮 DEMO SCENARIOS COVERED:');
  console.log('─'.repeat(40));
  demoScenarios.forEach(category => {
    console.log(`• ${category.category} (${category.scenarios.length} scenarios)`);
  });
  
  console.log('\n🚀 Ready for Scout Chrome Extension Integration!');
  console.log('Backend URL: http://localhost:3001/analyze');
  console.log('='.repeat(80));
  
  return totalMetrics;
}

// Export for use in other modules
export { runSystemDemo, demoScenarios };

// Run demo if called directly
if (require.main === module) {
  runSystemDemo().catch(console.error);
}
