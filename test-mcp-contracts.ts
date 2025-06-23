import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadMcpTools } from "@langchain/mcp-adapters";
import dotenv from 'dotenv';

dotenv.config();

async function testMcpServerWithContracts() {
  console.log('🧪 Testing MCP Server with Contract Addresses\n');

  const contractAddresses = [
    {
      name: 'USDT',
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      network: 'ethereum'
    },
    {
      name: 'WETH',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      network: 'ethereum'
    }
  ];

  try {
    // Check if API key is available
    if (!process.env.NODIT_API_KEY) {
      console.log('❌ NODIT_API_KEY not found in environment variables');
      console.log('Please add your Nodit API key to .env file:');
      console.log('NODIT_API_KEY=your_actual_api_key_here');
      return;
    }

    console.log('🔑 API Key found, connecting to Nodit MCP server...');

    // Initialize MCP client
    const client = new Client({
      name: "scout-mcp-test",
      version: "1.0.0"
    });

    const transport = new StdioClientTransport({
      command: "npx",
      args: ["@noditlabs/nodit-mcp-server@latest"],
      env: {
        NODIT_API_KEY: process.env.NODIT_API_KEY
      }
    });

    console.log('📡 Connecting to MCP server...');
    await client.connect(transport);
    console.log('✅ Connected to Nodit MCP server!');

    // Load available tools
    console.log('\n🛠️ Loading available MCP tools...');
    const tools = await loadMcpTools("nodit", client);
    console.log(`Found ${tools.length} available tools:`);
    tools.forEach((tool, index) => {
      console.log(`  ${index + 1}. ${tool.name} - ${tool.description}`);
    });    // List API categories
    console.log('\n📋 Listing API categories...');
    try {
      const listCategoriesResult = await client.callTool({
        name: "list_nodit_api_categories",
        arguments: {}
      });
      console.log('API Categories result:', JSON.stringify(listCategoriesResult, null, 2));
    } catch (error) {
      console.log('❌ Error listing categories:', error);
    }

    // List available Node APIs
    console.log('\n🔗 Listing Node APIs...');
    try {
      const listNodeApisResult = await client.callTool({
        name: "list_nodit_node_apis",
        arguments: {}
      });
      console.log('Node APIs result:', JSON.stringify(listNodeApisResult, null, 2));
    } catch (error) {
      console.log('❌ Error listing node APIs:', error);
    }

    // List Data APIs
    console.log('\n📊 Listing Data APIs...');
    try {
      const listDataApisResult = await client.callTool({
        name: "list_nodit_data_apis",
        arguments: {}
      });
      console.log('Data APIs result:', JSON.stringify(listDataApisResult, null, 2));
    } catch (error) {
      console.log('❌ Error listing data APIs:', error);
    }

    // Try to get token information for each contract
    for (const token of contractAddresses) {
      console.log(`\n🪙 Testing token: ${token.name} (${token.address})`);
      
      try {
        // Try to get token balance or info - this is an example call
        // You'll need to check the actual Nodit API documentation for the correct method
        const tokenInfoResult = await client.callTool({
          name: "call_nodit_api",
          arguments: {
            protocol: "ethereum",
            network: "mainnet",
            operationId: "eth_getBalance", // This might need to be adjusted based on actual API
            requestBody: {
              address: token.address,
              tag: "latest"
            }
          }
        });
        console.log(`Token info for ${token.name}:`, JSON.stringify(tokenInfoResult, null, 2));
      } catch (error) {
        console.log(`❌ Error getting info for ${token.name}:`, error);
      }
    }

    await client.close();
    console.log('\n✅ MCP test completed successfully!');

  } catch (error) {
    console.error('❌ MCP test failed:', error);
    console.log('\nTroubleshooting tips:');
    console.log('1. Make sure you have a valid NODIT_API_KEY in your .env file');
    console.log('2. Check your internet connection');
    console.log('3. Verify that the Nodit MCP server is accessible');
    console.log('4. Make sure npm/npx is properly installed');
  }
}

// Run the test
if (require.main === module) {
  testMcpServerWithContracts().catch(console.error);
}

export { testMcpServerWithContracts };
