const axios = require('axios');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const ISSUER_URL = 'http://localhost:7002';
const VERIFIER_URL = 'http://localhost:7003';

// Sample credential data
const sampleCredential = {
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://www.w3.org/2018/credentials/examples/v1"
  ],
  "type": ["VerifiableCredential", "UniversityDegreeCredential"],
  "issuer": {
    "id": "did:web:example.edu",
    "name": "Example University"
  },
  "issuanceDate": new Date().toISOString(),
  "credentialSubject": {
    "id": "did:example:subject123",
    "name": "John Doe",
    "degree": {
      "type": "BachelorDegree",
      "name": "Bachelor of Science in Computer Science"
    }
  }
};

class WaltIdTester {
  constructor() {
    this.axiosConfig = {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }

  async testIssuerAPI() {
    console.log('\n🔍 Testing Issuer API...');

    try {
      // Test basic connectivity
      const response = await axios.get(`${ISSUER_URL}/`, this.axiosConfig);
      console.log('✅ Issuer API is accessible');

      // Test various endpoints
      const endpoints = [
        '/health',
        '/api/v1/health',
        '/v1/health',
        '/openid4vc/issuer-metadata',
        '/.well-known/openid-credential-issuer',
        '/api/v1/credentials/issue',
        '/v1/credentials/issue'
      ];

      for (const endpoint of endpoints) {
        try {
          const res = await axios.get(`${ISSUER_URL}${endpoint}`, this.axiosConfig);
          console.log(`✅ Found endpoint: ${endpoint} (Status: ${res.status})`);
        } catch (error) {
          // Expected for some endpoints
        }
      }

    } catch (error) {
      console.log('❌ Issuer API not accessible:', error.message);
    }
  }

  async testVerifierAPI() {
    console.log('\n🔍 Testing Verifier API...');

    try {
      // Test basic connectivity
      const response = await axios.get(`${VERIFIER_URL}/`, this.axiosConfig);
      console.log('✅ Verifier API is accessible');

      // Test OpenID Connect configuration
      try {
        const oidcConfig = await axios.get(`${VERIFIER_URL}/.well-known/openid-configuration`, this.axiosConfig);
        console.log('✅ OpenID Configuration found');
        console.log('   Issuer:', oidcConfig.data.issuer);
        console.log('   Authorization endpoint:', oidcConfig.data.authorization_endpoint);
      } catch (error) {
        console.log('❌ OpenID Configuration not found');
      }

      // Test various endpoints
      const endpoints = [
        '/health',
        '/api/v1/health',
        '/v1/health',
        '/openid4vc/verifier-metadata',
        '/api/v1/verification/verify',
        '/v1/verification/verify'
      ];

      for (const endpoint of endpoints) {
        try {
          const res = await axios.get(`${VERIFIER_URL}${endpoint}`, this.axiosConfig);
          console.log(`✅ Found endpoint: ${endpoint} (Status: ${res.status})`);
        } catch (error) {
          // Expected for some endpoints
        }
      }

    } catch (error) {
      console.log('❌ Verifier API not accessible:', error.message);
    }
  }

  async testCredentialIssuance() {
    console.log('\n🎫 Testing Credential Issuance...');

    try {
      // Try different issuance endpoints with different payload formats
      const issuanceEndpoints = [
        '/openid4vc/jwt/issue'
      ];

      for (const endpoint of issuanceEndpoints) {
        try {
          console.log(`Trying endpoint: ${endpoint}`);

          // Try different payload formats
          const payloads = [
            // Format 1: Simple credential
            {
              credential: sampleCredential
            },
            // Format 2: With options
            {
              credential: sampleCredential,
              options: {
                proofType: 'jwt',
                proofPurpose: 'assertionMethod'
              }
            },
            // Format 3: OpenID4VC format
            {
              "type": "https://credentials.example.com/UniversityDegree",
              "format": "jwt_vc",
              "credential_definition": {
                "@context": [
                  "https://www.w3.org/2018/credentials/v1",
                  "https://www.w3.org/2018/credentials/examples/v1"
                ],
                "types": ["VerifiableCredential", "UniversityDegreeCredential"],
                "credentialSubject": {
                  "name": {"display": [{"name": "Name", "locale": "en-US"}]},
                  "degree": {"display": [{"name": "Degree", "locale": "en-US"}]}
                }
              }
            }
          ];

          for (let i = 0; i < payloads.length; i++) {
            try {
              console.log(`  Trying payload format ${i + 1}...`);
              const response = await axios.post(`${ISSUER_URL}${endpoint}`, payloads[i], this.axiosConfig);
              console.log(`✅ Credential issued successfully via ${endpoint} (Format ${i + 1})`);
              console.log('   Response:', response.data);
              return response.data;
            } catch (formatError) {
              if (formatError.response?.status === 400) {
                console.log(`   Format ${i + 1} returned 400 - endpoint exists but wrong format`);
              } else {
                console.log(`   Format ${i + 1} failed:`, formatError.response?.status || formatError.message);
              }
            }
          }

          console.log(`❌ All formats failed for ${endpoint}`);

        } catch (error) {
          console.log(`❌ Failed via ${endpoint}:`, error.response?.status || error.message);
        }
      }

      console.log('❌ No working issuance endpoint found');

    } catch (error) {
      console.log('❌ Credential issuance failed:', error.message);
    }
  }

  async testCredentialVerification(credential) {
    console.log('\n🔍 Testing Credential Verification...');

    // Create a sample credential for testing if none provided
    const testCredential = credential || {
      "@context": [
        "https://www.w3.org/2018/credentials/v1"
      ],
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

    try {
      // Try different verification endpoints
      const verificationEndpoints = [
        '/openid4vc/verify',
        '/api/v1/verification/verify',
        '/v1/verification/verify',
        '/verification/verify'
      ];

      for (const endpoint of verificationEndpoints) {
        try {
          console.log(`Trying endpoint: ${endpoint}`);

          const payload = {
            credential: testCredential,
            options: {
              checks: ['proof', 'expiration', 'issuer']
            }
          };

          const response = await axios.post(`${VERIFIER_URL}${endpoint}`, payload, this.axiosConfig);
          console.log(`✅ Credential verified successfully via ${endpoint}`);
          console.log('   Verification result:', response.data);
          return response.data;
        } catch (error) {
          if (error.response?.status === 400) {
            console.log(`   Endpoint ${endpoint} exists but wrong format (400)`);
          } else if (error.response?.status === 404) {
            // Expected for some endpoints
          } else {
            console.log(`❌ Failed via ${endpoint}:`, error.response?.status || error.message);
          }
        }
      }

      console.log('❌ No working verification endpoint found');

    } catch (error) {
      console.log('❌ Credential verification failed:', error.message);
    }
  }

  async runFullTest() {
    console.log('🚀 Starting waltId API Test Suite');
    console.log('=====================================');

    // Test basic connectivity
    await this.testIssuerAPI();
    await this.testVerifierAPI();

    // Test credential flow
    const issuedCredential = await this.testCredentialIssuance();
    await this.testCredentialVerification(issuedCredential);

    console.log('\n✨ Test suite completed!');
    console.log('========================');
    console.log('Note: Some endpoints may not be available depending on the waltId configuration.');
    console.log('Check the Swagger UIs for complete API documentation:');
    console.log(`  Issuer: ${ISSUER_URL}`);
    console.log(`  Verifier: ${VERIFIER_URL}`);
  }
}

// Run the tests
async function main() {
  const tester = new WaltIdTester();
  await tester.runFullTest();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = WaltIdTester;
