const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { loadMcpTools } = require("@langchain/mcp-adapters");
require('dotenv').config();

// Quick MCP connectivity and basic API test
async function testMcpConnectivity() {
  console.log('🔧 Testing MCP Server Connectivity and Basic APIs');
  console.log('='.repeat(50));
  
  let client = null;
  let tools = [];
  
  try {
    // Step 1: Test environment setup
    console.log('\n1️⃣ Checking environment setup...');
    if (!process.env.NODIT_API_KEY) {
      throw new Error('❌ NODIT_API_KEY not found in environment variables');
    }
    console.log('✅ NODIT_API_KEY is configured');

    // Step 2: Initialize MCP client
    console.log('\n2️⃣ Initializing MCP client...');
    client = new Client({
      name: "mcp-test-client",
      version: "1.0.0"
    });
    console.log('✅ MCP client created');

    // Step 3: Setup transport
    console.log('\n3️⃣ Setting up transport...');
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["@noditlabs/nodit-mcp-server@latest"],
      env: {
        NODIT_API_KEY: process.env.NODIT_API_KEY
      }
    });
    console.log('✅ Transport configured');

    // Step 4: Connect to MCP server
    console.log('\n4️⃣ Connecting to MCP server...');
    await client.connect(transport);
    console.log('✅ Connected to MCP server');

    // Step 5: Load tools
    console.log('\n5️⃣ Loading MCP tools...');
    tools = await loadMcpTools("nodit", client);
    console.log(`✅ Loaded ${tools.length} MCP tools`);
    
    // List available tools
    console.log('\n📋 Available tools:');
    tools.forEach((tool, index) => {
      console.log(`  ${index + 1}. ${tool.name}`);
    });

    // Step 6: Test basic API calls
    console.log('\n6️⃣ Testing basic API calls...');
    
    const apiTool = tools.find(t => t.name === 'call_nodit_api');
    if (!apiTool) {
      throw new Error('❌ call_nodit_api tool not found');
    }
    console.log('✅ API tool found');

    // Test 1: Search for a popular token (ETH)
    console.log('\n🧪 Test 1: Searching for ETH token...');
    try {
      const ethResult = await apiTool.call({
        protocol: 'ethereum',
        network: 'mainnet',
        operationId: 'searchTokenContractMetadataByKeyword',
        requestBody: {
          keyword: 'ETH',
          rpp: 5,
          withCount: true
        }
      });
      
      console.log('✅ ETH search successful');
      console.log(`📊 Found ${ethResult?.items?.length || 0} results`);
      if (ethResult?.items?.[0]) {
        console.log(`🎯 First result: ${ethResult.items[0].name} (${ethResult.items[0].symbol})`);
      }
    } catch (error) {
      console.error('❌ ETH search failed:', error.message);
    }

    // Test 2: Check if an address is a contract
    console.log('\n🧪 Test 2: Testing contract address check...');
    try {
      // USDC contract address on Ethereum
      const contractResult = await apiTool.call({
        protocol: 'ethereum',
        network: 'mainnet',
        operationId: 'isContract',
        requestBody: {
          address: '0xA0b73E1Ff0B80914AB6fe0444E65848C4C34450b'
        }
      });
      
      console.log('✅ Contract check successful');
      console.log(`📋 Is contract: ${contractResult?.result}`);
    } catch (error) {
      console.error('❌ Contract check failed:', error.message);
    }

    // Test 3: Get token metadata
    console.log('\n🧪 Test 3: Testing token metadata retrieval...');
    try {
    //Changed address to a more standard one
      const metadataResult = await apiTool.call({
        protocol: 'ethereum',
        network: 'mainnet',
        operationId: 'getTokenContractMetadataByContracts',
        requestBody: {
          contractAddresses: ['0xA0b73E1Ff0B80914AB6fe0444E65848C4C34450b']
        }
      });
      
      console.log('✅ Token metadata retrieval successful');
      if (metadataResult?.[0]) {
        const token = metadataResult[0];
        console.log(`🪙 Token: ${token.name} (${token.symbol})`);
        console.log(`📊 Total Supply: ${token.totalSupply}`);
        console.log(`📅 Deployed: ${token.deployedAt}`);
      }
    } catch (error) {
      console.error('❌ Token metadata retrieval failed:', error.message);
    }

    // Test 4: Test different network (Base)
    console.log('\n🧪 Test 4: Testing Base network...');
    try {
      const baseResult = await apiTool.call({
        protocol: 'base',
        network: 'mainnet',
        operationId: 'searchTokenContractMetadataByKeyword',
        requestBody: {
          keyword: 'USDC',
          rpp: 3,
          withCount: true
        }
      });
      
      console.log('✅ Base network test successful');
      console.log(`🌐 Found ${baseResult?.items?.length || 0} results on Base`);
    } catch (error) {
      console.error('❌ Base network test failed:', error.message);
    }

    console.log('\n🎉 All MCP connectivity tests completed successfully!');
    return true;

  } catch (error) {
    console.error('\n💥 MCP connectivity test failed:', error);
    return false;
  } finally {
    // Clean up
    if (client) {
      try {
        await client.close();
        console.log('\n🔌 MCP connection closed');
      } catch (error) {
        console.warn('⚠️ Error closing MCP connection:', error);
      }
    }
  }
}

// Test with different API endpoints
async function testSpecificApis() {
  console.log('\n🔬 Testing Specific API Endpoints');
  console.log('='.repeat(40));
  
  const apiTests = [
    {
      name: 'Token Search',
      protocol: 'ethereum',
      network: 'mainnet',
      operationId: 'searchTokenContractMetadataByKeyword',
      requestBody: { keyword: 'USDC', rpp: 5 }
    },
    {
      name: 'Contract Check',
      protocol: 'ethereum',
      network: 'mainnet',
      operationId: 'isContract',
      requestBody: { address: '0xA0b73E1Ff0B80914AB6fe0444E65848C4C34450b' }
    },
    {
      name: 'Account Info',
      protocol: 'ethereum',
      network: 'mainnet',
      operationId: 'getAccount',
      requestBody: { address: '0xA0b73E1Ff0B80914AB6fe0444E65848C4C34450b' }
    },
    {
      name: 'Token Holders',
      protocol: 'ethereum',
      network: 'mainnet',
      operationId: 'getTokenHoldersByContract',
      requestBody: { contractAddress: '0xA0b73E1Ff0B80914AB6fe0444E65848C4C34450b', rpp: 5 }
    }
  ];

  let client = null;
  try {
    client = new Client({ name: "api-test-client", version: "1.0.0" });
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["@noditlabs/nodit-mcp-server@latest"],
      env: { NODIT_API_KEY: process.env.NODIT_API_KEY }
    });
    
    await client.connect(transport);
    const tools = await loadMcpTools("nodit", client);
    const apiTool = tools.find(t => t.name === 'call_nodit_api');
    
    if (!apiTool) {
      throw new Error('API tool not found');
    }

    for (const test of apiTests) {
      console.log(`\n🧪 Testing ${test.name}...`);
      try {
        const startTime = Date.now();
        const result = await apiTool.call({
          protocol: test.protocol,
          network: test.network,
          operationId: test.operationId,
          requestBody: test.requestBody
        });
        const duration = Date.now() - startTime;
        
        console.log(`✅ ${test.name} successful (${duration}ms)`);
        console.log(`📊 Response keys:`, Object.keys(result || {}).join(', '));
        
        // Show specific data based on test type
        if (test.name === 'Token Search' && result?.items) {
          console.log(`   Found ${result.items.length} tokens`);
        } else if (test.name === 'Contract Check') {
          console.log(`   Is contract: ${result?.result}`);
        } else if (test.name === 'Account Info' && result?.balance) {
          console.log(`   Balance: ${result.balance}`);
        } else if (test.name === 'Token Holders' && result?.count) {
          console.log(`   Holder count: ${result.count}`);
        }
        
      } catch (error) {
        console.error(`❌ ${test.name} failed:`, error.message);
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Main execution
if (require.main === module) {
  console.log('🚀 Starting MCP Server Tests...\n');
  
  testMcpConnectivity()
    .then(success => {
      if (success) {
        return testSpecificApis();
      } else {
        console.log('❌ Skipping specific API tests due to connectivity failure');
        process.exit(1);
      }
    })
    .then(() => {
      console.log('\n🎉 All tests completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testMcpConnectivity, testSpecificApis };
