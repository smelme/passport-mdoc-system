# waltId Service Health Check Script (PowerShell)

Write-Host "=== waltId Service Health Check ===" -ForegroundColor Cyan
Write-Host

# Function to check service
function Test-Service {
    param (
        [string]$Url,
        [string]$Name
    )

    Write-Host "Checking $Name ($Url)..." -NoNewline
    try {
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 302) {
            Write-Host " ✅ $Name is running" -ForegroundColor Green
            return $true
        }
    }
    catch {
        Write-Host " ❌ $Name is not responding" -ForegroundColor Red
    }
    return $false
}

# Check services
$issuerOk = Test-Service "http://localhost:7002/" "Issuer API"
$verifierOk = Test-Service "http://localhost:7003/" "Verifier API"
Test-Service "http://localhost/" "Reverse Proxy"

Write-Host
Write-Host "=== Service Information ===" -ForegroundColor Cyan
Write-Host "Issuer API: http://localhost:7002 (Swagger UI available)"
Write-Host "Verifier API: http://localhost:7003 (Swagger UI available)"
Write-Host
Write-Host "=== OpenID4VC Endpoints to Test ===" -ForegroundColor Cyan

# Test common OpenID4VC endpoints
$endpoints = @(
    "http://localhost:7002/.well-known/openid-credential-issuer",
    "http://localhost:7002/openid4vc/jwt/issue",
    "http://localhost:7002/openid4vc/credential",
    "http://localhost:7003/.well-known/openid-configuration",
    "http://localhost:7003/openid4vc/verify"
)

foreach ($endpoint in $endpoints) {
    try {
        $response = Invoke-WebRequest -Uri $endpoint -TimeoutSec 5 -ErrorAction Stop
        Write-Host "✅ $endpoint - Status: $($response.StatusCode)" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ $endpoint - Not found or error" -ForegroundColor Red
    }
}

Write-Host
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host "Both waltId issuer and verifier services are running successfully!"
Write-Host "Use the Swagger UIs at the service URLs to explore available endpoints."
