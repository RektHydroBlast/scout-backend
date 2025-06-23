import { scoutGraph } from './src/ai/multi-node-graph';
import { HumanMessage } from '@langchain/core/messages';

async function testMultiNodeGraph() {
  console.log('🧪 Testing Multi-Node Scout Graph\n');  const testCases = [
    {
      name: 'Web3 Token Query',
      input: 'What is Bitcoin and how does it work?',
      expectedPath: 'classifyInput -> detectTokens -> fetchMcpData -> generateWeb3Response'
    },
    {
      name: 'Specific Token Query',
      input: 'Tell me about ETH and MATIC tokens',
      expectedPath: 'classifyInput -> detectTokens -> fetchMcpData -> generateWeb3Response'
    },
    {
      name: 'General Web3 Query',
      input: 'Explain DeFi and blockchain technology',
      expectedPath: 'classifyInput -> detectTokens -> generateTokenNotFoundResponse'
    },
    {
      name: 'Non-Web3 Query',
      input: 'What is the weather like today?',
      expectedPath: 'classifyInput -> generateNonWeb3Response'
    },
    {
      name: 'Token Symbol Query',
      input: 'How much is USDC worth?',
      expectedPath: 'classifyInput -> detectTokens -> fetchMcpData -> generateWeb3Response'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🔍 Test: ${testCase.name}`);
    console.log(`Input: "${testCase.input}"`);
    console.log(`Expected Path: ${testCase.expectedPath}`);
    console.log('---');

    try {
      const result = await scoutGraph.invoke({
        input: testCase.input,
        messages: [new HumanMessage(testCase.input)],
      });      console.log('✅ Result:');
      console.log(`Classification: ${result.classification} (confidence: ${result.confidence})`);
      console.log(`Detected Tokens: [${result.detectedTokens.join(', ')}]`);
      console.log(`MCP Connected: ${result.mcpConnected || false}`);
      console.log(`Response: ${result.output}`);
      
    } catch (error) {
      console.error('❌ Error:', error);
    }
    
    console.log('\n' + '='.repeat(80));
  }
}

// Run the test
if (require.main === module) {
  testMultiNodeGraph().catch(console.error);
}

export { testMultiNodeGraph };
