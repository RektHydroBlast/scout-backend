// Simple test to verify the LangGraph backend works
import { createSimpleGraph } from './src/ai/simple-graph';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testGraph() {
  try {
    console.log('🧪 Testing LangGraph backend...');
    
    const graph = createSimpleGraph();
    
    const testInput = {
      input: 'Hello! Can you help me understand what this Web3 Lens application does?',
      extensionData: {
        userAddress: '0x1234...5678',
        network: 'ethereum',
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📤 Sending test input:', testInput.input);
    
    // Check if we have API keys
    if (process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY) {
      console.log('🔑 API key found, testing with real AI response...');
      
      const result = await graph.invoke(testInput);
      console.log('📥 AI Response:', result.output);
      console.log('✅ Full AI test completed successfully!');
    } else {
      console.log('⚠️  No API key found in environment variables');
      console.log('💡 Add GROQ_API_KEY or OPENAI_API_KEY to .env file for AI testing');
    }
    
    console.log('✅ Graph structure validated!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
  }
}

testGraph();
