# Get IP API

A simple Express.js API built with TypeScript that allows anyone to get their public IP address through HTTP requests with support for both IPv4 and IPv6.

## Features

- 🌐 Get client IP address with IPv4 and IPv6 detection
- 📊 Separate endpoints for IPv4 and IPv6 addresses
- 📝 Get client IP address as plain text or JSON
- 🏥 Health check endpoint
- 🔍 Handles various proxy headers (X-Forwarded-For, X-Real-IP)
- 📋 TypeScript for type safety
- ⚡ Lightweight and fast

## Installation

1. Install dependencies using PNPM:
```bash
pnpm install
```

2. Copy the environment file and configure it:
```bash
cp .env.example .env
```

3. Edit the `.env` file to configure your settings:
```bash
# Server Configuration
HOST=localhost
PORT=3000

# Application Environment
NODE_ENV=development
```

## Usage

### Development

Start the development server with auto-reload:
```bash
pnpm dev
```

### Production

1. Build the project:
```bash
pnpm build
```

2. Start the production server:
```bash
pnpm start
```

The server runs on `localhost:3000` by default. You can change the host and port by setting the `HOST` and `PORT` environment variables in your `.env` file.

## API Endpoints

### Get IP Information (IPv4 & IPv6)
```
GET /
GET /ip
```

**Response:**
```json
{
  "ip": "192.168.1.100",
  "ipv4": "192.168.1.100",
  "ipv6": null,
  "version": "IPv4",
  "timestamp": "2025-07-28T10:30:00.000Z"
}
```

### Get Primary IP as Plain Text
```
GET /ip/plain
```

**Response:**
```
192.168.1.100
```

### Get IPv4 Address Only
```
GET /ipv4
```

**Response:**
```json
{
  "ipv4": "192.168.1.100",
  "timestamp": "2025-07-28T10:30:00.000Z"
}
```

**Error Response (if no IPv4 found):**
```json
{
  "error": "No IPv4 address found",
  "timestamp": "2025-07-28T10:30:00.000Z"
}
```

### Get IPv6 Address Only
```
GET /ipv6
```

**Response:**
```json
{
  "ipv6": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
  "timestamp": "2025-07-28T10:30:00.000Z"
}
```

**Error Response (if no IPv6 found):**
```json
{
  "error": "No IPv6 address found",
  "timestamp": "2025-07-28T10:30:00.000Z"
}
```

### Get IPv4 as Plain Text
```
GET /ipv4/plain
```

**Response:**
```
192.168.1.100
```

### Get IPv6 as Plain Text
```
GET /ipv6/plain
```

**Response:**
```
2001:0db8:85a3:0000:0000:8a2e:0370:7334
```

### Health Check
```
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-07-28T10:30:00.000Z",
  "service": "get-ip-api",
  "environment": "development",
  "host": "localhost",
  "port": 3000
}
```

## Environment Variables

- `HOST` - Server host address (default: localhost)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Application environment (default: development)

## Examples

### Using curl
```bash
# Get IP information (IPv4 & IPv6)
curl https://your-api-domain.com/

# Get primary IP as plain text
curl https://your-api-domain.com/ip/plain

# Get only IPv4 address
curl https://your-api-domain.com/ipv4

# Get only IPv6 address
curl https://your-api-domain.com/ipv6

# Get IPv4 as plain text
curl https://your-api-domain.com/ipv4/plain

# Get IPv6 as plain text
curl https://your-api-domain.com/ipv6/plain

# Health check
curl https://your-api-domain.com/health
```

### Using JavaScript/fetch
```javascript
// Get IP information (IPv4 & IPv6)
fetch('https://your-api-domain.com/')
  .then(response => response.json())
  .then(data => {
    console.log('Primary IP:', data.ip);
    console.log('IPv4:', data.ipv4);
    console.log('IPv6:', data.ipv6);
    console.log('Version:', data.version);
  });

// Get only IPv4 address
fetch('https://your-api-domain.com/ipv4')
  .then(response => response.json())
  .then(data => console.log('IPv4:', data.ipv4));

// Get primary IP as plain text
fetch('https://your-api-domain.com/ip/plain')
  .then(response => response.text())
  .then(ip => console.log('Your IP:', ip));
```

## How it works

The API extracts the client's IP address by checking the following sources in order:

1. `X-Forwarded-For` header (common with load balancers and proxies)
2. `X-Real-IP` header (used by some reverse proxies)  
3. Connection remote address (direct connection)

The API intelligently detects and categorizes IP addresses as IPv4 or IPv6:

- **IPv4 Detection**: Uses regex pattern matching for standard IPv4 format (xxx.xxx.xxx.xxx)
- **IPv6 Detection**: Handles various IPv6 formats including compressed notation (::1, ::ffff:, etc.)
- **Dual Stack Support**: When both IPv4 and IPv6 are available, both are returned
- **Primary IP Selection**: The first valid IP found becomes the primary IP address

This ensures accurate IP detection even when the API is behind proxies or load balancers, and provides comprehensive support for both IP protocol versions.

## License

MIT
