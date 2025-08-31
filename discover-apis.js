const axios = require('axios');

// Test script to discover waltId API endpoints and formats
class WaltIdDiscovery {
  constructor() {
    this.issuerUrl = 'http://localhost:7002';
    this.verifierUrl = 'http://localhost:7003';
    this.axiosConfig = {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }

  async discoverEndpoints() {
    console.log('🔍 Discovering waltId API Endpoints');
    console.log('=====================================');

    // Test issuer endpoints
    console.log('\n🏛️  ISSUER API ENDPOINTS:');
    const issuerEndpoints = [
      '/',
      '/health',
      '/swagger',
      '/api',
      '/v1',
      '/openid4vc',
      '/openid4vc/jwt',
      '/openid4vc/jwt/issue',
      '/openid4vc/credential',
      '/.well-known/openid-credential-issuer',
      '/api/v1/credentials',
      '/v1/credentials'
    ];

    for (const endpoint of issuerEndpoints) {
      try {
        const response = await axios.get(`${this.issuerUrl}${endpoint}`, this.axiosConfig);
        console.log(`✅ ${endpoint} - Status: ${response.status}`);
      } catch (error) {
        const status = error.response?.status || 'ERROR';
        console.log(`❌ ${endpoint} - Status: ${status}`);
      }
    }

    // Test verifier endpoints
    console.log('\n🔍 VERIFIER API ENDPOINTS:');
    const verifierEndpoints = [
      '/',
      '/health',
      '/swagger',
      '/api',
      '/v1',
      '/openid4vc',
      '/openid4vc/verify',
      '/.well-known/openid-configuration',
      '/authorize',
      '/token',
      '/jwks',
      '/api/v1/verification',
      '/v1/verification'
    ];

    for (const endpoint of verifierEndpoints) {
      try {
        const response = await axios.get(`${this.verifierUrl}${endpoint}`, this.axiosConfig);
        console.log(`✅ ${endpoint} - Status: ${response.status}`);
      } catch (error) {
        const status = error.response?.status || 'ERROR';
        console.log(`❌ ${endpoint} - Status: ${status}`);
      }
    }
  }

  async testOpenID4VCFormats() {
    console.log('\n🎫 Testing OpenID4VC Issuance Formats');
    console.log('=====================================');

    const formats = [
      {
        name: 'Simple Credential',
        payload: {
          credential: {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "type": ["VerifiableCredential"],
            "issuer": "did:web:example.edu",
            "issuanceDate": new Date().toISOString(),
            "credentialSubject": {
              "id": "did:example:subject123",
              "name": "John Doe"
            }
          }
        }
      },
      {
        name: 'OpenID4VCI Draft',
        payload: {
          "types": ["VerifiableCredential", "UniversityDegreeCredential"],
          "format": "jwt_vc",
          "proof": {
            "proof_type": "jwt",
            "jwt": null
          }
        }
      },
      {
        name: 'waltId Format',
        payload: {
          "credentialData": {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "type": ["VerifiableCredential"],
            "issuer": "did:web:example.edu",
            "issuanceDate": new Date().toISOString(),
            "credentialSubject": {
              "id": "did:example:subject123",
              "name": "John Doe"
            }
          },
          "issuerKey": {
            "type": "local",
            "id": "issuer-key"
          },
          "credentialFormat": "JWT"
        }
      }
    ];

    for (const format of formats) {
      console.log(`\n📝 Testing: ${format.name}`);
      try {
        const response = await axios.post(
          `${this.issuerUrl}/openid4vc/jwt/issue`,
          format.payload,
          this.axiosConfig
        );
        console.log(`✅ SUCCESS with ${format.name}!`);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        return response.data;
      } catch (error) {
        if (error.response?.status === 400) {
          console.log(`❌ 400 Bad Request - Wrong format for ${format.name}`);
          if (error.response.data) {
            console.log('Error details:', error.response.data);
          }
        } else {
          console.log(`❌ ${error.response?.status || 'ERROR'} for ${format.name}:`, error.message);
        }
      }
    }

    return null;
  }

  async testVerificationFormats(credential) {
    console.log('\n🔍 Testing Verification Formats');
    console.log('================================');

    const testCredential = credential || {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      "type": ["VerifiableCredential"],
      "issuer": "did:web:example.edu",
      "issuanceDate": new Date().toISOString(),
      "credentialSubject": {
        "id": "did:example:subject123",
        "name": "John Doe"
      },
      "proof": {
        "type": "Ed25519Signature2020",
        "created": new Date().toISOString(),
        "verificationMethod": "did:web:example.edu#key-1",
        "proofPurpose": "assertionMethod",
        "proofValue": "sample-proof-value"
      }
    };

    const formats = [
      {
        name: 'Simple Credential',
        payload: {
          credential: testCredential
        }
      },
      {
        name: 'OpenID4VP Format',
        payload: {
          "presentation_definition": {
            "id": "vp-request",
            "input_descriptors": [{
              "id": "credential-request",
              "format": {"jwt_vc": {}},
              "constraints": {
                "fields": [{
                  "path": ["$.type"],
                  "filter": {
                    "type": "array",
                    "contains": {"const": "VerifiableCredential"}
                  }
                }]
              }
            }]
          },
          "vp_token": "sample-jwt-token"
        }
      }
    ];

    for (const format of formats) {
      console.log(`\n📝 Testing: ${format.name}`);
      try {
        const response = await axios.post(
          `${this.verifierUrl}/openid4vc/verify`,
          format.payload,
          this.axiosConfig
        );
        console.log(`✅ SUCCESS with ${format.name}!`);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        return response.data;
      } catch (error) {
        if (error.response?.status === 400) {
          console.log(`❌ 400 Bad Request - Wrong format for ${format.name}`);
          if (error.response.data) {
            console.log('Error details:', error.response.data);
          }
        } else {
          console.log(`❌ ${error.response?.status || 'ERROR'} for ${format.name}:`, error.message);
        }
      }
    }

    return null;
  }

  async runDiscovery() {
    await this.discoverEndpoints();
    const issuedCredential = await this.testOpenID4VCFormats();
    await this.testVerificationFormats(issuedCredential);

    console.log('\n✨ Discovery completed!');
    console.log('=======================');
    console.log('\n💡 Tips:');
    console.log('1. Check the Swagger UIs for detailed API documentation');
    console.log('2. The 400 errors indicate endpoints exist but need correct format');
    console.log('3. Look for waltId-specific API documentation for exact payload formats');
    console.log('4. Consider checking the service logs for more details on expected formats');
  }
}

// Run discovery
async function main() {
  const discovery = new WaltIdDiscovery();
  await discovery.runDiscovery();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = WaltIdDiscovery;
