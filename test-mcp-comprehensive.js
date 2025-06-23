const { scoutGraph } = require('./dist/ai/multi-node-graph.js');

// Test cases covering all MCP functionality
const testCases = [
  {
    name: "Token Analysis - Popular Token (ETH)",
    input: "What is ETH token information?",
    expectedTypes: ["token"],
    description: "Tests basic token ticker detection and analysis"
  },
  {
    name: "Token Analysis - Multiple Tokens",
    input: "Compare BTC and USDC tokens",
    expectedTypes: ["token"],
    description: "Tests multiple token analysis"
  },
  {
    name: "Contract Analysis - Known Token Contract",
    input: "Analyze contract 0xA0b86a33E6441F8C966B1f8B5C9aA5B5c8e3b8A8",
    expectedTypes: ["contract"],
    description: "Tests contract address detection and analysis"
  },
  {
    name: "Wallet Analysis - EOA Address",
    input: "Check wallet 0x8ba1f109551bD432803012645Hac136c5ae4F9c4",
    expectedTypes: ["wallet"],
    description: "Tests wallet address analysis"
  },
  {
    name: "Mixed Analysis - Token + Contract + Wallet",
    input: "Analyze ETH token, contract 0xA0b86a33E6441F8C966B1f8B5C9aA5B5c8e3b8A8, and wallet 0x8ba1f109551bD432803012645Hac136c5ae4F9c4",
    expectedTypes: ["token", "contract", "wallet"],
    description: "Tests comprehensive mixed entity analysis"
  },
  {
    name: "Network-Specific Analysis - Base",
    input: "What are the top tokens on Base network?",
    expectedTypes: ["token"],
    description: "Tests network detection and network-specific queries"
  },
  {
    name: "Network-Specific Analysis - Polygon",
    input: "Analyze MATIC token on Polygon network",
    expectedTypes: ["token"],
    description: "Tests Polygon network analysis"
  },
  {
    name: "Non-Web3 Query",
    input: "What's the weather like today?",
    expectedTypes: [],
    description: "Tests non-Web3 query handling"
  },
  {
    name: "Token Not Found",
    input: "Tell me about NONEXISTENTTOKEN123",
    expectedTypes: ["token"],
    description: "Tests handling of non-existent tokens"
  },
  {
    name: "Invalid Address Format",
    input: "Analyze address 0xinvalidaddress",
    expectedTypes: [],
    description: "Tests handling of invalid address formats"
  }
];

// Enhanced test runner with detailed analysis
async function runComprehensiveTest() {
  console.log('🧪 Starting Comprehensive MCP Server Test Suite');
  console.log('='.repeat(60));
  
  const results = {
    total: testCases.length,
    passed: 0,
    failed: 0,
    details: []
  };

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📋 Test ${i + 1}/${testCases.length}: ${testCase.name}`);
    console.log(`📝 Description: ${testCase.description}`);
    console.log(`🔍 Input: "${testCase.input}"`);
    console.log(`⚡ Expected types: [${testCase.expectedTypes.join(', ')}]`);
    console.log('-'.repeat(40));

    try {
      const startTime = Date.now();
      
      // Run the analysis
      const result = await scoutGraph.invoke({
        input: testCase.input,
        messages: []
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`⏱️  Execution time: ${duration}ms`);
      console.log(`🔗 MCP Connected: ${result.mcpConnected}`);
      console.log(`📊 Classification: ${result.classification} (confidence: ${result.confidence})`);
      
      // Parse and analyze the response
      let responseData = {};
      try {
        responseData = JSON.parse(result.output);
      } catch (parseError) {
        console.log(`⚠️  Response is not JSON, treating as plain text`);
        responseData = { raw_response: result.output };
      }

      // Detailed analysis of the response
      const testResult = analyzeTestResult(testCase, result, responseData, duration);
      results.details.push(testResult);
      
      if (testResult.passed) {
        results.passed++;
        console.log(`✅ TEST PASSED`);
      } else {
        results.failed++;
        console.log(`❌ TEST FAILED`);
        console.log(`💥 Failure reasons: ${testResult.failures.join(', ')}`);
      }

      // Log detailed response data
      logDetailedResponse(testCase, result, responseData);
      
    } catch (error) {
      console.error(`💥 Test execution failed:`, error);
      results.failed++;
      results.details.push({
        testName: testCase.name,
        passed: false,
        failures: [`Execution error: ${error.message}`],
        duration: 0,
        mcpConnected: false
      });
    }

    // Add delay between tests to avoid overwhelming the MCP server
    if (i < testCases.length - 1) {
      console.log(`⏳ Waiting 2 seconds before next test...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Final results summary
  console.log('\n' + '='.repeat(60));
  console.log('🏁 COMPREHENSIVE TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`📊 Total Tests: ${results.total}`);
  console.log(`✅ Passed: ${results.passed} (${Math.round(results.passed/results.total*100)}%)`);
  console.log(`❌ Failed: ${results.failed} (${Math.round(results.failed/results.total*100)}%)`);

  // Detailed failure analysis
  if (results.failed > 0) {
    console.log('\n🔍 FAILURE ANALYSIS:');
    results.details.filter(r => !r.passed).forEach((result, index) => {
      console.log(`${index + 1}. ${result.testName}`);
      console.log(`   Failures: ${result.failures.join(', ')}`);
      console.log(`   MCP Connected: ${result.mcpConnected}`);
    });
  }

  // Performance analysis
  const avgDuration = results.details.reduce((sum, r) => sum + r.duration, 0) / results.details.length;
  console.log(`\n⏱️  PERFORMANCE ANALYSIS:`);
  console.log(`📈 Average response time: ${Math.round(avgDuration)}ms`);
  console.log(`🚀 Fastest response: ${Math.min(...results.details.map(r => r.duration))}ms`);
  console.log(`🐌 Slowest response: ${Math.max(...results.details.map(r => r.duration))}ms`);

  // MCP connection analysis
  const mcpConnectedCount = results.details.filter(r => r.mcpConnected).length;
  console.log(`\n🔗 MCP CONNECTION ANALYSIS:`);
  console.log(`📡 Connected: ${mcpConnectedCount}/${results.total} tests (${Math.round(mcpConnectedCount/results.total*100)}%)`);

  return results;
}

// Enhanced test result analysis
function analyzeTestResult(testCase, result, responseData, duration) {
  const testResult = {
    testName: testCase.name,
    passed: true,
    failures: [],
    duration: duration,
    mcpConnected: result.mcpConnected,
    details: {}
  };

  // Check if MCP connection was established (critical for most tests)
  if (testCase.expectedTypes.length > 0 && !result.mcpConnected) {
    testResult.failures.push('MCP server not connected');
  }

  // Check classification accuracy
  if (testCase.expectedTypes.length > 0) {
    if (result.classification !== 'web3') {
      testResult.failures.push(`Expected web3 classification, got: ${result.classification}`);
    }
  } else {
    if (result.classification === 'web3') {
      testResult.failures.push(`Expected non-web3 classification, got: ${result.classification}`);
    }
  }

  // Check if expected entity types were detected and analyzed
  if (testCase.expectedTypes.includes('token')) {
    if (!result.detectedTokens || result.detectedTokens.length === 0) {
      testResult.failures.push('No tokens detected');
    } else if (!result.tokenData || result.tokenData.length === 0) {
      testResult.failures.push('Tokens detected but no token data returned');
    } else {
      // Check if token analysis was successful
      const successfulTokens = result.tokenData.filter(t => t.success).length;
      if (successfulTokens === 0) {
        testResult.failures.push('All token analyses failed');
      }
      testResult.details.tokenAnalysis = {
        detected: result.detectedTokens.length,
        analyzed: result.tokenData.length,
        successful: successfulTokens
      };
    }
  }

  if (testCase.expectedTypes.includes('contract')) {
    if (!result.detectedContracts || result.detectedContracts.length === 0) {
      testResult.failures.push('No contracts detected');
    } else if (!result.contractData || result.contractData.length === 0) {
      testResult.failures.push('Contracts detected but no contract data returned');
    } else {
      const successfulContracts = result.contractData.filter(c => !c.error).length;
      testResult.details.contractAnalysis = {
        detected: result.detectedContracts.length,
        analyzed: result.contractData.length,
        successful: successfulContracts
      };
    }
  }

  if (testCase.expectedTypes.includes('wallet')) {
    if (!result.detectedWallets || result.detectedWallets.length === 0) {
      testResult.failures.push('No wallets detected');
    } else if (!result.walletData || result.walletData.length === 0) {
      testResult.failures.push('Wallets detected but no wallet data returned');
    } else {
      const successfulWallets = result.walletData.filter(w => !w.error).length;
      testResult.details.walletAnalysis = {
        detected: result.detectedWallets.length,
        analyzed: result.walletData.length,
        successful: successfulWallets
      };
    }
  }

  // Check response format and content quality
  if (result.output) {
    try {
      const parsedOutput = JSON.parse(result.output);
      if (!parsedOutput.query || !parsedOutput.status) {
        testResult.failures.push('Response missing required fields (query, status)');
      }
      testResult.details.responseFormat = 'JSON';
    } catch (error) {
      if (result.output.includes('Error:')) {
        testResult.details.responseFormat = 'Error message';
      } else {
        testResult.details.responseFormat = 'Plain text';
      }
    }
  } else {
    testResult.failures.push('No output generated');
  }

  // Check performance
  if (duration > 30000) { // 30 seconds
    testResult.failures.push(`Response time too slow: ${duration}ms`);
  }

  testResult.passed = testResult.failures.length === 0;
  return testResult;
}

// Detailed response logging
function logDetailedResponse(testCase, result, responseData) {
  console.log(`\n📄 DETAILED RESPONSE ANALYSIS:`);
  
  // Detection results
  if (result.detectedTokens && result.detectedTokens.length > 0) {
    console.log(`🪙 Detected tokens: [${result.detectedTokens.join(', ')}]`);
  }
  if (result.detectedContracts && result.detectedContracts.length > 0) {
    console.log(`📋 Detected contracts: [${result.detectedContracts.join(', ')}]`);
  }
  if (result.detectedWallets && result.detectedWallets.length > 0) {
    console.log(`👤 Detected wallets: [${result.detectedWallets.join(', ')}]`);
  }

  // Analysis results
  if (result.tokenData && result.tokenData.length > 0) {
    console.log(`📊 Token analysis results:`);
    result.tokenData.forEach((token, index) => {
      console.log(`  ${index + 1}. ${token.symbol}: ${token.success ? '✅ Success' : '❌ ' + (token.error || 'Failed')}`);
      if (token.success && token.metadata) {
        console.log(`     Name: ${token.metadata.name || 'Unknown'}`);
        console.log(`     Contract: ${token.contractAddress || 'Unknown'}`);
      }
    });
  }

  if (result.contractData && result.contractData.length > 0) {
    console.log(`🏗️  Contract analysis results:`);
    result.contractData.forEach((contract, index) => {
      console.log(`  ${index + 1}. ${contract.address}: ${contract.error ? '❌ ' + contract.error : '✅ Success'}`);
      if (contract.contractType) {
        console.log(`     Type: ${contract.contractType}`);
      }
    });
  }

  if (result.walletData && result.walletData.length > 0) {
    console.log(`💰 Wallet analysis results:`);
    result.walletData.forEach((wallet, index) => {
      console.log(`  ${index + 1}. ${wallet.address}: ${wallet.error ? '❌ ' + wallet.error : '✅ Success'}`);
      if (wallet.nativeBalance) {
        console.log(`     Balance: ${wallet.nativeBalance.formatted} ${wallet.nativeBalance.symbol}`);
      }
    });
  }

  // Analysis statistics
  if (result.analysisStats) {
    console.log(`📈 Analysis stats: ${result.analysisStats.successful}/${result.analysisStats.total} successful`);
  }

  // Response preview
  console.log(`\n📝 Response preview (first 300 chars):`);
  console.log(result.output.substring(0, 300) + (result.output.length > 300 ? '...' : ''));
}

// Run the comprehensive test
if (require.main === module) {
  console.log('🚀 Starting MCP Server Comprehensive Test Suite...\n');
  
  runComprehensiveTest()
    .then(results => {
      console.log('\n🎉 Test suite completed!');
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 Test suite failed to run:', error);
      process.exit(1);
    });
}

module.exports = { runComprehensiveTest, testCases };
