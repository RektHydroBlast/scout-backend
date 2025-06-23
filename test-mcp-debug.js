const { scoutGraph } = require('./dist/ai/multi-node-graph.js');

// Debug specific issues found in comprehensive test
const debugTests = [
  {
    name: "Address Detection Issue",
    input: "0x8ba1f109551bD432803012645Hac136c5ae4F9c4",
    description: "Testing problematic address with non-hex character 'H'"
  },
  {
    name: "Valid Contract Address",
    input: "0xA0b73E1Ff0B80914AB6fe0444E65848C4C34450b",
    description: "Testing known valid contract address"
  },
  {
    name: "Long Token Pattern",
    input: "NONEXISTENTTOKEN123",
    description: "Testing long token symbol detection"
  },
  {
    name: "Network Detection - Base",
    input: "base network tokens",
    description: "Testing Base network detection"
  }
];

async function runDebugTest() {
  console.log('🔬 MCP Server Debug Test - Investigating Specific Issues');
  console.log('='.repeat(60));

  for (const test of debugTests) {
    console.log(`\n🧪 ${test.name}`);
    console.log(`📝 Description: ${test.description}`);
    console.log(`🔍 Testing: "${test.input}"`);
    console.log('-'.repeat(40));

    try {
      // Test just the detection functions directly if we can access them
      console.log('🔍 Testing address detection...');
      
      // Ethereum address pattern test
      const ethAddressPattern = /0x[a-fA-F0-9]{40}/g;
      const addressMatches = test.input.match(ethAddressPattern) || [];
      console.log(`📋 Address pattern matches:`, addressMatches);
      
      // Token pattern test
      const tokenPattern = /\b[A-Z]{2,6}\b/g;
      const tokenMatches = test.input.match(tokenPattern) || [];
      console.log(`🪙 Token pattern matches:`, tokenMatches);
      
      // Network detection test
      const lowerInput = test.input.toLowerCase();
      let detectedNetwork = 'ethereum'; // default
      if (lowerInput.includes('base')) detectedNetwork = 'base';
      if (lowerInput.includes('polygon')) detectedNetwork = 'polygon';
      console.log(`🌐 Detected network:`, detectedNetwork);
      
      // Now test the full graph
      console.log('\n🚀 Testing full graph execution...');
      const startTime = Date.now();
      
      const result = await scoutGraph.invoke({
        input: test.input,
        messages: []
      });
      
      const duration = Date.now() - startTime;
      
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log(`🔗 MCP Connected: ${result.mcpConnected}`);
      console.log(`📊 Classification: ${result.classification} (${result.confidence})`);
      console.log(`🪙 Detected tokens: [${result.detectedTokens?.join(', ') || 'none'}]`);
      console.log(`📋 Detected contracts: [${result.detectedContracts?.join(', ') || 'none'}]`);
      console.log(`👤 Detected wallets: [${result.detectedWallets?.join(', ') || 'none'}]`);
      
      if (result.analysisStats) {
        console.log(`📈 Analysis: ${result.analysisStats.successful}/${result.analysisStats.total} successful`);
      }
      
    } catch (error) {
      console.error(`❌ Test failed:`, error.message);
    }
    
    console.log('\n' + '='.repeat(40));
  }
}

// Run the debug test
if (require.main === module) {
  runDebugTest()
    .then(() => {
      console.log('\n🎯 Debug test completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Debug test failed:', error);
      process.exit(1);
    });
}

module.exports = { runDebugTest };
