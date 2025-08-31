#!/usr/bin/env node
/**
 * QR Code Test Server
 * 
 * Simple server to test QR code scanning with app.listen(PORT, () => {
    console.log('🌐 QR Code Test Server running');
    
    if (process.env.CODESPACE_NAME) {
        const publicUrl = getPublicUrl(PORT);
        console.log(`📱 Codespaces URL: ${publicUrl}`);
        console.log(`🔗 Public Access: ${publicUrl}`);
        console.log('🌐 Mobile devices can access this URL directly');
    } else {
        console.log(`📱 Local URL: http://localhost:${PORT}`);
        console.log(`🔗 Direct link: http://localhost:${PORT}`);
    }
    
    console.log('📱 Open this URL to test QR code scanning');
});ntial offers
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.QR_TEST_PORT || 3001;

// Helper function to get public URL for Codespaces
function getPublicUrl(port = PORT) {
    if (process.env.CODESPACE_NAME) {
        return `https://${process.env.CODESPACE_NAME}-${port}.app.github.dev`;
    }
    return `http://localhost:${port}`;
}

// Serve static files
app.use(express.static(__dirname));

// Serve the QR test page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'qr-test.html'));
});

// API endpoint to get current credential offer
app.get('/credential-offer.json', async (req, res) => {
    try {
        const data = await fs.readFile(path.join(__dirname, 'credential-offer.json'), 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(404).json({ error: 'No credential offer found. Please generate one first.' });
    }
});

// API endpoint to generate QR code as PNG
app.get('/qr-code.png', async (req, res) => {
    try {
        const data = await fs.readFile(path.join(__dirname, 'credential-offer.json'), 'utf8');
        const offerData = JSON.parse(data);
        const offerUrl = offerData.credentialOffer.url;
        
        // Generate QR code as PNG buffer
        const qrBuffer = await QRCode.toBuffer(offerUrl, {
            width: 400,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            errorCorrectionLevel: 'M'
        });
        
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(qrBuffer);
    } catch (error) {
        console.error('Error generating QR code:', error);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

// API endpoint to generate new credential offer
app.post('/generate-offer', async (req, res) => {
    try {
        // Import the issuer class
        const { PassportMDocIssuer } = await import('./mdoc-issuer.js');
        const { PassportDataReader } = await import('./passport-nfc-reader.js');
        
        const issuer = new PassportMDocIssuer();
        const reader = new PassportDataReader();
        
        // Generate mock passport data
        const passportData = await reader.startReading();
        
        // Generate credential offer
        const webId = `test-${Date.now()}@example.com`;
        const result = await issuer.processFullIssuance(passportData, webId, true);
        
        // Save the new offer
        await fs.writeFile(
            path.join(__dirname, 'credential-offer.json'), 
            JSON.stringify(result, null, 2)
        );
        
        res.json({ success: true, offer: result });
    } catch (error) {
        console.error('Error generating offer:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🌐 QR Code Test Server running at http://localhost:${PORT}`);
    console.log(`📱 Open this URL to test QR code scanning`);
    console.log(`🔗 Direct link: http://localhost:${PORT}`);
});
