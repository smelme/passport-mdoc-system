#!/usr/bin/env node
/**
 * E2E Testing Setup for Mobile QR Code Scanning
 * 
 * This script creates public URLs for localhost services using ngrok,
 * enabling mobile devices to scan QR codes and complete the full flow.
 */

import ngrok from 'ngrok';
import { PassportMDocIssuer } from './mdoc-issuer.js';
import { PassportDataReader } from './passport-nfc-reader.js';
import QRCode from 'qrcode';
import fs from 'fs/promises';

class E2ETestSetup {
    constructor() {
        this.issuerUrl = null;
        this.verifierUrl = null;
        this.testServerUrl = null;
    }

    async setupPublicUrls() {
        console.log('🌐 Setting up public URLs for E2E testing...');
        
        try {
            // Create ngrok tunnels for walt.id services
            console.log('📡 Creating tunnel for walt.id issuer (port 7002)...');
            this.issuerUrl = await ngrok.connect(7002);
            console.log(`✅ Issuer accessible at: ${this.issuerUrl}`);

            console.log('📡 Creating tunnel for walt.id verifier (port 7003)...');
            this.verifierUrl = await ngrok.connect(7003);
            console.log(`✅ Verifier accessible at: ${this.verifierUrl}`);

            console.log('📡 Creating tunnel for QR test server (port 3001)...');
            this.testServerUrl = await ngrok.connect(3001);
            console.log(`✅ Test server accessible at: ${this.testServerUrl}`);

            return {
                issuer: this.issuerUrl,
                verifier: this.verifierUrl,
                testServer: this.testServerUrl
            };
        } catch (error) {
            console.error('❌ Failed to create ngrok tunnels:', error);
            throw error;
        }
    }

    async generatePublicCredentialOffer(webId = 'mobile-test@example.com') {
        console.log('🎫 Generating credential offer with public URLs...');
        
        // Read mock passport data
        const reader = new PassportDataReader();
        const passportData = await reader.startReading();
        
        // Create modified issuer that uses public URL
        const issuer = new PassportMDocIssuer();
        issuer.issuerBaseUrl = this.issuerUrl; // Override with public URL
        
        try {
            // Load PKI setup
            const pkiData = await fs.readFile('mdoc-pki-setup.json', 'utf8');
            const pkiSetup = JSON.parse(pkiData);
            
            // Generate credential offer with public URL
            const offerUrl = await issuer.issueMDoc(
                passportData, 
                webId, 
                pkiSetup.setup.issuerKey.jwk,
                pkiSetup.setup.x5Chain
            );
            
            // Parse the offer to show details
            const offer = await issuer.parseCredentialOffer(offerUrl);
            
            const result = {
                credentialOffer: {
                    url: offerUrl,
                    offer: offer,
                    qrCodeData: offerUrl
                },
                metadata: {
                    webId: webId,
                    issuanceDate: new Date().toISOString(),
                    doctype: 'org.iso.18013.5.1.mDL',
                    passportNumber: passportData.data['org.iso.18013.5.1'].document_number,
                    issuer: offer.credential_issuer,
                    publicUrls: {
                        issuer: this.issuerUrl,
                        verifier: this.verifierUrl,
                        testServer: this.testServerUrl
                    }
                }
            };
            
            // Save public credential offer
            await fs.writeFile('public-credential-offer.json', JSON.stringify(result, null, 2));
            console.log('✅ Public credential offer saved to: public-credential-offer.json');
            
            return result;
        } catch (error) {
            console.error('❌ Failed to generate public credential offer:', error);
            throw error;
        }
    }

    async generateMobileQRCode(offerUrl) {
        console.log('📱 Generating mobile-optimized QR code...');
        
        try {
            // Generate high-quality QR code for mobile scanning
            const qrBuffer = await QRCode.toBuffer(offerUrl, {
                width: 512,
                margin: 4,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                errorCorrectionLevel: 'H' // High error correction for mobile scanning
            });
            
            // Save QR code as image
            await fs.writeFile('mobile-qr-code.png', qrBuffer);
            console.log('✅ Mobile QR code saved as: mobile-qr-code.png');
            
            // Also generate terminal QR for quick viewing
            console.log('\n📱 Mobile-optimized QR Code:');
            const qrcode = await import('qrcode-terminal');
            qrcode.default.generate(offerUrl, { small: false }, (qrString) => {
                console.log(qrString);
            });
            
            return qrBuffer;
        } catch (error) {
            console.error('❌ Failed to generate QR code:', error);
            throw error;
        }
    }

    async displayTestInstructions(result) {
        console.log('\n🎯 E2E TESTING INSTRUCTIONS');
        console.log('═══════════════════════════════════════════════════════');
        
        console.log('\n📱 MOBILE TESTING:');
        console.log(`1. Open QR test page: ${result.metadata.publicUrls.testServer}`);
        console.log('2. Scan QR code with your mobile wallet app');
        console.log('3. Accept the credential in your wallet');
        console.log('4. Test verification with web authentication');
        
        console.log('\n🌐 WEB TESTING:');
        console.log('1. Go to https://wallet.walt.id/');
        console.log('2. Create account or log in');
        console.log('3. Copy this credential offer URL:');
        console.log(`   ${result.credentialOffer.url}`);
        console.log('4. Paste into wallet\'s "Request Credential" field');
        
        console.log('\n📋 CREDENTIAL DETAILS:');
        console.log(`• Document Type: ${result.metadata.doctype}`);
        console.log(`• Passport Number: ${result.metadata.passportNumber}`);
        console.log(`• Web ID: ${result.metadata.webId}`);
        console.log(`• Issuer: ${result.metadata.issuer}`);
        
        console.log('\n🔗 PUBLIC URLS:');
        console.log(`• Issuer API: ${result.metadata.publicUrls.issuer}`);
        console.log(`• Verifier API: ${result.metadata.publicUrls.verifier}`);
        console.log(`• Test Interface: ${result.metadata.publicUrls.testServer}`);
        
        console.log('\n💡 TIPS:');
        console.log('• Use the mobile QR code (mobile-qr-code.png) for best scanning');
        console.log('• Public URLs work from any device with internet access');
        console.log('• QR codes contain the full credential offer URL');
        console.log('• Test with multiple wallet apps for compatibility');
        
        console.log('\n⚠️  IMPORTANT:');
        console.log('• Keep this terminal open to maintain ngrok tunnels');
        console.log('• ngrok URLs are temporary and will change on restart');
        console.log('• For production, use proper domain names and SSL certificates');
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up ngrok tunnels...');
        try {
            await ngrok.disconnect();
            await ngrok.kill();
            console.log('✅ Ngrok tunnels closed');
        } catch (error) {
            console.error('⚠️  Error cleaning up:', error.message);
        }
    }
}

// CLI Interface
async function main() {
    const setup = new E2ETestSetup();
    
    try {
        console.log('🚀 Starting E2E Testing Setup for Mobile QR Scanning');
        console.log('📱 This will create public URLs accessible from mobile devices\n');
        
        // Setup public URLs
        const urls = await setup.setupPublicUrls();
        
        // Generate public credential offer
        const webId = process.argv[2] || `e2e-test-${Date.now()}@example.com`;
        const result = await setup.generatePublicCredentialOffer(webId);
        
        // Generate mobile QR code
        await setup.generateMobileQRCode(result.credentialOffer.url);
        
        // Display instructions
        await setup.displayTestInstructions(result);
        
        console.log('\n🎉 E2E testing setup complete!');
        console.log('📱 Your mobile device can now scan the QR codes and complete the full flow');
        console.log('\n💻 Press Ctrl+C to stop and cleanup ngrok tunnels');
        
        // Keep the process alive to maintain tunnels
        process.on('SIGINT', async () => {
            await setup.cleanup();
            process.exit(0);
        });
        
        // Keep alive
        setInterval(() => {
            // Just keep the process running
        }, 30000);
        
    } catch (error) {
        console.error('❌ E2E setup failed:', error.message);
        await setup.cleanup();
        process.exit(1);
    }
}

// Handle cleanup on exit
process.on('SIGTERM', async () => {
    console.log('\n🧹 Received SIGTERM, cleaning up...');
    const setup = new E2ETestSetup();
    await setup.cleanup();
    process.exit(0);
});

export { E2ETestSetup };

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || 
    import.meta.url.endsWith('e2e-mobile-setup.js')) {
    main();
}
