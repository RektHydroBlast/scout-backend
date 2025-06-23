const { scoutGraph } = require('./dist/ai/multi-node-graph.js');

// Quick test for KAITO token
async function testKaitoToken() {
  console.log('🤖 Testing KAITO Token Analysis');
  console.log('='.repeat(50));
  
  const testMessage = "hey that's my KAITO";
  
  console.log(`🔍 Input: "${testMessage}"`);
  console.log('-'.repeat(30));
  
  try {
    const startTime = Date.now();
    
    const result = await scoutGraph.invoke({
      input: testMessage,
      messages: []
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`⏱️  Execution time: ${duration}ms`);
    console.log(`🔗 MCP Connected: ${result.mcpConnected}`);
    console.log(`📊 Classification: ${result.classification} (confidence: ${result.confidence})`);
    console.log(`🪙 Detected tokens: [${result.detectedTokens?.join(', ') || 'none'}]`);
    console.log(`📋 Detected contracts: [${result.detectedContracts?.join(', ') || 'none'}]`);
    console.log(`👤 Detected wallets: [${result.detectedWallets?.join(', ') || 'none'}]`);
    
    // Show token analysis results if any
    if (result.tokenData && result.tokenData.length > 0) {
      console.log('\n🎯 KAITO Token Analysis Results:');
      result.tokenData.forEach((token, index) => {
        console.log(`\n${index + 1}. Token: ${token.symbol}`);
        console.log(`   Status: ${token.success ? '✅ Success' : '❌ Failed'}`);
        if (token.success && token.metadata) {
          console.log(`   Name: ${token.metadata.name || 'Unknown'}`);
          console.log(`   Contract: ${token.contractAddress || 'Unknown'}`);
          console.log(`   Network: ${token.network || 'Unknown'}`);
          console.log(`   Confidence: ${token.confidence || 'Unknown'}`);
          if (token.metadata.totalSupply) {
            console.log(`   Total Supply: ${token.metadata.totalSupply}`);
          }
          if (token.metadata.decimals) {
            console.log(`   Decimals: ${token.metadata.decimals}`);
          }
        }
        if (token.error) {
          console.log(`   Error: ${token.error}`);
        }
      });
    }
    
    // Show analysis stats
    if (result.analysisStats) {
      console.log(`\n📈 Analysis Stats: ${result.analysisStats.successful}/${result.analysisStats.total} successful`);
    }
    
    console.log('\n📝 Full Response:');
    console.log('-'.repeat(50));
    
    // Try to parse and pretty print JSON response
    try {
      const parsedResponse = JSON.parse(result.output);
      console.log(JSON.stringify(parsedResponse, null, 2));
    } catch (parseError) {
      console.log(result.output);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testKaitoToken()
    .then(() => {
      console.log('\n🎉 KAITO test completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 KAITO test failed:', error);
      process.exit(1);
    });
}

module.exports = { testKaitoToken };
