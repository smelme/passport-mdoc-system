const axios = require('axios');

// Comprehensive waltId API test script with correct formats
class WaltIdAPITester {
  constructor() {
    this.issuerUrl = 'http://localhost:7002';
    this.verifierUrl = 'http://localhost:7003';
    this.axiosConfig = {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }

  async testBasicConnectivity() {
    console.log('🔗 Testing Basic Connectivity');
    console.log('=============================');

    // Test issuer
    try {
      const response = await axios.get(`${this.issuerUrl}/`, this.axiosConfig);
      console.log('✅ Issuer API: Accessible');
    } catch (error) {
      console.log('❌ Issuer API: Not accessible');
    }

    // Test verifier
    try {
      const response = await axios.get(`${this.verifierUrl}/`, this.axiosConfig);
      console.log('✅ Verifier API: Accessible');
    } catch (error) {
      console.log('❌ Verifier API: Not accessible');
    }

    // Test OpenID configuration
    try {
      const response = await axios.get(`${this.verifierUrl}/.well-known/openid-configuration`, this.axiosConfig);
      console.log('✅ Verifier OpenID Configuration: Available');
      console.log(`   Issuer: ${response.data.issuer}`);
    } catch (error) {
      console.log('❌ Verifier OpenID Configuration: Not available');
    }
  }

  async testIssuanceWithCorrectFormat() {
    console.log('\n🎫 Testing Credential Issuance (waltId Format)');
    console.log('=============================================');

    // Based on error message: expects id.walt.issuer.issuance.IssuanceRequest
    const issuanceRequest = {
      "credentialData": {
        "@context": [
          "https://www.w3.org/2018/credentials/v1",
          "https://www.w3.org/2018/credentials/examples/v1"
        ],
        "type": ["VerifiableCredential", "UniversityDegreeCredential"],
        "issuer": "did:web:example.edu",
        "issuanceDate": new Date().toISOString(),
        "credentialSubject": {
          "id": "did:example:subject123",
          "name": "John Doe",
          "degree": {
            "type": "BachelorDegree",
            "name": "Bachelor of Science in Computer Science"
          }
        }
      },
      "issuerKey": {
        "type": "local",
        "id": "issuer-key"
      },
      "credentialFormat": "JWT"
    };

    try {
      console.log('📤 Sending issuance request...');
      const response = await axios.post(
        `${this.issuerUrl}/openid4vc/jwt/issue`,
        issuanceRequest,
        this.axiosConfig
      );

      console.log('✅ Credential issued successfully!');
      console.log('📄 Response:', JSON.stringify(response.data, null, 2));
      return response.data;

    } catch (error) {
      console.log('❌ Issuance failed:');
      if (error.response?.data) {
        console.log('Error details:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.log('Error:', error.message);
      }

      // Try alternative format
      console.log('\n🔄 Trying alternative format...');
      const altRequest = {
        "credential": issuanceRequest.credentialData,
        "issuerDid": "did:web:example.edu",
        "subjectDid": "did:example:subject123"
      };

      try {
        const altResponse = await axios.post(
          `${this.issuerUrl}/openid4vc/jwt/issue`,
          altRequest,
          this.axiosConfig
        );
        console.log('✅ Alternative format worked!');
        return altResponse.data;
      } catch (altError) {
        console.log('❌ Alternative format also failed');
      }
    }

    return null;
  }

  async testVerificationWithCorrectFormat(credential) {
    console.log('\n🔍 Testing Credential Verification (waltId Format)');
    console.log('=================================================');

    // Based on error message: expects request_credentials field
    const verificationRequest = {
      "request_credentials": credential ? [credential] : [{
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
      }],
      "presentation_definition": {
        "id": "verification-request",
        "input_descriptors": [{
          "id": "credential-verification",
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
      }
    };

    try {
      console.log('📤 Sending verification request...');
      const response = await axios.post(
        `${this.verifierUrl}/openid4vc/verify`,
        verificationRequest,
        this.axiosConfig
      );

      console.log('✅ Credential verified successfully!');
      console.log('📄 Response:', JSON.stringify(response.data, null, 2));
      return response.data;

    } catch (error) {
      console.log('❌ Verification failed:');
      if (error.response?.data) {
        console.log('Error details:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.log('Error:', error.message);
      }

      // Try simpler format
      console.log('\n🔄 Trying simpler format...');
      const simpleRequest = {
        "request_credentials": verificationRequest.request_credentials
      };

      try {
        const simpleResponse = await axios.post(
          `${this.verifierUrl}/openid4vc/verify`,
          simpleRequest,
          this.axiosConfig
        );
        console.log('✅ Simple format worked!');
        return simpleResponse.data;
      } catch (simpleError) {
        console.log('❌ Simple format also failed');
      }
    }

    return null;
  }

  async testCompleteFlow() {
    console.log('🚀 Testing Complete waltId Credential Flow');
    console.log('==========================================');

    // Step 1: Test connectivity
    await this.testBasicConnectivity();

    // Step 2: Try to issue a credential
    const issuedCredential = await this.testIssuanceWithCorrectFormat();

    // Step 3: Try to verify the credential
    const verificationResult = await this.testVerificationWithCorrectFormat(issuedCredential);

    // Summary
    console.log('\n📊 Test Summary');
    console.log('===============');
    console.log(`Issuer API: ${this.issuerUrl}`);
    console.log(`Verifier API: ${this.verifierUrl}`);
    console.log(`Issuance: ${issuedCredential ? '✅ Success' : '❌ Failed'}`);
    console.log(`Verification: ${verificationResult ? '✅ Success' : '❌ Failed'}`);

    if (!issuedCredential || !verificationResult) {
      console.log('\n💡 Troubleshooting Tips:');
      console.log('1. Check the Swagger UIs for exact API documentation');
      console.log('2. The services may need additional configuration (keys, DIDs)');
      console.log('3. Check service logs for more detailed error information');
      console.log('4. Ensure the waltId services are properly initialized');
    }
  }

  async getAPIInfo() {
    console.log('\n📖 API Information');
    console.log('==================');

    console.log('Issuer API Endpoints:');
    console.log(`  Swagger UI: ${this.issuerUrl}`);
    console.log(`  OpenID4VC Issue: ${this.issuerUrl}/openid4vc/jwt/issue`);

    console.log('\nVerifier API Endpoints:');
    console.log(`  Swagger UI: ${this.verifierUrl}`);
    console.log(`  OpenID4VC Verify: ${this.verifierUrl}/openid4vc/verify`);
    console.log(`  OpenID Config: ${this.verifierUrl}/.well-known/openid-configuration`);
    console.log(`  JWKS: ${this.verifierUrl}/jwks`);
  }
}

// Main execution
async function main() {
  const tester = new WaltIdAPITester();

  // Show API info
  tester.getAPIInfo();

  // Run complete test
  await tester.testCompleteFlow();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = WaltIdAPITester;
