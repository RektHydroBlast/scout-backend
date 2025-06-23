const testQuery = async (query, description) => {
  try {
    console.log(`\n=== ${description} ===`);
    console.log(`Query: ${query}`);
    
    const response = await fetch('http://localhost:3001/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Response Type:', typeof data.result);
      console.log('Response Preview:', data.result.substring(0, 200) + '...');
      
      // Try to parse as JSON
      try {
        const parsedResult = JSON.parse(data.result);
        console.log('✅ Valid JSON Response');
        console.log('Structure:', Object.keys(parsedResult));
        if (parsedResult.results) {
          console.log('Results contain:', Object.keys(parsedResult.results));
        }
      } catch (e) {
        console.log('❌ Not valid JSON - likely conversational text');
      }
    } else {
      console.log('❌ API Error:', data.error);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
};

// Test different query types
const runTests = async () => {
  console.log('🧪 Testing API Response Format...');
  
  await testQuery('DOGE price', 'Token Query');
  await testQuery('0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 'Contract Query');
  await testQuery('0x8ba1f109551bD432803012645Hac136c', 'Wallet Query');
  
  console.log('\n✅ Tests completed');
};

runTests();
