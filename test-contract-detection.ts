import { scoutGraph } from './src/ai/multi-node-graph';
import { HumanMessage } from '@langchain/core/messages';

async function testTokenContractDetection() {
  console.log('🧪 Testing Token Contract Detection\n');

  const testCases = [
    {
      name: 'USDT Query with Contract',
      input: 'What is USDT and how does it work on Ethereum?',
      expectedToken: 'USDT',
      expectedContract: '0xdAC17F958D2ee523a2206206994597C13D831ec7'
    },
    {
      name: 'WETH Query with Contract',
      input: 'Tell me about WETH token',
      expectedToken: 'WETH', 
      expectedContract: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
    },
    {
      name: 'Multiple Tokens',
      input: 'Compare USDT and WETH tokens',
      expectedTokens: ['USDT', 'WETH'],
      expectedContracts: [
        '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
      ]
    },
    {
      name: 'Contract Address Direct Query',
      input: 'What token is at address 0xdAC17F958D2ee523a2206206994597C13D831ec7?',
      expectedToken: 'USDT',
      expectedContract: '0xdAC17F958D2ee523a2206206994597C13D831ec7'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🔍 Test: ${testCase.name}`);
    console.log(`Input: "${testCase.input}"`);
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
      
      // Show contract information if available
      if (result.tokenData && result.tokenData.length > 0) {
        console.log('\n📄 Token Contract Details:');
        result.tokenData.forEach((token, index) => {
          console.log(`  ${index + 1}. ${token.name} (${token.symbol})`);
          if (token.contractAddress) {
            console.log(`     Contract: ${token.contractAddress}`);
            console.log(`     Network: ${token.network}`);
          }
          if (token.mcpData) {
            console.log(`     Data Source: ${token.mcpData.source} (${token.mcpData.status})`);
            if (token.mcpData.note) {
              console.log(`     Note: ${token.mcpData.note}`);
            }
          }
        });
      }
      
      console.log(`\n💬 Response: ${result.output.substring(0, 200)}...`);
      
    } catch (error) {
      console.error('❌ Error:', error);
    }
    
    console.log('\n' + '='.repeat(80));
  }
}

// Show current environment status
console.log('🔧 Environment Status:');
console.log(`GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✅ Set' : '❌ Not set'}`);
console.log(`NODIT_API_KEY: ${process.env.NODIT_API_KEY ? '✅ Set' : '❌ Not set'}`);
console.log('');

// Run the test
if (require.main === module) {
  testTokenContractDetection().catch(console.error);
}

export { testTokenContractDetection };
