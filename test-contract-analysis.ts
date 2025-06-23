import { scoutGraph } from './src/ai/multi-node-graph';
import { HumanMessage } from '@langchain/core/messages';

async function testContractAnalysis() {
  console.log('🧪 Testing Enhanced Contract Analysis System\n');

  const testCases = [
    {
      name: 'Direct Contract Address Query',
      input: 'What is this contract 0xdAC17F958D2ee523a2206206994597C13D831ec7?',
      expectedContracts: ['0xdAC17F958D2ee523a2206206994597C13D831ec7']
    },
    {
      name: 'Multiple Contract Addresses',
      input: 'Compare these contracts: 0xdAC17F958D2ee523a2206206994597C13D831ec7 and 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      expectedContracts: [
        '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
      ]
    },
    {
      name: 'Contract with Network Context',
      input: 'Analyze this Ethereum contract 0xdAC17F958D2ee523a2206206994597C13D831ec7',
      expectedContracts: ['0xdAC17F958D2ee523a2206206994597C13D831ec7'],
      expectedNetwork: 'ethereum'
    },
    {
      name: 'Token Name + Contract Address',
      input: 'Tell me about USDT token at 0xdAC17F958D2ee523a2206206994597C13D831ec7',
      expectedTokens: ['USDT'],
      expectedContracts: ['0xdAC17F958D2ee523a2206206994597C13D831ec7']
    },
    {
      name: 'Polygon Network Contract',
      input: 'What is this Polygon contract 0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619?',
      expectedContracts: ['0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'],
      expectedNetwork: 'polygon'
    },
    {
      name: 'Random Contract Address Analysis',
      input: 'Analyze this contract: 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      expectedContracts: ['0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984']
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🔍 Test: ${testCase.name}`);
    console.log(`Input: "${testCase.input}"`);
    console.log('---');

    try {
      const startTime = Date.now();
      const result = await scoutGraph.invoke({
        input: testCase.input,
        messages: [new HumanMessage(testCase.input)],
      });
      const duration = Date.now() - startTime;

      console.log('✅ Result:');
      console.log(`Classification: ${result.classification} (confidence: ${result.confidence})`);
      console.log(`Detected Tokens: [${result.detectedTokens.join(', ')}]`);
      console.log(`Detected Contracts: [${result.detectedContracts.join(', ')}]`);
      console.log(`MCP Connected: ${result.mcpConnected}`);
      
      if (result.contractData && result.contractData.length > 0) {
        console.log('\n📋 Contract Analysis Results:');
        result.contractData.forEach((contract: any, index: number) => {
          console.log(`  Contract ${index + 1}:`);
          console.log(`    • Address: ${contract.address}`);
          console.log(`    • Network: ${contract.network}`);
          
          if (contract.isContractCheck) {
            console.log(`    • Is Contract: ${JSON.stringify(contract.isContractCheck)}`);
          }
          
          if (contract.tokenMetadata) {
            console.log(`    • Token Metadata: Available`);
            console.log(`      ${JSON.stringify(contract.tokenMetadata, null, 6)}`);
          }
          
          if (contract.tokenHolders) {
            console.log(`    • Token Holders: Available`);
          }
          
          if (contract.error) {
            console.log(`    • Error: ${contract.error}`);
          }
          
          if (contract.fallback) {
            console.log(`    • Note: Fallback data used`);
          }
        });
      }
      
      console.log(`\n📝 Response:\n${result.output}`);
      console.log(`⏱️ Processing time: ${duration}ms`);

      // Validation
      if (testCase.expectedContracts) {
        const detectedCount = result.detectedContracts.length;
        const expectedCount = testCase.expectedContracts.length;
        if (detectedCount === expectedCount) {
          console.log(`✅ Contract detection: ${detectedCount}/${expectedCount} contracts found`);
        } else {
          console.log(`⚠️ Contract detection: ${detectedCount}/${expectedCount} contracts found`);
        }
      }

      if (testCase.expectedTokens) {
        const detectedCount = result.detectedTokens.length;
        const expectedCount = testCase.expectedTokens.length;
        if (detectedCount === expectedCount) {
          console.log(`✅ Token detection: ${detectedCount}/${expectedCount} tokens found`);
        } else {
          console.log(`⚠️ Token detection: ${detectedCount}/${expectedCount} tokens found`);
        }
      }

    } catch (error) {
      console.error('❌ Test failed:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        console.error('Stack trace:', error.stack);
      }
    }

    console.log('\n' + '='.repeat(80));
  }

  console.log('\n🎉 Contract Analysis Testing Complete!');
}

// Run the test
if (require.main === module) {
  testContractAnalysis().catch(console.error);
}

export { testContractAnalysis };
