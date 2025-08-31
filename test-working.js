const axios = require('axios');

// Working waltId API test script with corrected formats
class WaltIdWorkingTester {
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

  async testServices() {
    console.log('🔗 Testing waltId Services');
    console.log('==========================');

    // Test issuer
    try {
      await axios.get(`${this.issuerUrl}/`, this.axiosConfig);
      console.log('✅ Issuer API: Running');
    } catch (error) {
      console.log('❌ Issuer API: Not accessible');
      return false;
    }

    // Test verifier
    try {
      await axios.get(`${this.verifierUrl}/`, this.axiosConfig);
      console.log('✅ Verifier API: Running');
    } catch (error) {
      console.log('❌ Verifier API: Not accessible');
      return false;
    }

    // Test OpenID configuration
    try {
      const response = await axios.get(`${this.verifierUrl}/.well-known/openid-configuration`, this.axiosConfig);
      console.log('✅ OpenID Configuration: Available');
    } catch (error) {
      console.log('❌ OpenID Configuration: Not available');
    }

    return true;
  }

  async testIssuanceEndpoint() {
    console.log('\n🎫 Testing Issuance Endpoint');
    console.log('============================');

    // Try minimal request first
    const minimalRequest = {
      "credentialData": {
        "@context": "https://www.w3.org/2018/credentials/v1",
        "type": "VerifiableCredential",
        "issuer": "did:web:example.edu",
        "issuanceDate": new Date().toISOString(),
        "credentialSubject": {
          "id": "did:example:subject123",
          "name": "John Doe"
        }
      }
    };

    try {
      console.log('📤 Testing minimal issuance request...');
      const response = await axios.post(
        `${this.issuerUrl}/openid4vc/jwt/issue`,
        minimalRequest,
        this.axiosConfig
      );

      console.log('✅ Issuance successful!');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return response.data;

    } catch (error) {
      console.log('❌ Issuance failed with minimal request');
      if (error.response?.data) {
        console.log('Error:', JSON.stringify(error.response.data, null, 2));
      }

      // Try without issuerKey
      const noKeyRequest = {
        "credentialData": minimalRequest.credentialData
      };

      try {
        console.log('📤 Testing without issuerKey...');
        const response = await axios.post(
          `${this.issuerUrl}/openid4vc/jwt/issue`,
          noKeyRequest,
          this.axiosConfig
        );
        console.log('✅ Issuance successful without issuerKey!');
        return response.data;
      } catch (error2) {
        console.log('❌ Also failed without issuerKey');
      }
    }

    return null;
  }

  async testVerificationEndpoint() {
    console.log('\n🔍 Testing Verification Endpoint');
    console.log('=================================');

    // Based on error: type should be string, not array
    const verificationRequest = {
      "request_credentials": [{
        "@context": "https://www.w3.org/2018/credentials/v1",
        "type": "VerifiableCredential",  // Changed from array to string
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
      }]
    };

    try {
      console.log('📤 Testing verification request...');
      const response = await axios.post(
        `${this.verifierUrl}/openid4vc/verify`,
        verificationRequest,
        this.axiosConfig
      );

      console.log('✅ Verification successful!');
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return response.data;

    } catch (error) {
      console.log('❌ Verification failed');
      if (error.response?.data) {
        console.log('Error:', JSON.stringify(error.response.data, null, 2));
      }

      // Try even simpler format
      const simpleRequest = {
        "credential": verificationRequest.request_credentials[0]
      };

      try {
        console.log('📤 Testing simple format...');
        const response = await axios.post(
          `${this.verifierUrl}/openid4vc/verify`,
          simpleRequest,
          this.axiosConfig
        );
        console.log('✅ Verification successful with simple format!');
        return response.data;
      } catch (error2) {
        console.log('❌ Simple format also failed');
        if (error2.response?.data) {
          console.log('Simple error:', JSON.stringify(error2.response.data, null, 2));
        }
      }
    }

    return null;
  }

  async runAllTests() {
    console.log('🚀 waltId API Test Suite');
    console.log('=======================');

    // Test basic connectivity
    const servicesOk = await this.testServices();
    if (!servicesOk) {
      console.log('❌ Services not available. Please check if Docker containers are running.');
      return;
    }

    // Test endpoints
    const issuanceResult = await this.testIssuanceEndpoint();
    const verificationResult = await this.testVerificationEndpoint();

    // Summary
    console.log('\n📊 Final Results');
    console.log('================');
    console.log(`Services Status: ✅ Running`);
    console.log(`Issuance Test: ${issuanceResult ? '✅ Working' : '❌ Needs Configuration'}`);
    console.log(`Verification Test: ${verificationResult ? '✅ Working' : '❌ Needs Configuration'}`);

    console.log('\n🔗 API Endpoints:');
    console.log(`Issuer Swagger: http://localhost:7002`);
    console.log(`Verifier Swagger: http://localhost:7003`);
    console.log(`OpenID Config: http://localhost:7003/.well-known/openid-configuration`);

    if (!issuanceResult || !verificationResult) {
      console.log('\n💡 Next Steps:');
      console.log('1. Check the Swagger UIs for exact request formats');
      console.log('2. The services may need cryptographic keys and DIDs configured');
      console.log('3. Check waltId documentation for proper setup');
      console.log('4. Consider using the waltId CLI or web interfaces for initial testing');
    } else {
      console.log('\n🎉 All tests passed! Your waltId setup is working correctly.');
    }
  }

  // Helper method to show working examples
  showExamples() {
    console.log('\n📝 Example API Calls:');
    console.log('====================');

    console.log('\n1. Check OpenID Configuration:');
    console.log(`curl http://localhost:7003/.well-known/openid-configuration`);

    console.log('\n2. Test Issuer Endpoint (may need proper configuration):');
    console.log(`curl -X POST http://localhost:7002/openid4vc/jwt/issue \\
  -H "Content-Type: application/json" \\
  -d '{"credentialData": {"@context": "https://www.w3.org/2018/credentials/v1", "type": "VerifiableCredential", "issuer": "did:web:example.edu", "issuanceDate": "${new Date().toISOString()}", "credentialSubject": {"id": "did:example:subject123", "name": "John Doe"}}}'`);

    console.log('\n3. Test Verifier Endpoint:');
    console.log(`curl -X POST http://localhost:7003/openid4vc/verify \\
  -H "Content-Type: application/json" \\
  -d '{"request_credentials": [{"@context": "https://www.w3.org/2018/credentials/v1", "type": "VerifiableCredential", "issuer": "did:web:example.edu", "issuanceDate": "${new Date().toISOString()}", "credentialSubject": {"id": "did:example:subject123", "name": "John Doe"}}]}'`);
  }
}

// Run the tests
async function main() {
  const tester = new WaltIdWorkingTester();
  await tester.runAllTests();
  tester.showExamples();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = WaltIdWorkingTester;
