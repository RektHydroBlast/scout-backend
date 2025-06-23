import { scoutGraph } from './src/ai/multi-node-graph';
import dotenv from 'dotenv';

dotenv.config();

// Test cases to validate enhanced features
const enhancedTestCases = [
  {
    name: "Enhanced Token Detection - Bitcoin Variations",
    input: "I want to buy some Bitcoin and ETHEREUM please",
    expected: "web3",
    description: "Should detect BTC and ETH from full names"
  },
  {
    name: "Enhanced Token Detection - Wrapped Tokens",
    input: "swap my wrapped ethereum for wrapped bitcoin",
    expected: "web3",
    description: "Should detect WETH and WBTC from descriptions"
  },
  {
    name: "Risk Assessment Test - New Token",
    input: "MOCKWETH",
    expected: "web3",
    description: "Should provide risk assessment for newer tokens"
  },
  {
    name: "Multiple Entity Analysis",
    input: "Compare USDT token at 0xdAC17F958D2ee523a2206206994597C13D831ec7 with ETH",
    expected: "web3",
    description: "Should analyze multiple entities with enhanced formatting"
  },
  {
    name: "Analytics and Insights Test",
    input: "tell me about ethereum and bitcoin",
    expected: "web3",
    description: "Should provide analytical insights about multiple tokens"
  }
];

async function runEnhancedFeatureTests() {
  console.log('🚀 Testing Enhanced Scout Graph Features');
  console.log('=' .repeat(70));
  
  let passCount = 0;
  let totalCount = enhancedTestCases.length;
  
  for (const [index, testCase] of enhancedTestCases.entries()) {
    console.log(`\n📋 Test ${index + 1}/${totalCount}: ${testCase.name}`);
    console.log(`Input: "${testCase.input}"`);
    console.log(`Expected Classification: ${testCase.expected}`);
    console.log(`Description: ${testCase.description}`);
    console.log('-'.repeat(60));
    
    try {
      const startTime = Date.now();
      
      // Run the graph with the test input
      const result = await scoutGraph.invoke({
        input: testCase.input,
        messages: []
      });
      
      const processingTime = Date.now() - startTime;
      
      // Extract results
      const classification = result.classification || 'unknown';
      const confidence = result.confidence || 0;
      const detectedTokens = result.detectedTokens || [];
      const detectedContracts = result.detectedContracts || [];
      const detectedWallets = result.detectedWallets || [];
      const mcpConnected = result.mcpConnected || false;
      const finalResponse = result.output || 'No response generated';
      
      console.log('✅ Enhanced Test Results:');
      console.log(`⏱️  Processing Time: ${processingTime}ms`);
      console.log(`🔍 Classification: ${classification} (confidence: ${confidence})`);
      console.log(`🪙 Detected Tokens: ${detectedTokens.length > 0 ? detectedTokens.join(', ') : 'None'}`);
      console.log(`📋 Detected Contracts: ${detectedContracts.length > 0 ? detectedContracts.length : 'None'}`);
      console.log(`👤 Detected Wallets: ${detectedWallets.length > 0 ? detectedWallets.length : 'None'}`);
      console.log(`🔗 MCP Connected: ${mcpConnected ? '✅' : '❌'}`);
      
      // Enhanced analysis data
      if (result.tokenData && result.tokenData.length > 0) {
        console.log(`📊 Token Analysis: ${result.tokenData.length} tokens processed`);
        const successfulTokens = result.tokenData.filter((t: any) => t.success).length;
        console.log(`📈 Token Success Rate: ${successfulTokens}/${result.tokenData.length}`);
      }
      
      if (result.analysisStats) {
        console.log(`📊 Overall Success Rate: ${result.analysisStats.successful}/${result.analysisStats.total}`);
      }
      
      // Check for enhanced features in response
      const hasRiskAssessment = finalResponse.includes('Risk Assessment:') || finalResponse.includes('🔴') || finalResponse.includes('🟡') || finalResponse.includes('🟢');
      const hasSupplyFormatting = finalResponse.includes('T') || finalResponse.includes('B') || finalResponse.includes('M') || finalResponse.includes('K');
      const hasInsights = finalResponse.includes('Quick Insights:') || finalResponse.includes('💡');
      
      console.log(`🔍 Enhanced Features Detected:`);
      console.log(`  - Risk Assessment: ${hasRiskAssessment ? '✅' : '❌'}`);
      console.log(`  - Supply Formatting: ${hasSupplyFormatting ? '✅' : '❌'}`);
      console.log(`  - Analytical Insights: ${hasInsights ? '✅' : '❌'}`);
      
      console.log(`💬 Response Preview (first 200 characters):`);
      console.log(`"${finalResponse.substring(0, 200)}${finalResponse.length > 200 ? '...' : ''}"`);
      
      // Determine if test passed
      const classificationMatch = classification === testCase.expected;
      const hasEntities = detectedTokens.length > 0 || detectedContracts.length > 0 || detectedWallets.length > 0;
      
      if (classificationMatch && (testCase.expected === 'non-web3' || hasEntities)) {
        console.log(`✅ Classification Match: ✅ PASS`);
        passCount++;
      } else {
        console.log(`❌ Classification Match: ❌ FAIL`);
      }
      
    } catch (error) {
      console.error('❌ Test execution failed:', error);
      console.log(`💥 Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    console.log('='.repeat(70));
  }
  
  // Final summary
  console.log(`\n🎉 Enhanced Feature Testing Complete!`);
  console.log('='.repeat(70));
  console.log(`📊 FINAL RESULTS:`);
  console.log(`✅ Passed: ${passCount}/${totalCount}`);
  console.log(`❌ Failed: ${totalCount - passCount}/${totalCount}`);
  console.log(`🎯 Success Rate: ${Math.round((passCount / totalCount) * 100)}%`);
  
  console.log(`\n🔧 Enhanced Features Tested:`);
  console.log(`• ✅ Improved token pattern matching (Bitcoin → BTC, Ethereum → ETH)`);
  console.log(`• ✅ Enhanced supply formatting (K, M, B, T notation)`);
  console.log(`• ✅ Token risk assessment system`);
  console.log(`• ✅ Analytical insights generation`);
  console.log(`• ✅ Performance monitoring and stats`);
  console.log(`• ✅ Enhanced response formatting`);
}

// Run the enhanced tests
if (require.main === module) {
  runEnhancedFeatureTests().catch(console.error);
}

export { runEnhancedFeatureTests };
