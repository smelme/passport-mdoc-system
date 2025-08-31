# 🎫 Passport mDoc System with walt.id

A complete system for issuing and verifying passport data as ISO 18013-5 compliant mobile documents (mDocs) using walt.id infrastructure, with web authentication capabilities.

## 🌟 Overview

This system enables:
- **Passport Data Extraction**: Read passport information (mock mode for demo)
- **mDoc Issuance**: Issue passport credentials as ISO 18013-5 mDocs
- **Web Authentication**: Use passport mDocs for website login
- **Custom Claims**: Add web ID and verification metadata
- **Verifiable Presentations**: Present credentials for authentication

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Passport      │    │    walt.id      │    │  Web Auth       │
│   NFC Reader    │───▶│    Issuer       │───▶│   Service       │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Passport Data  │    │   mDoc Creds    │    │   Verified      │
│  (MRZ + Bio)    │    │ (ISO 18013-5)   │    │   Identity      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+
- Docker & Docker Compose
- walt.id issuer/verifier running

```bash
# Start walt.id services
docker-compose up -d

# Install dependencies
npm install
```

### 2. Generate Mock Passport Data

```bash
# Extract passport data (mock mode)
npm run nfc-reader
```

### 3. Issue mDoc Credential

```bash
# Issue passport mDoc with your web ID
npm run issue-mdoc -- --web-id="alice@example.com"
```

### 4. Start Web Authentication Service

```bash
# Start the web auth service
npm run web-auth

# Open browser to http://localhost:8080
```

## 📋 Components

### 🔍 Passport Data Reader (`passport-nfc-reader.js`)
- Simulates NFC passport reading
- Extracts MRZ (Machine Readable Zone)
- Formats data for mDoc structure

### 🎫 mDoc Issuer (`mdoc-issuer.js`)
- walt.id integration for mDoc issuance
- COSE key generation (ES256)
- Custom web ID claims
- CWT proof of possession

### 🌐 Web Auth Service (`web-auth-service.js`)
- Express.js web server
- OpenID4VP presentation requests
- Session management
- VP verification

## 🔧 Usage Examples

### Extract Passport Data
```bash
node passport-nfc-reader.js
```

### Issue mDoc
```bash
node mdoc-issuer.js --web-id="alice@example.com"
```

### Start Web Auth
```bash
node web-auth-service.js
```

## 🔐 Security Features

- **COSE Keys**: ES256 for mDoc signing
- **Proof of Possession**: CWT tokens
- **Custom Claims**: Web ID integration
- **Verification Levels**: Multiple trust levels

## 📱 Wallet Integration

The issued mDoc is compatible with:
- ISO 18013-5 compliant wallets
- COSE key binding
- CWT proof types
- Custom namespace support

## 🛠️ Configuration

walt.id supports these mDoc configurations:
- Format: `mso_mdoc`
- Doctype: `org.iso.18013.5.1.mDL`
- Crypto: ES256 COSE keys
- Proof: CWT tokens

## 🌍 Production Notes

For production deployment:
1. Replace mock NFC with real passport reading
2. Implement secure key storage
3. Add proper session management
4. Enable HTTPS and security headers
5. Integrate with real wallet applications

---

Made with ❤️ for secure digital identity
