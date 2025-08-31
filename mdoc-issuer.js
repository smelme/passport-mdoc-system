#!/usr/bin/env node
/**
 * mDoc Credential Offer Generator for Passport Data
 * 
 * This script generates standard OID4VCI credential offers for passport mDocs
 * that can be scanned with any compatible wallet app (QR code or manual entry).
 * 
 * Features:
 * - Standard OID4VCI credential offers
 * - Wallet-agnostic QR codes
 * - Custom web ID claims for authentication
 * - ISO 18013-5 compliant mDocs
 * - PKI setup with IACA/Document Signer certificates
 * - Compatible with any OID4VCI wallet
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { generateKeyPair, SignJWT, exportJWK } from 'jose';
import { PassportDataReader } from './passport-nfc-reader.js';
import qrcode from 'qrcode-terminal';

// Make crypto globally available for jose library
global.crypto = crypto;

const ISSUER_BASE = 'http://localhost:7002';
const VERIFIER_BASE = 'http://localhost:7003';
const STANDARD_VERSION = 'draft13';

class PassportMDocIssuer {
  constructor() {
    this.issuerBaseUrl = ISSUER_BASE;
  }

  async discoverIssuerConfig() {
    const url = `${this.issuerBaseUrl}/${STANDARD_VERSION}/.well-known/openid-credential-issuer`;
    const { data } = await axios.get(url);
    return data;
  }

  async generateCoseKey() {
    // Generate COSE key for mDoc (ES256 as required by walt.id)
    const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
    const jwk = await exportJWK(privateKey);
    jwk.kid = crypto.randomUUID();
    jwk.alg = 'ES256';
    return { jwk, privateKey, publicKey };
  }

  buildPassportMDocData(passportData, webId) {
    // Build the mDoc credential data with passport information and custom web ID
    const credentialData = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/citizenship/v1'
      ],
      type: ['VerifiableCredential', 'PassportCredential'],
      issuer: { 
        name: 'Digital Passport Authority',
        id: 'did:web:passport-issuer.example.com'
      },
      credentialSubject: {
        id: webId || `did:web:citizen-${uuidv4()}`,
        
        // Standard passport fields from NFC data
        familyName: passportData.data['org.iso.18013.5.1'].family_name,
        givenName: passportData.data['org.iso.18013.5.1'].given_name,
        birthDate: passportData.data['org.iso.18013.5.1'].birth_date,
        gender: passportData.data['org.iso.18013.5.1'].sex === 1 ? 'M' : 'F',
        nationality: passportData.data['org.iso.18013.5.1'].nationality,
        
        // Document details
        passportNumber: passportData.data['org.iso.18013.5.1'].document_number,
        issuingCountry: passportData.data['org.iso.18013.5.1'].issuing_country,
        expiryDate: passportData.data['org.iso.18013.5.1'].expiry_date,
        
        // Verification metadata
        nfcVerified: true,
        verificationLevel: passportData.data['com.yourcompany.webauth'].passport_verification_level,
        verificationTimestamp: passportData.data['com.yourcompany.webauth'].verification_timestamp,
        
        // Custom web authentication claims
        webId: webId,
        authenticationMethod: 'passport_nfc',
        biometricLevel: passportData.data['org.iso.18013.5.1'].portrait ? 'photo_verified' : 'document_only'
      }
    };

    return credentialData;
  }

  buildMDocMapping(passportData, webId) {
    // Create the mapping for mDoc issuance
    return {
      id: uuidv4(),
      issuer: { 
        id: 'did:web:passport-issuer.example.com',
        name: 'Digital Passport Authority'
      },
      credentialSubject: { 
        id: webId || `did:web:citizen-${uuidv4()}`
      },
      issuanceDate: new Date().toISOString(),
      expirationDate: passportData.data['org.iso.18013.5.1'].expiry_date,
      
      // mDoc specific fields
      doctype: 'org.iso.18013.5.1.mDL',
      
      // Namespace mappings for mDoc
      namespaces: {
        'org.iso.18013.5.1': passportData.data['org.iso.18013.5.1'],
        'com.yourcompany.webauth': {
          ...passportData.data['com.yourcompany.webauth'],
          web_id: webId
        }
      }
    };
  }

  async loadPKISetup() {
    try {
      const fs = await import('fs/promises');
      const pkiData = await fs.readFile('mdoc-pki-setup.json', 'utf8');
      return JSON.parse(pkiData);
    } catch (error) {
      console.error('❌ Could not load PKI setup. Run: node setup-mdoc-pki.js');
      throw new Error('PKI setup not found. Please run setup-mdoc-pki.js first.');
    }
  }

  async issueMDoc(passportData, webId, issuerKey, x5Chain) {
    console.log('📝 Preparing mDoc issuance request...');
    
    // Exact structure from walt.id documentation with required x5Chain
    const issuanceRequest = {
      issuerKey: { type: 'jwk', jwk: issuerKey },
      credentialConfigurationId: 'org.iso.18013.5.1.mDL',
      mdocData: {
        // Direct namespace mapping as shown in documentation
        'org.iso.18013.5.1': passportData.data['org.iso.18013.5.1'],
        'com.yourcompany.webauth': {
          ...passportData.data['com.yourcompany.webauth'],
          web_id: webId
        }
      },
      // x5Chain is mandatory - document signer certificate
      x5Chain: x5Chain || []
    };

    console.log('🚀 Sending mDoc issuance request to walt.id...');
    console.log('🔍 DEBUG: Request URL:', `${this.issuerBaseUrl}/openid4vc/mdoc/issue`);
    console.log('🔍 DEBUG: Request payload:', JSON.stringify(issuanceRequest, null, 2));
    
    try {
      const { data } = await axios.post(`${this.issuerBaseUrl}/openid4vc/mdoc/issue`, issuanceRequest, {
        headers: { 
          'Content-Type': 'application/json',
          'sessionTtl': '300'
        }
      });
      
      return data; // Returns credential offer URL
    } catch (error) {
      if (error.response) {
        console.error('❌ Issuance failed:', error.response.status, error.response.data);
        throw new Error(`Issuance failed: ${error.response.data.message || error.response.statusText}`);
      }
      throw error;
    }
  }

  async parseCredentialOffer(offerUrl) {
    // Parse the credential offer URL to extract the offer details
    const query = offerUrl.split('?')[1] || '';
    const params = new URLSearchParams(query);
    
    if (params.get('credential_offer')) {
      const raw = params.get('credential_offer');
      const decoded = decodeURIComponent(raw);
      return JSON.parse(decoded);
    }
    
    const offerUri = params.get('credential_offer_uri');
    if (offerUri) {
      const { data } = await axios.get(offerUri);
      return data;
    }
    
    throw new Error('No credential offer found in URL');
  }

  async processFullIssuance(passportData, webId, usePKI = false) {
    try {
      console.log('🎫 Starting mDoc credential offer generation...');
      
      let issuerKey, x5Chain;
      
      if (usePKI) {
        console.log('🔐 Loading PKI setup...');
        const pkiSetup = await this.loadPKISetup();
        issuerKey = pkiSetup.setup.issuerKey.jwk;
        x5Chain = pkiSetup.setup.x5Chain;
        console.log('✅ PKI loaded - using Document Signer certificate');
      } else {
        // Generate keys (will likely fail without proper certificates)
        console.log('🔑 Generating issuer key (testing mode)...');
        const keyData = await this.generateCoseKey();
        issuerKey = keyData.jwk;
        x5Chain = []; // Empty - will likely cause issues
        console.log('⚠️  Warning: No PKI setup - may fail without proper certificates');
      }

      // Generate credential offer URL
      const offerUrl = await this.issueMDoc(passportData, webId, issuerKey, x5Chain);
      console.log('✅ Credential offer created:', offerUrl);

      // Parse offer to show details
      const offer = await this.parseCredentialOffer(offerUrl);
      console.log('📋 Credential offer details:');
      console.log('   - Issuer:', offer.credential_issuer);
      console.log('   - Credential Types:', offer.credential_configuration_ids || offer.credentials);
      
      const grant = offer?.grants && (
        offer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code'] || 
        offer.grants['pre-authorized_code']
      );
      
      if (grant) {
        console.log('   - Grant Type: Pre-authorized code');
        console.log('   - User PIN Required:', grant.user_pin_required || false);
      }

      return {
        credentialOffer: {
          url: offerUrl,
          offer: offer,
          qrCodeData: offerUrl // This URL can be converted to QR code
        },
        metadata: {
          webId: webId,
          issuanceDate: new Date().toISOString(),
          doctype: 'org.iso.18013.5.1.mDL',
          passportNumber: passportData.data['org.iso.18013.5.1'].document_number,
          issuer: offer.credential_issuer
        }
      };

    } catch (error) {
      console.error('❌ Credential offer generation failed:', error.message);
      throw error;
    }
  }

  generateQRCodeDisplay(offerUrl) {
    console.log('\n📱 QR Code for Wallet Scanning:');
    
    // Generate actual QR code in terminal
    qrcode.generate(offerUrl, { small: true }, (qrString) => {
      console.log(qrString);
    });
    
    console.log('\n📋 Credential Offer URL:');
    console.log(offerUrl);
    console.log('\n💡 Scan this QR code with any compatible wallet app!');
    console.log('   Examples: walt.id wallet, Credible, Microsoft Authenticator, etc.');
    console.log('\n🌐 Or copy the URL manually into wallet\'s credential offer field');
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  let passportData = null;
  let webId = null;
  let usePKI = false;

  // Parse command line arguments
  for (const arg of args) {
    if (arg.startsWith('--passport-data=')) {
      passportData = JSON.parse(arg.substring('--passport-data='.length));
    } else if (arg.startsWith('--web-id=')) {
      webId = arg.substring('--web-id='.length);
    } else if (arg === '--use-pki') {
      usePKI = true;
    } else if (arg === '--help') {
      console.log(`
🎫 Passport mDoc Credential Offer Generator

Usage:
  node mdoc-issuer.js --web-id="user@example.com" [options]
  node mdoc-issuer.js --help

Options:
  --web-id=ID          Your web ID for authentication (required)
  --passport-data=JSON Passport data from NFC reader (optional, will prompt for NFC read)
  --use-pki           Use proper PKI setup (requires: node setup-mdoc-pki.js)
  --help              Show this help message

Examples:
  # Generate credential offer with proper PKI setup (recommended)
  node setup-mdoc-pki.js
  node mdoc-issuer.js --web-id="alice@example.com" --use-pki
  
  # Generate credential offer in testing mode (may fail)
  node mdoc-issuer.js --web-id="alice@example.com"

Output:
  - QR code for wallet scanning
  - Credential offer URL for manual entry
  - Compatible with any OID4VCI wallet app
      `);
      process.exit(0);
    }
  }

  if (!webId) {
    console.error('❌ Web ID is required. Use --web-id="your@email.com"');
    process.exit(1);
  }

  console.log('🚀 Starting Passport mDoc Credential Offer Generator');
  console.log('🆔 Web ID:', webId);
  console.log('🔐 PKI Mode:', usePKI ? 'Enabled' : 'Disabled (testing mode)');

  const issuer = new PassportMDocIssuer();

  try {
    // If no passport data provided, read from mock passport reader
    if (!passportData) {
      console.log('📱 No passport data provided, starting passport reader...');
      const reader = new PassportDataReader();
      passportData = await reader.startReading();
      console.log('✅ Passport data read successfully');
    }

    // Process the issuance
    const result = await issuer.processFullIssuance(passportData, webId, usePKI);
    
    console.log('\n🎉 SUCCESS! Credential offer generated successfully');
    
    // Display QR code
    issuer.generateQRCodeDisplay(result.credentialOffer.url);
    
    console.log('\n📱 Credential Offer Details:');
    console.log('   - Document Type:', result.metadata.doctype);
    console.log('   - Passport Number:', result.metadata.passportNumber);
    console.log('   - Web ID:', result.metadata.webId);
    console.log('   - Issuance Date:', result.metadata.issuanceDate);
    console.log('   - Issuer:', result.metadata.issuer);
    
    console.log('\n💾 Saving credential offer...');
    
    // Save the results
    const fs = await import('fs/promises');
    await fs.writeFile('credential-offer.json', JSON.stringify(result, null, 2));
    console.log('✅ Saved to: credential-offer.json');
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Scan QR code with any compatible wallet:');
    console.log('   • walt.id wallet (https://wallet.walt.id/)');
    console.log('   • Microsoft Authenticator');  
    console.log('   • Credible Wallet');
    console.log('   • Any OID4VCI-compliant wallet');
    console.log('2. Or copy the credential offer URL manually into wallet');
    console.log('3. Use mDoc for web authentication or verification');
    console.log('4. Present at any walt.id verifier-compatible service');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly (not when imported)
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  main();
}

export { PassportMDocIssuer };
