import express, { Request, Response, Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { scoutGraph } from './ai/multi-node-graph';
import { HumanMessage } from '@langchain/core/messages';

// Load environment variables
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'LangGraph Backend Server is running' });
});

// Main LangGraph endpoint
app.post('/api/process', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, data } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }    // Create graph instance - use the multi-node scout graph
    const graph = scoutGraph;

    // Process the message through the graph
    const result = await graph.invoke({
      input: message,
      messages: [new HumanMessage(message)],
    });

    res.json({
      success: true,
      result: result.output,
      metadata: {
        timestamp: new Date().toISOString(),
        processedBy: 'LangGraph'
      }
    });

  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Streaming endpoint for real-time responses
app.post('/api/stream', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, data } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };    try {
      const graph = scoutGraph;
      
      // Stream the graph execution
      const stream = await graph.stream({
        input: message,
        messages: [new HumanMessage(message)],
      });

      for await (const chunk of stream) {
        sendEvent({
          type: 'chunk',
          data: chunk
        });
      }

      sendEvent({ type: 'end' });
    } catch (error) {
      sendEvent({ 
        type: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    res.end();
  } catch (error) {
    console.error('Streaming error:', error);
    res.status(500).json({ error: 'Streaming failed' });
  }
});

// Start serveryy
app.listen(port, () => {
  console.log(`🚀 LangGraph Backend Server running on port ${port}`);
  console.log(`📡 Health check: http://localhost:${port}/health`);
  console.log(`🤖 API endpoint: http://localhost:${port}/api/process`);
  console.log(`📊 Stream endpoint: http://localhost:${port}/api/stream`);
});

export default app;
