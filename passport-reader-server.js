#!/usr/bin/env node
/**
 * Passport Reader UI Server
 * 
 * Serves the passport reading interface and handles mDoc issuance
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PassportMDocIssuer } from './mdoc-issuer.js';
import { PassportDataReader } from './passport-nfc-reader.js';
import QRCode from 'qrcode';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PASSPORT_UI_PORT || process.env.PORT || 8080;

// Helper function to get public URL
function getPublicUrl(req, port = PORT) {
    // Check if running in Codespaces
    if (process.env.CODESPACE_NAME) {
        return `https://${process.env.CODESPACE_NAME}-${port}.app.github.dev`;
    }
    
    // Check for forwarded headers (Codespaces/ngrok/etc)
    if (req && req.get('X-Forwarded-Host')) {
        const protocol = req.get('X-Forwarded-Proto') || 'https';
        return `${protocol}://${req.get('X-Forwarded-Host')}`;
    }
    
    // Default to localhost
    return `http://localhost:${port}`;
}

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Serve the main UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'passport-reader-ui.html'));
});

// API endpoint to issue mDoc credential
app.post('/api/issue-mdoc', async (req, res) => {
    try {
        console.log('🎫 Received mDoc issuance request');
        const { passportData, webId } = req.body;
        
        if (!passportData || !webId) {
            return res.status(400).json({ 
                error: 'Missing passport data or web ID' 
            });
        }
        
        // Convert manual form data to passport reader format
        const formattedPassportData = {
            source: 'manual_entry',
            data: {
                'org.iso.18013.5.1': {
                    family_name: passportData.family_name,
                    given_name: passportData.given_name,
                    birth_date: passportData.birth_date,
                    sex: parseInt(passportData.sex),
                    nationality: passportData.nationality,
                    document_number: passportData.document_number,
                    issuing_country: passportData.issuing_country,
                    expiry_date: passportData.expiry_date,
                    portrait: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHHggJ/PchI7wAAAABJRU5ErkJggg==" // Placeholder image
                }
            }
        };
        
        console.log('📝 Processing passport data for:', passportData.document_number);
        
        // Create issuer instance
        const issuer = new PassportMDocIssuer();
        
        // Set the issuer base URL for Codespaces
        if (process.env.CODESPACE_NAME) {
            issuer.issuerBaseUrl = `https://${process.env.CODESPACE_NAME}-7002.app.github.dev`;
            console.log('🌐 Using Codespaces URL for issuer:', issuer.issuerBaseUrl);
        }
        
        // Load PKI setup
        let pkiSetup;
        try {
            const pkiData = await fs.readFile('mdoc-pki-setup.json', 'utf8');
            pkiSetup = JSON.parse(pkiData);
            console.log('🔐 PKI setup loaded');
        } catch (error) {
            console.log('⚠️  PKI setup not found, creating new setup...');
            // If PKI setup doesn't exist, create it
            const { setupMDocPKI } = await import('./setup-mdoc-pki.js');
            pkiSetup = await setupMDocPKI();
        }
        
        // Issue the credential
        console.log('🚀 Issuing mDoc credential...');
        const offerUrl = await issuer.issueMDoc(
            formattedPassportData,
            webId,
            pkiSetup.setup.issuerKey.jwk,
            pkiSetup.setup.x5Chain
        );
        
        // Parse credential offer for response
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
                passportNumber: passportData.document_number,
                issuer: offer.credential_issuer
            }
        };
        
        console.log('✅ mDoc credential issued successfully');
        res.json(result);
        
    } catch (error) {
        console.error('❌ mDoc issuance error:', error);
        res.status(500).json({ 
            error: 'Failed to issue credential', 
            details: error.message 
        });
    }
});

// API endpoint to generate QR code
app.post('/api/generate-qr', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }
        
        console.log('📱 Generating QR code for credential offer');
        
        // Generate high-quality QR code
        const qrBuffer = await QRCode.toBuffer(url, {
            width: 400,
            margin: 4,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            errorCorrectionLevel: 'H'
        });
        
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', 'inline; filename="credential-qr.png"');
        res.send(qrBuffer);
        
    } catch (error) {
        console.error('❌ QR generation error:', error);
        res.status(500).json({ 
            error: 'Failed to generate QR code', 
            details: error.message 
        });
    }
});

// API endpoint for NFC passport reading (future implementation)
app.post('/api/read-nfc-passport', async (req, res) => {
    try {
        console.log('📱 NFC passport reading requested');
        
        // For now, simulate NFC reading with mock data
        const reader = new PassportDataReader();
        const passportData = await reader.startReading();
        
        // Extract the passport data in the format expected by the frontend
        const extractedData = {
            family_name: passportData.data['org.iso.18013.5.1'].family_name,
            given_name: passportData.data['org.iso.18013.5.1'].given_name,
            birth_date: passportData.data['org.iso.18013.5.1'].birth_date,
            sex: passportData.data['org.iso.18013.5.1'].sex,
            nationality: passportData.data['org.iso.18013.5.1'].nationality,
            document_number: passportData.data['org.iso.18013.5.1'].document_number,
            issuing_country: passportData.data['org.iso.18013.5.1'].issuing_country,
            expiry_date: passportData.data['org.iso.18013.5.1'].expiry_date
        };
        
        console.log('✅ NFC passport data read:', extractedData.document_number);
        res.json({ 
            success: true, 
            passportData: extractedData 
        });
        
    } catch (error) {
        console.error('❌ NFC reading error:', error);
        res.status(500).json({ 
            error: 'Failed to read NFC passport', 
            details: error.message 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        services: {
            passportReader: 'active',
            mdocIssuer: 'active',
            qrGenerator: 'active'
        }
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('❌ Server error:', error);
    res.status(500).json({ 
        error: 'Internal server error', 
        details: error.message 
    });
});

// Start server
app.listen(PORT, () => {
    console.log('🚀 Passport Reader UI Server started');
    console.log('═══════════════════════════════════════');
    
    if (process.env.CODESPACE_NAME) {
        const codespaceUrl = `https://${process.env.CODESPACE_NAME}-${PORT}.app.github.dev`;
        console.log(`📱 Codespaces URL: ${codespaceUrl}`);
        console.log(`🔗 Public Access: ${codespaceUrl}`);
    } else {
        console.log(`📱 Local URL: http://localhost:${PORT}`);
        console.log(`🔗 Direct link: http://localhost:${PORT}/`);
    }
    
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('Features:');
    console.log('• 📱 NFC passport reading (simulated)');
    console.log('• ✏️  Manual passport data entry');
    console.log('• 🎫 mDoc credential issuance');
    console.log('• 📱 QR code generation for wallets');
    console.log('• 🔐 Full PKI integration');
    console.log('');
    
    if (process.env.CODESPACE_NAME) {
        console.log('🌐 Codespaces Environment Detected');
        console.log('📱 Test from mobile devices using the public URL above');
        console.log('🔗 All ports are automatically forwarded and secured');
    } else {
        console.log('💡 Open the web interface to start reading passports!');
    }
});

export default app;
