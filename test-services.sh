#!/bin/bash

# waltId Service Health Check Script

echo "=== waltId Service Health Check ==="
echo

# Function to check service
check_service() {
    local url=$1
    local name=$2

    echo "Checking $name ($url)..."
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo "✅ $name is running"
        return 0
    else
        echo "❌ $name is not responding"
        return 1
    fi
}

# Check services
ISSUER_OK=0
VERIFIER_OK=0

check_service "http://localhost:7002/health" "Issuer API" && ISSUER_OK=1
check_service "http://localhost:7003/health" "Verifier API" && VERIFIER_OK=1
check_service "http://localhost/health" "Reverse Proxy"

echo
echo "=== OpenID4VC Endpoint Tests ==="

# Test OpenID4VC endpoints
if [ $ISSUER_OK -eq 1 ]; then
    echo "Testing issuer OpenID4VC endpoints..."
    curl -s "http://localhost:7002/openid4vc/issuer-metadata" | head -5
    echo
fi

if [ $VERIFIER_OK -eq 1 ]; then
    echo "Testing verifier OpenID4VC endpoints..."
    curl -s "http://localhost:7003/openid4vc/verifier-metadata" | head -5
    echo
fi

echo "=== Test Complete ==="
echo "Use 'docker-compose logs' to see detailed service logs if needed."
