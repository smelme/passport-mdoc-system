#!/bin/bash

# Codespaces Startup Script for Passport mDoc System

echo "🚀 Setting up Passport mDoc System in Codespaces..."
echo "═══════════════════════════════════════════════════"

# Check if we're in Codespaces
if [ -n "$CODESPACE_NAME" ]; then
    echo "🌐 Codespaces environment detected: $CODESPACE_NAME"
    echo "📱 Public URLs will be automatically generated"
else
    echo "💻 Local development environment"
fi

# Wait for Docker to be ready
echo "🐳 Waiting for Docker to be ready..."
until docker info > /dev/null 2>&1; do
    echo "⏳ Docker not ready yet, waiting..."
    sleep 2
done
echo "✅ Docker is ready"

# Start walt.id services
echo "🔧 Starting walt.id services..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for walt.id services to start..."
sleep 10

# Check service status
echo "🔍 Checking service status..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Initialize PKI if not exists
if [ ! -f "mdoc-pki-setup.json" ]; then
    echo "🔐 Initializing PKI setup..."
    node setup-mdoc-pki.js
    echo "✅ PKI setup completed"
else
    echo "✅ PKI setup already exists"
fi

echo ""
echo "🎉 Setup complete!"
echo "═══════════════════════════════════════════════════"

if [ -n "$CODESPACE_NAME" ]; then
    echo "🌐 Codespaces URLs:"
    echo "📱 Passport Reader UI: https://$CODESPACE_NAME-8080.app.github.dev"
    echo "🔗 QR Test Server: https://$CODESPACE_NAME-3001.app.github.dev"
    echo "🌐 Web Auth Service: https://$CODESPACE_NAME-9000.app.github.dev"
    echo "🔧 walt.id Issuer API: https://$CODESPACE_NAME-7002.app.github.dev"
    echo "🔧 walt.id Verifier API: https://$CODESPACE_NAME-7003.app.github.dev"
else
    echo "💻 Local URLs:"
    echo "📱 Passport Reader UI: http://localhost:8080"
    echo "🔗 QR Test Server: http://localhost:3001"
    echo "🌐 Web Auth Service: http://localhost:9000"
fi

echo ""
echo "🚀 Next steps:"
echo "1. Run: npm run passport-ui"
echo "2. Open the Passport Reader UI in your browser"
echo "3. Test with mobile devices using the public URLs"
echo ""
echo "📱 Compatible wallets:"
echo "• walt.id Wallet: https://wallet.walt.id/"
echo "• Microsoft Authenticator"
echo "• Credible Wallet"
echo "• Any OID4VCI-compliant wallet"
