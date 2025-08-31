#!/usr/bin/env node
/**
 * mDoc PKI Setup Script
 * 
 * Sets up the required IACA and Document Signer certificates
 * for mDoc issuance with walt.id according to ISO 18013-5 standards.
 */

import axios from 'axios';
import { writeFile } from 'fs/promises';

const ISSUER_BASE = 'http://localhost:7002';

class MDLPKISetup {
  constructor() {
    this.issuerBaseUrl = ISSUER_BASE;
  }

  async onboardIACA() {
    console.log('🏛️ Onboarding IACA (Issuing Authority Certification Authority)...');
    
    const iacaRequest = {
      certificateData: {
        country: "US",
        commonName: "Passport IACA Test",
        issuerAlternativeNameConf: {
          uri: "https://passport-issuer.example.com"
        }
      }
    };

    console.log('🔍 DEBUG: IACA request:', JSON.stringify(iacaRequest, null, 2));

    try {
      const { data } = await axios.post(`${this.issuerBaseUrl}/onboard/iso-mdl/iacas`, iacaRequest, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('✅ IACA onboarded successfully');
      console.log('🔑 IACA Key ID:', data.iacaKey.jwk.kid);
      
      return data;
    } catch (error) {
      if (error.response) {
        console.error('❌ IACA onboarding failed:', error.response.status, error.response.data);
        throw new Error(`IACA onboarding failed: ${error.response.data.message || error.response.statusText}`);
      }
      throw error;
    }
  }

  async onboardDocumentSigner(iacaData) {
    console.log('📝 Onboarding Document Signer...');
    
    const dsRequest = {
      iacaSigner: {
        iacaKey: iacaData.iacaKey,
        certificateData: iacaData.certificateData
      },
      certificateData: {
        country: "US",
        commonName: "Passport Document Signer Test",
        crlDistributionPointUri: "https://passport-issuer.example.com/crl"
      }
    };

    console.log('🔍 DEBUG: DS request keys:', Object.keys(dsRequest));

    try {
      const { data } = await axios.post(`${this.issuerBaseUrl}/onboard/iso-mdl/document-signers`, dsRequest, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('✅ Document Signer onboarded successfully');
      console.log('🔑 DS Key ID:', data.documentSignerKey.jwk.kid);
      
      return data;
    } catch (error) {
      if (error.response) {
        console.error('❌ Document Signer onboarding failed:', error.response.status, error.response.data);
        throw new Error(`DS onboarding failed: ${error.response.data.message || error.response.statusText}`);
      }
      throw error;
    }
  }

  async setupFullPKI() {
    console.log('🚀 Setting up mDoc PKI infrastructure...');
    
    try {
      // Step 1: Onboard IACA
      const iacaData = await this.onboardIACA();
      
      // Step 2: Onboard Document Signer
      const dsData = await this.onboardDocumentSigner(iacaData);
      
      // Combine all data for mDoc issuance
      const pkiSetup = {
        iaca: iacaData,
        documentSigner: dsData,
        setup: {
          issuerKey: dsData.documentSignerKey,
          x5Chain: [dsData.certificatePEM],
          createdAt: new Date().toISOString()
        }
      };
      
      // Save PKI setup for use in mDoc issuer
      await writeFile('mdoc-pki-setup.json', JSON.stringify(pkiSetup, null, 2));
      console.log('💾 PKI setup saved to: mdoc-pki-setup.json');
      
      console.log('\n🎉 PKI Setup Complete!');
      console.log('📋 Summary:');
      console.log('   - IACA Certificate:', iacaData.certificatePEM ? 'Created' : 'Failed');
      console.log('   - Document Signer Certificate:', dsData.certificatePEM ? 'Created' : 'Failed');
      console.log('   - Ready for mDoc issuance:', 'Yes');
      
      return pkiSetup;
      
    } catch (error) {
      console.error('❌ PKI setup failed:', error.message);
      throw error;
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
🎫 mDoc PKI Setup

Usage:
  node setup-mdoc-pki.js

This script sets up the required PKI infrastructure for mDoc issuance:
1. Creates an IACA (Issuing Authority Certification Authority)
2. Creates a Document Signer certificate
3. Saves the configuration for use with the mDoc issuer

Output:
  - mdoc-pki-setup.json: Contains all PKI data for mDoc issuance
    `);
    process.exit(0);
  }

  const setup = new MDLPKISetup();
  
  try {
    await setup.setupFullPKI();
    console.log('\n🎯 Next Step: Use this PKI setup with the mDoc issuer');
    console.log('   node mdoc-issuer.js --web-id="your@email.com" --use-pki');
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || 
    import.meta.url.endsWith('setup-mdoc-pki.js')) {
  main();
}

export { MDLPKISetup };
