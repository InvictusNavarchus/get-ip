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
 * Interface for IP address information
 */
interface IPInfo {
  ipv4?: string;
  ipv6?: string;
  primary: string;
  version: 'IPv4' | 'IPv6' | 'Unknown';
}

/**
 * Checks if an IP address is IPv4
 * @param ip - IP address string
 * @returns true if the IP is IPv4
 */
function isIPv4(ip: string): boolean {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
}

/**
 * Checks if an IP address is IPv6
 * @param ip - IP address string
 * @returns true if the IP is IPv6
 */
function isIPv6(ip: string): boolean {
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$|^(?:[0-9a-fA-F]{1,4}:)*::(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$/;
  return ipv6Regex.test(ip) || ip.startsWith('::') || ip.includes('::');
}

/**
 * Checks if an IPv4 address is private or localhost
 * @param ip - IPv4 address string
 * @returns true if the IP is private/localhost
 */
function isPrivateOrLocalIPv4(ip: string): boolean {
  if (!isIPv4(ip)) return false;
  
  const parts = ip.split('.').map(Number);
  
  // Localhost (127.0.0.0/8)
  if (parts[0] === 127) return true;
  
  // Private networks
  // 10.0.0.0/8
  if (parts[0] === 10) return true;
  
  // 172.16.0.0/12
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  
  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) return true;
  
  // Link-local (169.254.0.0/16)
  if (parts[0] === 169 && parts[1] === 254) return true;
  
  return false;
}

/**
 * Checks if an IPv6 address is private or localhost
 * @param ip - IPv6 address string
 * @returns true if the IP is private/localhost
 */
function isPrivateOrLocalIPv6(ip: string): boolean {
  if (!isIPv6(ip)) return false;
  
  // Localhost
  if (ip === '::1') return true;
  
  // Private/local addresses
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // Unique local addresses
  if (ip.startsWith('fe80:')) return true; // Link-local addresses
  if (ip.startsWith('::')) return true; // Various local addresses
  
  return false;
}

/**
 * Determines if an IP should be prioritized over another
 * @param newIP - New IP candidate
 * @param currentIP - Current IP (if any)
 * @returns true if newIP should replace currentIP
 */
function shouldPrioritizeIP(newIP: string, currentIP?: string): boolean {
  if (!currentIP || currentIP === 'Unknown') return true;
  
  const newIsIPv4 = isIPv4(newIP);
  const currentIsIPv4 = isIPv4(currentIP);
  
  // If we have IPv4 candidates, compare them
  if (newIsIPv4 && currentIsIPv4) {
    const newIsPrivate = isPrivateOrLocalIPv4(newIP);
    const currentIsPrivate = isPrivateOrLocalIPv4(currentIP);
    
    // Prefer public over private
    if (!newIsPrivate && currentIsPrivate) return true;
    if (newIsPrivate && !currentIsPrivate) return false;
    
    // If both are the same type (public/private), keep the first one
    return false;
  }
  
  // If we have IPv6 candidates, compare them
  if (!newIsIPv4 && !currentIsIPv4) {
    const newIsPrivate = isPrivateOrLocalIPv6(newIP);
    const currentIsPrivate = isPrivateOrLocalIPv6(currentIP);
    
    // Prefer public over private
    if (!newIsPrivate && currentIsPrivate) return true;
    if (newIsPrivate && !currentIsPrivate) return false;
    
    // If both are the same type, keep the first one
    return false;
  }
  
  // Prefer IPv4 over IPv6 if we don't have IPv4 yet
  if (newIsIPv4 && !currentIsIPv4) return true;
  
  return false;
}

/**
 * Extracts and categorizes the client's IP addresses from the request object
 * @param req - Express request object
 * @returns Object containing IPv4, IPv6, primary IP, and version information
 */
function getClientIP(req: Request): IPInfo {
  const forwarded = req.headers['x-forwarded-for'] as string;
  const realIP = req.headers['x-real-ip'] as string;
  const remoteAddress = req.connection?.remoteAddress || req.socket?.remoteAddress;
  
  const result: IPInfo = {
    primary: 'Unknown',
    version: 'Unknown'
  };
  
  const processIP = (ip: string): void => {
    if (!ip || ip === 'Unknown') return;
    
    // Remove IPv6 prefix if present (::ffff:xxx.xxx.xxx.xxx)
    const cleanIP = ip.startsWith('::ffff:') ? ip.substring(7) : ip;
    
    if (isIPv4(cleanIP)) {
      // Only update IPv4 if we should prioritize this IP
      if (!result.ipv4 || shouldPrioritizeIP(cleanIP, result.ipv4)) {
        result.ipv4 = cleanIP;
      }
      
      // Update primary IP if this should be prioritized
      if (shouldPrioritizeIP(cleanIP, result.primary)) {
        result.primary = cleanIP;
        result.version = 'IPv4';
      }
    } else if (isIPv6(ip)) {
      // Only update IPv6 if we should prioritize this IP
      if (!result.ipv6 || shouldPrioritizeIP(ip, result.ipv6)) {
        result.ipv6 = ip;
      }
      
      // Update primary IP if this should be prioritized
      if (shouldPrioritizeIP(ip, result.primary)) {
        result.primary = ip;
        result.version = 'IPv6';
      }
    }
  };
  
  // Handle X-Forwarded-For header (may contain multiple IPs)
  // Process in order - first IP is usually the client's real IP
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    ips.forEach(processIP);
  }
  
  // Handle X-Real-IP header
  if (realIP) {
    processIP(realIP);
  }
  
  // Fall back to connection remote address (lowest priority)
  if (remoteAddress) {
    processIP(remoteAddress);
  }
  
  return result;
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
  const ipInfo = getClientIP(req);
  
  res.status(200).json({
    ip: ipInfo.primary,
    ipv4: ipInfo.ipv4 || null,
    ipv6: ipInfo.ipv6 || null,
    version: ipInfo.version,
    timestamp: new Date().toISOString()
  });
});

/**
 * Alternative endpoint with explicit path
 */
app.get('/ip', (req: Request, res: Response): void => {
  const ipInfo = getClientIP(req);
  
  res.status(200).json({
    ip: ipInfo.primary,
    ipv4: ipInfo.ipv4 || null,
    ipv6: ipInfo.ipv6 || null,
    version: ipInfo.version,
    timestamp: new Date().toISOString()
  });
});

/**
 * Endpoint that returns IP as plain text
 */
app.get('/ip/plain', (req: Request, res: Response): void => {
  const ipInfo = getClientIP(req);
  res.status(200).type('text/plain').send(ipInfo.primary);
});

/**
 * Endpoint that returns only IPv4 address
 */
app.get('/ipv4', (req: Request, res: Response): void => {
  const ipInfo = getClientIP(req);
  
  if (ipInfo.ipv4) {
    res.status(200).json({
      ipv4: ipInfo.ipv4,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(404).json({
      error: 'No IPv4 address found',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Endpoint that returns only IPv6 address
 */
app.get('/ipv6', (req: Request, res: Response): void => {
  const ipInfo = getClientIP(req);
  
  if (ipInfo.ipv6) {
    res.status(200).json({
      ipv6: ipInfo.ipv6,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(404).json({
      error: 'No IPv6 address found',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Endpoint that returns IPv4 as plain text
 */
app.get('/ipv4/plain', (req: Request, res: Response): void => {
  const ipInfo = getClientIP(req);
  
  if (ipInfo.ipv4) {
    res.status(200).type('text/plain').send(ipInfo.ipv4);
  } else {
    res.status(404).type('text/plain').send('No IPv4 address found');
  }
});

/**
 * Endpoint that returns IPv6 as plain text
 */
app.get('/ipv6/plain', (req: Request, res: Response): void => {
  const ipInfo = getClientIP(req);
  
  if (ipInfo.ipv6) {
    res.status(200).type('text/plain').send(ipInfo.ipv6);
  } else {
    res.status(404).type('text/plain').send('No IPv6 address found');
  }
});

/**
 * Start the server
 */
app.listen(PORT, HOST, (): void => {
  console.log(`🚀 Get IP API server is running on http://${HOST}:${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`📍 Available endpoints:`);
  console.log(`   GET /           - Get IP info (IPv4 & IPv6) as JSON`);
  console.log(`   GET /ip         - Get IP info (IPv4 & IPv6) as JSON`);
  console.log(`   GET /ip/plain   - Get primary IP as plain text`);
  console.log(`   GET /ipv4       - Get IPv4 address as JSON`);
  console.log(`   GET /ipv6       - Get IPv6 address as JSON`);
  console.log(`   GET /ipv4/plain - Get IPv4 address as plain text`);
  console.log(`   GET /ipv6/plain - Get IPv6 address as plain text`);
  console.log(`   GET /health     - Health check`);
});

export default app;
