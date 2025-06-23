import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGroq } from '@langchain/groq';
import dotenv from 'dotenv';

dotenv.config();

// Define the state using Annotation
const GraphState = Annotation.Root({
  input: Annotation<string>,
  output: Annotation<string>,
  extensionData: Annotation<any>({
    reducer: (x, y) => y ?? x,
    default: () => null
  }),
  processed: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false
  })
});

// Initialize LLM (you can switch between OpenAI and Groq)
const getLLM = () => {
  if (process.env.GROQ_API_KEY) {
    return new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: 'llama3-70b-8192',
      temperature: 0.7,
    });
  } else if (process.env.OPENAI_API_KEY) {
    return new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
    });
  } else {
    throw new Error('No API key found. Please set GROQ_API_KEY or OPENAI_API_KEY in your .env file');
  }
};

// Processing node
const processInputNode = async (state: typeof GraphState.State): Promise<Partial<typeof GraphState.State>> => {
  try {
    const llm = getLLM();
    
    console.log('Processing input:', state.input);
      // Create a comprehensive prompt for the AI
    const prompt = `
You are an AI assistant for a Web3 Lens application that analyzes blockchain data and provides intelligent insights.

**Context:**
- You're helping users understand and interact with Web3/blockchain technology
- You can analyze transaction data, smart contracts, DeFi protocols, and social graphs
- You provide actionable insights and recommendations

**User Query:** "${state.input}"

${state.extensionData ? `
**Extension Data:** 
${JSON.stringify(state.extensionData, null, 2)}

Analyze this data and provide relevant insights based on the user's query.` : ''}

**Instructions:**
- Be concise but informative
- If analyzing blockchain data, explain key metrics and patterns
- For Lens Protocol queries, focus on social graph analysis
- For DeFi data, highlight risks, opportunities, and trends
- Always provide actionable next steps when relevant
- Use clear, non-technical language unless specifically asked for technical details

**Response:**
    `;

    const response = await llm.invoke(prompt);
    
    return {
      output: response.content as string,
      processed: true
    };
  } catch (error) {
    console.error('Error in processInputNode:', error);
    return {
      output: 'Sorry, I encountered an error processing your request. Please try again.',
      processed: true
    };
  }
};

// Create and export the graph
export function createSimpleGraph() {
  // Create the graph with the Annotation state
  const workflow = new StateGraph(GraphState)
    .addNode('process_input', processInputNode)
    .addEdge(START, 'process_input')
    .addEdge('process_input', END);

  // Compile and return the graph
  return workflow.compile();
}

export default createSimpleGraph;
