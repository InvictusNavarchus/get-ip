import express, { Request, Response, Express } from 'express';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app: Express = express();

// Configuration from environment variables
const HOST: string = process.env.HOST || 'localhost';
const PORT: number = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const NODE_ENV: string = process.env.NODE_ENV || 'development';
const ENABLE_FALLBACK: boolean = process.env.ENABLE_FALLBACK !== 'false'; // Default enabled

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
 * Checks if we only have private/local IPs detected
 * @param ipInfo - The IP info object
 * @returns true if only private IPs are detected
 */
function hasOnlyPrivateIPs(ipInfo: IPInfo): boolean {
  const hasPublicIPv4 = ipInfo.ipv4 && !isPrivateOrLocalIPv4(ipInfo.ipv4);
  const hasPublicIPv6 = ipInfo.ipv6 && !isPrivateOrLocalIPv6(ipInfo.ipv6);
  
  return !hasPublicIPv4 && !hasPublicIPv6 && Boolean(ipInfo.ipv4 || ipInfo.ipv6);
}

/**
 * Attempts to get public IP from an external service as fallback
 * @returns Promise with public IP or null
 */
async function getPublicIPFallback(): Promise<string | null> {
  try {
    // Try multiple services as fallback
    const services = [
      'https://api.ipify.org?format=text',
      'https://ipinfo.io/ip',
      'https://ifconfig.me/ip'
    ];
    
    for (const service of services) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(service, { 
          signal: controller.signal,
          headers: { 'User-Agent': 'get-ip-api/1.0' }
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const ip = (await response.text()).trim();
          if (ip && isIPv4(ip) && !isPrivateOrLocalIPv4(ip)) {
            console.log(`✅ Fallback IP detected from ${service}: ${ip}`);
            return ip;
          }
        }
      } catch (error) {
        console.log(`❌ Fallback service ${service} failed:`, error);
        continue;
      }
    }
  } catch (error) {
    console.log('❌ All fallback services failed:', error);
  }
  
  return null;
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
  const cfConnectingIP = req.headers['cf-connecting-ip'] as string; // Cloudflare
  const trueClientIP = req.headers['true-client-ip'] as string; // Akamai
  const xClientIP = req.headers['x-client-ip'] as string; // General
  const xClusterClientIP = req.headers['x-cluster-client-ip'] as string; // Cluster/LB
  const xOriginalForwardedFor = req.headers['x-original-forwarded-for'] as string; // Original chain
  const remoteAddress = req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip;
  
  // Debug logging in development
  if (NODE_ENV === 'development') {
    console.log('🔍 IP Detection Debug:');
    console.log('  x-forwarded-for:', forwarded);
    console.log('  x-real-ip:', realIP);
    console.log('  cf-connecting-ip:', cfConnectingIP);
    console.log('  true-client-ip:', trueClientIP);
    console.log('  x-client-ip:', xClientIP);
    console.log('  x-cluster-client-ip:', xClusterClientIP);
    console.log('  x-original-forwarded-for:', xOriginalForwardedFor);
    console.log('  remoteAddress:', remoteAddress);
  }
  
  const result: IPInfo = {
    primary: 'Unknown',
    version: 'Unknown'
  };
  
  const processIP = (ip: string, source?: string): void => {
    if (!ip || ip === 'Unknown') return;
    
    // Remove IPv6 prefix if present (::ffff:xxx.xxx.xxx.xxx)
    const cleanIP = ip.startsWith('::ffff:') ? ip.substring(7) : ip;
    
    if (NODE_ENV === 'development' && source) {
      console.log(`  Processing ${source}: ${ip} -> ${cleanIP}`);
    }
    
    if (isIPv4(cleanIP)) {
      // Only update IPv4 if we should prioritize this IP
      if (!result.ipv4 || shouldPrioritizeIP(cleanIP, result.ipv4)) {
        result.ipv4 = cleanIP;
        if (NODE_ENV === 'development') {
          console.log(`    ✅ Updated IPv4: ${cleanIP} (from ${source || 'unknown'})`);
        }
      }
      
      // Update primary IP if this should be prioritized
      if (shouldPrioritizeIP(cleanIP, result.primary)) {
        result.primary = cleanIP;
        result.version = 'IPv4';
        if (NODE_ENV === 'development') {
          console.log(`    ✅ Updated Primary: ${cleanIP} (from ${source || 'unknown'})`);
        }
      }
    } else if (isIPv6(ip)) {
      // Only update IPv6 if we should prioritize this IP
      if (!result.ipv6 || shouldPrioritizeIP(ip, result.ipv6)) {
        result.ipv6 = ip;
        if (NODE_ENV === 'development') {
          console.log(`    ✅ Updated IPv6: ${ip} (from ${source || 'unknown'})`);
        }
      }
      
      // Update primary IP if this should be prioritized
      if (shouldPrioritizeIP(ip, result.primary)) {
        result.primary = ip;
        result.version = 'IPv6';
        if (NODE_ENV === 'development') {
          console.log(`    ✅ Updated Primary: ${ip} (from ${source || 'unknown'})`);
        }
      }
    }
  };
  
  // Priority order: Most trusted headers first
  
  // 1. Cloudflare's CF-Connecting-IP (most reliable when behind Cloudflare)
  if (cfConnectingIP) {
    processIP(cfConnectingIP, 'cf-connecting-ip');
  }
  
  // 2. True-Client-IP (Akamai and other CDNs)
  if (trueClientIP) {
    processIP(trueClientIP, 'true-client-ip');
  }
  
  // 3. X-Real-IP (nginx and other proxies)
  if (realIP) {
    processIP(realIP, 'x-real-ip');
  }
  
  // 4. X-Client-IP (general purpose)
  if (xClientIP) {
    processIP(xClientIP, 'x-client-ip');
  }
  
  // 5. X-Cluster-Client-IP (cluster/load balancer)
  if (xClusterClientIP) {
    processIP(xClusterClientIP, 'x-cluster-client-ip');
  }
  
  // 6. X-Forwarded-For (process first IP which is usually the client)
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    // Process only the first IP as it's typically the original client
    if (ips.length > 0 && ips[0]) {
      processIP(ips[0], 'x-forwarded-for[0]');
    }
  }
  
  // 7. X-Original-Forwarded-For (backup)
  if (xOriginalForwardedFor) {
    const ips = xOriginalForwardedFor.split(',').map(ip => ip.trim());
    if (ips.length > 0 && ips[0]) {
      processIP(ips[0], 'x-original-forwarded-for[0]');
    }
  }
  
  // 8. Fall back to connection remote address (lowest priority)
  if (remoteAddress) {
    processIP(remoteAddress, 'remoteAddress');
  }
  
  if (NODE_ENV === 'development') {
    console.log('🔍 Final Result:', result);
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
 * Debug endpoint to see all IP-related headers and detection process
 */
app.get('/debug', (req: Request, res: Response): void => {
  const forwarded = req.headers['x-forwarded-for'] as string;
  const realIP = req.headers['x-real-ip'] as string;
  const cfConnectingIP = req.headers['cf-connecting-ip'] as string;
  const trueClientIP = req.headers['true-client-ip'] as string;
  const xClientIP = req.headers['x-client-ip'] as string;
  const xClusterClientIP = req.headers['x-cluster-client-ip'] as string;
  const xOriginalForwardedFor = req.headers['x-original-forwarded-for'] as string;
  const remoteAddress = req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip;
  
  const ipInfo = getClientIP(req);
  
  res.status(200).json({
    detectedIPs: ipInfo,
    rawHeaders: {
      'x-forwarded-for': forwarded,
      'x-real-ip': realIP,
      'cf-connecting-ip': cfConnectingIP,
      'true-client-ip': trueClientIP,
      'x-client-ip': xClientIP,
      'x-cluster-client-ip': xClusterClientIP,
      'x-original-forwarded-for': xOriginalForwardedFor,
      'remoteAddress': remoteAddress
    },
    parsedForwardedFor: forwarded ? forwarded.split(',').map(ip => ip.trim()) : null,
    parsedOriginalForwardedFor: xOriginalForwardedFor ? xOriginalForwardedFor.split(',').map(ip => ip.trim()) : null,
    allHeaders: req.headers,
    timestamp: new Date().toISOString()
  });
});

/**
 * Main endpoint to get client's IP address
 */
app.get('/', async (req: Request, res: Response): Promise<void> => {
  let ipInfo = getClientIP(req);
  
  // If we only detected private IPs and fallback is enabled, try fallback services
  if (ENABLE_FALLBACK && hasOnlyPrivateIPs(ipInfo)) {
    console.log('🔄 Only private IPs detected, trying fallback services...');
    const fallbackIP = await getPublicIPFallback();
    
    if (fallbackIP) {
      // Update the result with the fallback public IP
      ipInfo = {
        ipv4: fallbackIP,
        ipv6: ipInfo.ipv6,
        primary: fallbackIP,
        version: 'IPv4'
      };
      console.log(`✅ Updated with fallback IP: ${fallbackIP}`);
    }
  }
  
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
app.get('/ip', async (req: Request, res: Response): Promise<void> => {
  let ipInfo = getClientIP(req);
  
  // If we only detected private IPs and fallback is enabled, try fallback services
  if (ENABLE_FALLBACK && hasOnlyPrivateIPs(ipInfo)) {
    console.log('🔄 Only private IPs detected, trying fallback services...');
    const fallbackIP = await getPublicIPFallback();
    
    if (fallbackIP) {
      // Update the result with the fallback public IP
      ipInfo = {
        ipv4: fallbackIP,
        ipv6: ipInfo.ipv6,
        primary: fallbackIP,
        version: 'IPv4'
      };
      console.log(`✅ Updated with fallback IP: ${fallbackIP}`);
    }
  }
  
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
app.get('/ip/plain', async (req: Request, res: Response): Promise<void> => {
  let ipInfo = getClientIP(req);
  
  // If we only detected private IPs and fallback is enabled, try fallback services
  if (ENABLE_FALLBACK && hasOnlyPrivateIPs(ipInfo)) {
    console.log('🔄 Only private IPs detected, trying fallback services...');
    const fallbackIP = await getPublicIPFallback();
    
    if (fallbackIP) {
      ipInfo = {
        ipv4: fallbackIP,
        ipv6: ipInfo.ipv6,
        primary: fallbackIP,
        version: 'IPv4'
      };
      console.log(`✅ Updated with fallback IP: ${fallbackIP}`);
    }
  }
  
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
  console.log(`� Fallback services: ${ENABLE_FALLBACK ? 'ENABLED' : 'DISABLED'}`);
  console.log(`�📍 Available endpoints:`);
  console.log(`   GET /           - Get IP info (IPv4 & IPv6) as JSON`);
  console.log(`   GET /ip         - Get IP info (IPv4 & IPv6) as JSON`);
  console.log(`   GET /ip/plain   - Get primary IP as plain text`);
  console.log(`   GET /ipv4       - Get IPv4 address as JSON`);
  console.log(`   GET /ipv6       - Get IPv6 address as JSON`);
  console.log(`   GET /ipv4/plain - Get IPv4 address as plain text`);
  console.log(`   GET /ipv6/plain - Get IPv6 address as plain text`);
  console.log(`   GET /health     - Health check`);
  console.log(`   GET /debug      - Debug IP detection (shows all headers)`);
});

export default app;
