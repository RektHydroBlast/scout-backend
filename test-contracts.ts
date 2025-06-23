import { scoutGraph } from './src/ai/multi-node-graph';
import { HumanMessage } from '@langchain/core/messages';

async function testContractAddresses() {
  console.log('🧪 Testing Updated Token Database with Contract Addresses\n');

  const testCases = [
    {
      name: 'USDT Token Query (With Contract)',
      input: 'Tell me about USDT token',
      expectedTokens: ['USDT']
    },
    {
      name: 'WETH Token Query (With Contract)',
      input: 'What is WETH and how does it work?',
      expectedTokens: ['WETH']
    },
    {
      name: 'Multiple Tokens Query',
      input: 'Compare USDT and WETH tokens',
      expectedTokens: ['USDT', 'WETH']
    },
    {
      name: 'Unknown Token Query',
      input: 'Tell me about SHIB token',
      expectedTokens: []
    },
    {
      name: 'Wrapped Ethereum Alias',
      input: 'What is wrapped ethereum?',
      expectedTokens: ['WETH']
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🔍 Test: ${testCase.name}`);
    console.log(`Input: "${testCase.input}"`);
    console.log(`Expected Tokens: [${testCase.expectedTokens.join(', ')}]`);
    console.log('---');

    try {
      const result = await scoutGraph.invoke({
        input: testCase.input,
        messages: [new HumanMessage(testCase.input)],
      });

      console.log('✅ Result:');
      console.log(`Classification: ${result.classification} (confidence: ${result.confidence})`);
      console.log(`Detected Tokens: [${result.detectedTokens.join(', ')}]`);
      console.log(`MCP Connected: ${result.mcpConnected || false}`);
      
      // Show contract addresses if tokens were found
      if (result.tokenData && result.tokenData.length > 0) {
        console.log('📄 Contract Information:');
        result.tokenData.forEach(token => {
          if (token.contractAddress) {
            console.log(`  • ${token.symbol}: ${token.contractAddress} (${token.network})`);
          } else {
            console.log(`  • ${token.symbol}: No contract address (native token)`);
          }
        });
      }
      
      console.log(`Response: ${result.output.substring(0, 200)}...`);
      
    } catch (error) {
      console.error('❌ Error:', error);
    }
    
    console.log('\n' + '='.repeat(80));
  }
}

// Run the test
if (require.main === module) {
  testContractAddresses().catch(console.error);
}

export { testContractAddresses };
