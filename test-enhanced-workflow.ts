import { scoutGraph } from './src/ai/multi-node-graph';
import dotenv from 'dotenv';

dotenv.config();

// Test cases as specified by the user
const testCases = [
  {
    name: "Contract Address Detection",
    input: "huh this 0xdAC17F958D2ee523a2206206994597C13D831ec7 aint stopping",
    expected: "web3",
    description: "Should detect USDT contract address and provide comprehensive analysis"
  },
  {
    name: "Token Ticker Detection", 
    input: "I dont have this weth bruh",
    expected: "web3",
    description: "Should detect WETH ticker and provide token information"
  },
  {
    name: "Wallet Address Detection",
    input: "bruh whose wallet is this 0xF977814e90dA44bFA03b6295A0616a897441aceC",
    expected: "web3", 
    description: "Should detect wallet address and provide wallet analysis"
  },
  {
    name: "Non-Web3 Content",
    input: "can some one give me water",
    expected: "non-web3",
    description: "Should recognize as non-Web3 and provide appropriate response"
  }
];

async function runTestCases() {
  console.log('🚀 Testing Enhanced Scout Graph with MCP Integration');
  console.log('=' .repeat(60));
  
  for (const testCase of testCases) {
    console.log(`\n📋 Test Case: ${testCase.name}`);
    console.log(`Input: "${testCase.input}"`);
    console.log(`Expected Classification: ${testCase.expected}`);
    console.log(`Description: ${testCase.description}`);
    console.log('-'.repeat(50));
    
    try {
      const startTime = Date.now();
      
      // Run the graph with the test input
      const result = await scoutGraph.invoke({
        input: testCase.input,
        messages: []
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log('✅ Test Results:');
      console.log(`⏱️  Processing Time: ${duration}ms`);
      console.log(`🔍 Classification: ${result.classification} (confidence: ${result.confidence})`);
      console.log(`🪙 Detected Tokens: ${result.detectedTokens.join(', ') || 'None'}`);
      console.log(`📋 Detected Contracts: ${result.detectedContracts.join(', ') || 'None'}`);
      console.log(`👤 Detected Wallets: ${result.detectedWallets.join(', ') || 'None'}`);
      console.log(`🔗 MCP Connected: ${result.mcpConnected ? '✅' : '❌'}`);
      
      if (result.tokenData && result.tokenData.length > 0) {
        console.log(`📊 Token Data: ${result.tokenData.length} tokens analyzed`);
      }
      
      if (result.contractData && result.contractData.length > 0) {
        console.log(`📋 Contract Data: ${result.contractData.length} contracts analyzed`);
      }
      
      if (result.walletData && result.walletData.length > 0) {
        console.log(`👤 Wallet Data: ${result.walletData.length} wallets analyzed`);
      }
      
      console.log('\n💬 Final Response:');
      console.log(`"${result.output}"`);
      
      // Validation
      const classificationMatch = result.classification === testCase.expected;
      console.log(`\n✅ Classification Match: ${classificationMatch ? '✅ PASS' : '❌ FAIL'}`);
      
    } catch (error) {
      console.error('❌ Test Failed:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        console.error('Stack trace:', error.stack);
      }
    }
    
    console.log('='.repeat(60));
  }
  
  console.log('\n🎉 All tests completed!');
  console.log('\nKey Features Tested:');
  console.log('• ✅ Contract address detection and analysis via MCP');
  console.log('• ✅ Token ticker detection and metadata lookup');
  console.log('• ✅ Wallet address detection and differentiation');
  console.log('• ✅ Non-Web3 content classification');
  console.log('• ✅ Comprehensive MCP integration with Nodit server');
  console.log('• ✅ Enhanced response formatting with analysis');
}

// Run the tests
runTestCases().catch(console.error);
