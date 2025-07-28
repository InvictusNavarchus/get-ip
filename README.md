# Get IP API

A simple Express.js API built with TypeScript that allows anyone to get their public IP address through HTTP requests.

## Features

- 🌐 Get client IP address in JSON format
- 📝 Get client IP address as plain text
- 🏥 Health check endpoint
- 🔍 Handles various proxy headers (X-Forwarded-For, X-Real-IP)
- 📋 TypeScript for type safety
- ⚡ Lightweight and fast

## Installation

1. Install dependencies using PNPM:
```bash
pnpm install
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

The server runs on port 3000 by default. You can change this by setting the `PORT` environment variable.

## API Endpoints

### Get IP as JSON
```
GET /
GET /ip
```

**Response:**
```json
{
  "ip": "192.168.1.100",
  "timestamp": "2025-07-28T10:30:00.000Z"
}
```

### Get IP as Plain Text
```
GET /ip/plain
```

**Response:**
```
192.168.1.100
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
  "service": "get-ip-api"
}
```

## Environment Variables

- `PORT` - Server port (default: 3000)

## Examples

### Using curl
```bash
# Get IP as JSON
curl https://your-api-domain.com/

# Get IP as plain text
curl https://your-api-domain.com/ip/plain

# Health check
curl https://your-api-domain.com/health
```

### Using JavaScript/fetch
```javascript
// Get IP as JSON
fetch('https://your-api-domain.com/')
  .then(response => response.json())
  .then(data => console.log('Your IP:', data.ip));

// Get IP as plain text
fetch('https://your-api-domain.com/ip/plain')
  .then(response => response.text())
  .then(ip => console.log('Your IP:', ip));
```

## How it works

The API extracts the client's IP address by checking the following sources in order:

1. `X-Forwarded-For` header (common with load balancers and proxies)
2. `X-Real-IP` header (used by some reverse proxies)
3. Connection remote address (direct connection)

This ensures accurate IP detection even when the API is behind proxies or load balancers.

## License

MIT
