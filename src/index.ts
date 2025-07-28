import express, { Request, Response, Express } from 'express';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app: Express = express();

// Configuration from environment variables
const HOST: string = process.env.HOST || 'localhost';
const PORT: number = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const NODE_ENV: string = process.env.NODE_ENV || 'development';

/**
 * Extracts the client's IP address from the request object
 * @param req - Express request object
 * @returns The client's IP address as a string
 */
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'] as string;
  const realIP = req.headers['x-real-ip'] as string;
  const remoteAddress = req.connection?.remoteAddress || req.socket?.remoteAddress;
  
  // Handle X-Forwarded-For header (may contain multiple IPs)
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  // Handle X-Real-IP header
  if (realIP) {
    return realIP;
  }
  
  // Fall back to connection remote address
  return remoteAddress || 'Unknown';
}

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response): void => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'get-ip-api',
    environment: NODE_ENV,
    host: HOST,
    port: PORT
  });
});

/**
 * Main endpoint to get client's IP address
 */
app.get('/', (req: Request, res: Response): void => {
  const clientIP = getClientIP(req);
  
  res.status(200).json({
    ip: clientIP,
    timestamp: new Date().toISOString()
  });
});

/**
 * Alternative endpoint with explicit path
 */
app.get('/ip', (req: Request, res: Response): void => {
  const clientIP = getClientIP(req);
  
  res.status(200).json({
    ip: clientIP,
    timestamp: new Date().toISOString()
  });
});

/**
 * Endpoint that returns IP as plain text
 */
app.get('/ip/plain', (req: Request, res: Response): void => {
  const clientIP = getClientIP(req);
  res.status(200).type('text/plain').send(clientIP);
});

/**
 * Start the server
 */
app.listen(PORT, HOST, (): void => {
  console.log(`🚀 Get IP API server is running on http://${HOST}:${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`📍 Available endpoints:`);
  console.log(`   GET /        - Get IP as JSON`);
  console.log(`   GET /ip      - Get IP as JSON`);
  console.log(`   GET /ip/plain - Get IP as plain text`);
  console.log(`   GET /health  - Health check`);
});

export default app;
