import { scoutGraph } from './src/ai/multi-node-graph';

// Quick test to debug token analysis results
async function debugTokenAnalysis() {
  console.log('🔍 Debug: Token Analysis Issue');
  
  const testInput = "need some WETH for gas";
  
  console.log(`Input: "${testInput}"`);
  
  try {
    const result = await scoutGraph.invoke({
      input: testInput,
      messages: [],
    });
    
    console.log('\n📊 Final Result:');
    console.log('Token Data:', JSON.stringify(result.tokenData, null, 2));
    console.log('Analysis Stats:', JSON.stringify(result.analysisStats, null, 2));
    
    if (result.tokenData) {
      console.log('\n🔍 Token Data Analysis:');
      result.tokenData.forEach((token: any, index: number) => {
        console.log(`Token ${index + 1}:`, {
          symbol: token.symbol,
          success: token.success,
          error: token.error,
          hasMetadata: !!token.metadata,
          hasSearchResult: !!token.searchResult
        });
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugTokenAnalysis().catch(console.error);
