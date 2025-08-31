# Passport mDoc System

A complete system for reading passports via NFC, issuing mobile documents (mDocs), and displaying QR codes for wallet storage.

## 🚀 Quick Start with GitHub Codespaces

### Deploy to Codespaces (Recommended for Device Testing)

1. **Fork/Clone this repository to GitHub**
2. **Open in Codespaces:**
   - Click "Code" → "Codespaces" → "Create codespace on main"
   - Wait for environment setup (2-3 minutes)

3. **Start the system:**
   ```bash
   ./setup-codespaces.sh
   npm run passport-ui
   ```

4. **Access from any device:**
   - Passport Reader: `https://[your-codespace]-8080.app.github.dev`
   - Use your mobile device to scan QR codes!

### Local Development

1. **Prerequisites:**
   ```bash
   node -v  # Requires Node.js 18+
   docker -v  # Requires Docker
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start walt.id services:**
   ```bash
   docker-compose up -d
   ```

4. **Initialize PKI:**
   ```bash
   node setup-mdoc-pki.js
   ```

5. **Start the passport reader:**
   ```bash
   npm run passport-ui
   ```

6. **Open in browser:**
   - http://localhost:8080

## 📱 How It Works

### 1. Passport Reading
- **NFC Reading:** Simulated for demonstration
- **Manual Entry:** Complete passport data form
- **Real Data:** Uses actual passport format standards

### 2. mDoc Issuance
- Converts passport data to ISO 18013-5 mDoc format
- Issues via walt.id infrastructure
- Follows OID4VCI standard protocols

### 3. QR Code Display
- Generates scannable QR codes
- Compatible with major mobile wallets
- Instant wallet storage

## 🔧 System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │    │   Mobile Wallet │    │  walt.id Cloud  │
│  (Passport UI)  │    │   (QR Scanner)  │    │   (Issuer API)  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Express.js    │◄──►│   QR Code       │◄──►│   Docker        │
│   Backend       │    │   Generation    │    │   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## � Compatible Wallets

- **walt.id Wallet:** https://wallet.walt.id/
- **Microsoft Authenticator**
- **Credible Wallet**
- **Any OID4VCI-compliant wallet**

## 🔒 Security Features

- PKI certificate chain validation
- ISO 18013-5 mDoc standard compliance
- Secure credential issuance protocols
- HTTPS-only in production environments

## 🛠 Development

### File Structure
```
├── passport-reader-ui.html      # Main web interface
├── passport-reader-server.js    # Express.js backend
├── qr-test-server.js           # QR code testing server
├── lib/
│   ├── PassportMDocIssuer.js   # mDoc issuance logic
│   └── mdoc-issuer.js          # CLI issuer (legacy)
├── .devcontainer/              # Codespaces configuration
└── docker-compose.yml          # walt.id services
```

### API Endpoints
- `POST /api/read-nfc-passport` - Process passport data
- `POST /api/issue-mdoc` - Issue mDoc credential
- `GET /api/generate-qr` - Generate QR code

### Environment Variables
- `CODESPACE_NAME` - Auto-detected in Codespaces
- `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN` - Auto-set

## 🚨 Troubleshooting

### Common Issues

**Docker not starting:**
```bash
sudo service docker start
docker-compose up -d
```

**Port conflicts:**
```bash
# Check what's using ports
netstat -tlnp | grep :8080
# Kill process if needed
kill -9 [PID]
```

**PKI setup failed:**
```bash
# Re-run PKI setup
rm mdoc-pki-setup.json
node setup-mdoc-pki.js
```

### Codespaces Specific

**Public URLs not working:**
- Ensure ports are set to "Public" in Codespaces ports panel
- Check CODESPACE_NAME environment variable

**Mobile device can't access:**
- Use the full public URL: `https://[codespace]-8080.app.github.dev`
- Ensure mobile device is on internet (not same network required)

## 📄 License

This project demonstrates passport mDoc issuance using walt.id infrastructure.
