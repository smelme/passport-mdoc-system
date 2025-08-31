# Passport mDoc System - Codespaces Deployment Guide

## 🚀 Quick Start in GitHub Codespaces

### 1. Start walt.id Services
```bash
# Start walt.id Docker containers
docker-compose up -d

# Wait for services to be healthy (about 30 seconds)
docker ps
```

### 2. Initialize PKI Setup
```bash
# Generate PKI certificates (first time only)
node setup-mdoc-pki.js
```

### 3. Start Services

#### Option A: Passport Reader UI (Recommended)
```bash
# Start the complete passport reader interface
npm run passport-ui

# Access at: https://<codespace-name>-8080.app.github.dev
```

#### Option B: Individual Services
```bash
# Start QR test server
npm run qr-test
# Access at: https://<codespace-name>-3001.app.github.dev

# Start web authentication service
npm start
# Access at: https://<codespace-name>-9000.app.github.dev
```

## 📱 Testing from Mobile Devices

### Compatible Wallets
- **walt.id Wallet**: https://wallet.walt.id/
- **Microsoft Authenticator**
- **Credible Wallet**
- **Any OID4VCI-compliant wallet**

### Access URLs (Replace `<codespace-name>` with your actual Codespace name)
- **Passport Reader UI**: `https://<codespace-name>-8080.app.github.dev`
- **QR Test Server**: `https://<codespace-name>-3001.app.github.dev`
- **Web Auth Service**: `https://<codespace-name>-9000.app.github.dev`
- **walt.id Issuer API**: `https://<codespace-name>-7002.app.github.dev`
- **walt.id Verifier API**: `https://<codespace-name>-7003.app.github.dev`

## 🔧 Environment Configuration

Create a `.env` file for custom settings:
```env
# Service ports (defaults shown)
PASSPORT_UI_PORT=8080
QR_TEST_PORT=3001
WEB_AUTH_PORT=9000
WALT_ISSUER_PORT=7002
WALT_VERIFIER_PORT=7003

# Public URLs (auto-detected in Codespaces)
PUBLIC_BASE_URL=auto
```

## 🌐 API Endpoints

### Passport Reader API
- `POST /api/read-nfc-passport` - Read passport via NFC
- `POST /api/issue-mdoc` - Issue mDoc credential
- `POST /api/generate-qr` - Generate QR code
- `GET /api/health` - Service health check

### Example API Usage
```bash
# Health check
curl https://<codespace-name>-8080.app.github.dev/api/health

# Issue credential
curl -X POST https://<codespace-name>-8080.app.github.dev/api/issue-mdoc \
  -H "Content-Type: application/json" \
  -d '{
    "passportData": {
      "family_name": "SMITH",
      "given_name": "JOHN",
      "birth_date": "1990-01-01",
      "sex": 1,
      "nationality": "USA",
      "document_number": "P1234567",
      "issuing_country": "USA",
      "expiry_date": "2030-01-01"
    },
    "webId": "test@example.com"
  }'
```

## 🛠️ Troubleshooting

### Services Not Starting
```bash
# Check Docker containers
docker ps -a

# Restart walt.id services
docker-compose restart

# Check logs
docker-compose logs
```

### PKI Issues
```bash
# Regenerate certificates
rm -f mdoc-pki-setup.json
node setup-mdoc-pki.js
```

## 📋 Available Scripts
- `npm run passport-ui` - Start passport reader interface
- `npm run issue-mdoc` - Generate mDoc credential
- `npm run qr-test` - Start QR testing server
- `npm start` - Start web authentication service
- `npm test` - Run system tests
npm run passport-ui