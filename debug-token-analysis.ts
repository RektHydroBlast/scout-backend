import dotenv from 'dotenv';

dotenv.config();

// Quick debug script to understand Nodit API responses
console.log('🔧 Debugging Nodit API Response Structure');

// Simulate what we're getting from the MCP response for token search
const simulatedMcpResponse = {
  "rpp": 10,
  "count": 669,
  "cursor": "eyJjb250cmFjdEVudGl0eS5ibG9ja051bWJlciI6MjI2Mjk3OTIsInRva2VuQWRkcmVzcyI6IjB4NmExNjZjNWY3YWIyNTMwNmU5ZDdmMjBkMDM5Nzg2N2M1MjJmOTY2ZCJ9",
  "items": [
    {
      "address": "0xae4cda11De9d5D1d28c437F63c88E52c2A0D47dE",
      "deployedTransactionHash": "0x4fe69c79e1058d15ea6c60d8e5d9cf99c5cb485aab1b5778f7f88650cd2a7e22",
      "deployedAt": "2025-06-22T17:37:11.000Z",
      "deployerAddress": "0x5643D29E9f66C44875f12595633d1A705e798F05",
      "logoUrl": null,
      "type": "ERC20",
      "name": "Wrapped Ether",
      "symbol": "WETH",
      "totalSupply": "50998658367642976745960",
      "decimals": 18
    }
  ]
};

console.log('📊 Raw MCP response structure:');
console.log(JSON.stringify(simulatedMcpResponse, null, 2));

console.log('\n🔍 Processing logic:');
console.log('Items array:', simulatedMcpResponse.items);
console.log('Items length:', simulatedMcpResponse.items?.length);
console.log('First item:', simulatedMcpResponse.items?.[0]);

// Test our matching logic
const ticker = 'WETH';
const searchResult = simulatedMcpResponse;

if (!searchResult?.items || searchResult.items.length === 0) {
  console.log('❌ Would return error: Token not found');
} else {
  console.log(`✅ Found ${searchResult.items.length} potential matches for ${ticker}`);
    // Test scoring logic
  let bestMatch: any = null;
  let bestScore = 0;
  
  for (const item of searchResult.items) {
    let score = 0;
    
    // Exact symbol match gets highest priority
    if (item.symbol?.toLowerCase() === ticker.toLowerCase()) {
      score += 100;
      console.log(`  📊 ${item.symbol}: +100 for exact symbol match`);
    } else if (item.symbol?.toLowerCase().includes(ticker.toLowerCase())) {
      score += 50;
      console.log(`  📊 ${item.symbol}: +50 for partial symbol match`);
    }
    
    // Name match also helps
    if (item.name?.toLowerCase().includes(ticker.toLowerCase())) {
      score += 25;
      console.log(`  📊 ${item.symbol}: +25 for name match`);
    }
    
    // Prefer tokens with larger total supply (more established)
    if (item.totalSupply) {
      const supply = BigInt(item.totalSupply);
      if (supply > BigInt(0)) {
        const supplyScore = Math.min(Math.log10(Number(supply)), 25);
        score += supplyScore;
        console.log(`  📊 ${item.symbol}: +${supplyScore.toFixed(1)} for supply`);
      }
    }
    
    // Prefer tokens with deployment info (more reliable)
    if (item.deployedAt) {
      score += 10;
      console.log(`  📊 ${item.symbol}: +10 for deployment info`);
    }
    
    console.log(`  🎯 Total score for ${item.symbol}: ${score}`);
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }
  
  console.log(`\n🏆 Best match: ${bestMatch?.name} (${bestMatch?.symbol}) - Score: ${bestScore}`);
  
  // This would be our return object
  const result = {
    symbol: ticker,
    searchResult: bestMatch,
    metadata: bestMatch, // In reality this would be enriched
    contractAddress: bestMatch?.address,
    network: 'ethereum',
    success: true,
    analysisDepth: 'comprehensive',
    confidence: bestScore > 100 ? 'high' : bestScore > 50 ? 'medium' : 'low'
  };
  
  console.log('\n📋 Final result object:');
  console.log(JSON.stringify(result, null, 2));
  console.log('\n✅ Success flag:', result.success);
}

export {};
