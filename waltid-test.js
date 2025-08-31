const axios = require('axios');

// waltId API Test Script - Ready to use with your setup
class WaltIdTester {
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

  async testConnectivity() {
    console.log('🔗 Testing waltId Services Connectivity');
    console.log('======================================');

    try {
      // Test issuer
      await axios.get(`${this.issuerUrl}/`, this.axiosConfig);
      console.log('✅ Issuer API: http://localhost:7002');

      // Test verifier
      await axios.get(`${this.verifierUrl}/`, this.axiosConfig);
      console.log('✅ Verifier API: http://localhost:7003');

      // Test OpenID configuration
      const oidcResponse = await axios.get(`${this.verifierUrl}/.well-known/openid-configuration`, this.axiosConfig);
      console.log('✅ OpenID Configuration available');

      return true;
    } catch (error) {
      console.log('❌ Service connectivity test failed');
      console.log('Make sure Docker containers are running:');
      console.log('  docker-compose ps');
      console.log('  docker-compose logs');
      return false;
    }
  }

  async testEndpoints() {
    console.log('\n🔍 Testing API Endpoints');
    console.log('========================');

    const endpoints = [
      { url: `${this.issuerUrl}/openid4vc/jwt/issue`, method: 'POST', name: 'Issuer OpenID4VC JWT' },
      { url: `${this.verifierUrl}/openid4vc/verify`, method: 'POST', name: 'Verifier OpenID4VC' },
      { url: `${this.verifierUrl}/.well-known/openid-configuration`, method: 'GET', name: 'OpenID Configuration' },
      { url: `${this.verifierUrl}/jwks`, method: 'GET', name: 'JWKS' }
    ];

    for (const endpoint of endpoints) {
      try {
        let response;
        if (endpoint.method === 'GET') {
          response = await axios.get(endpoint.url, this.axiosConfig);
        } else {
          // For POST endpoints, just test if they exist (will get 400 for wrong format)
          response = await axios.post(endpoint.url, {}, this.axiosConfig);
        }
        console.log(`✅ ${endpoint.name}: Available`);
      } catch (error) {
        if (error.response?.status === 400) {
          console.log(`✅ ${endpoint.name}: Available (needs correct request format)`);
        } else if (error.response?.status === 404) {
          console.log(`❌ ${endpoint.name}: Not found`);
        } else {
          console.log(`❓ ${endpoint.name}: ${error.response?.status || 'Unknown status'}`);
        }
      }
    }
  }

  async demonstrateAPIUsage() {
    console.log('\n📚 waltId API Usage Examples');
    console.log('============================');

    console.log('\n1. Check Service Status:');
    console.log('curl http://localhost:7002/');
    console.log('curl http://localhost:7003/');

    console.log('\n2. Get OpenID Configuration:');
    console.log('curl http://localhost:7003/.well-known/openid-configuration');

    console.log('\n3. Get JWKS (JSON Web Key Set):');
    console.log('curl http://localhost:7003/jwks');

    console.log('\n4. Test Issuer Endpoint (requires proper configuration):');
    console.log(`curl -X POST http://localhost:7002/openid4vc/jwt/issue \\
  -H "Content-Type: application/json" \\
  -d '{
    "credentialData": {
      "@context": "https://www.w3.org/2018/credentials/v1",
      "type": "VerifiableCredential",
      "issuer": "did:web:example.edu",
      "issuanceDate": "${new Date().toISOString()}",
      "credentialSubject": {
        "id": "did:example:subject123",
        "name": "John Doe"
      }
    }
  }'`);

    console.log('\n5. Test Verifier Endpoint:');
    console.log(`curl -X POST http://localhost:7003/openid4vc/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "request_credentials": [{
      "@context": "https://www.w3.org/2018/credentials/v1",
      "type": "VerifiableCredential",
      "issuer": "did:web:example.edu",
      "issuanceDate": "${new Date().toISOString()}",
      "credentialSubject": {
        "id": "did:example:subject123",
        "name": "John Doe"
      }
    }]
  }'`);
  }

  async showNextSteps() {
    console.log('\n🚀 Next Steps for Full waltId Setup');
    console.log('===================================');

    console.log('\n1. Configure Cryptographic Keys:');
    console.log('   - The services need cryptographic keys for signing credentials');
    console.log('   - Check waltId documentation for key management');

    console.log('\n2. Set up DIDs (Decentralized Identifiers):');
    console.log('   - Configure issuer and subject DIDs');
    console.log('   - Register DIDs on a blockchain or DID registry');

    console.log('\n3. Configure Credential Schemas:');
    console.log('   - Define the structure of credentials you want to issue');
    console.log('   - Use waltId credential schemas or create custom ones');

    console.log('\n4. Test with waltId Web Interfaces:');
    console.log('   - Use the Swagger UIs for interactive testing');
    console.log('   - Check the waltId web wallet and portal');

    console.log('\n5. Integration:');
    console.log('   - Integrate with your application using the REST APIs');
    console.log('   - Implement proper error handling and validation');

    console.log('\n📖 Resources:');
    console.log('   - waltId Documentation: https://docs.walt.id/');
    console.log('   - OpenID4VC Specification: https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html');
    console.log('   - waltId GitHub: https://github.com/walt-id/waltid-identity');
  }

  async run() {
    console.log('🎯 waltId API Test & Setup Guide');
    console.log('=================================');

    const connected = await this.testConnectivity();
    if (!connected) {
      console.log('\n❌ Cannot connect to waltId services.');
      console.log('Please ensure Docker containers are running:');
      console.log('  docker-compose up -d');
      return;
    }

    await this.testEndpoints();
    await this.demonstrateAPIUsage();
    await this.showNextSteps();

    console.log('\n✨ waltId setup verification complete!');
    console.log('Your services are running and ready for configuration.');
  }
}

// Export for use as module
module.exports = WaltIdTester;

// Run if called directly
if (require.main === module) {
  const tester = new WaltIdTester();
  tester.run().catch(console.error);
}
