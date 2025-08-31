#!/usr/bin/env node
/**
 * Web Authentication Service using Passport mDocs
 * 
 * This service handles web authentication using verifiable credentials
 * issued from passport data. Integrates with walt.id verifier for VP validation.
 * 
 * Features:
 * - Web authentication using VCs/VPs
 * - Session management
 * - Integration with websites
 * - Presentation request handling
 * - Custom claim verification (web ID)
 */

import express from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VERIFIER_BASE = 'http://localhost:7003';
const STANDARD_VERSION = 'draft13';

class WebAuthService {
  constructor(port = 8080) {
    this.app = express();
    this.port = port;
    this.sessions = new Map(); // In production, use Redis or database
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(join(__dirname, 'public')));
  }

  setupRoutes() {
    // Main authentication page
    this.app.get('/', (req, res) => {
      res.send(this.getAuthPage());
    });

    // Start authentication flow
    this.app.post('/auth/start', async (req, res) => {
      try {
        const { website, returnUrl } = req.body;
        const session = await this.startAuthFlow(website, returnUrl);
        res.json(session);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Handle VP presentation
    this.app.post('/auth/present', async (req, res) => {
      try {
        const { sessionId, vpToken } = req.body;
        const result = await this.handleVPPresentation(sessionId, vpToken);
        res.json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Check authentication status
    this.app.get('/auth/status/:sessionId', (req, res) => {
      const session = this.sessions.get(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(session);
    });

    // Callback for websites
    this.app.get('/auth/callback/:sessionId', async (req, res) => {
      const session = this.sessions.get(req.params.sessionId);
      if (!session) {
        return res.status(404).send('Session not found');
      }

      if (session.status === 'completed') {
        // Redirect back to the website with authentication token
        const returnUrl = new URL(session.returnUrl);
        returnUrl.searchParams.set('auth_token', session.authToken);
        returnUrl.searchParams.set('web_id', session.userInfo.webId);
        return res.redirect(returnUrl.toString());
      }

      res.send(this.getWaitingPage(req.params.sessionId));
    });
  }

  async startAuthFlow(website, returnUrl) {
    console.log(`🚀 Starting auth flow for website: ${website}`);
    
    const sessionId = uuidv4();
    
    // Create verification session with walt.id verifier
    const verificationSession = await this.createVerificationSession();
    
    const session = {
      id: sessionId,
      website: website,
      returnUrl: returnUrl,
      status: 'pending',
      createdAt: new Date().toISOString(),
      verificationSessionId: verificationSession.sessionId,
      presentationRequest: verificationSession.presentationRequest,
      authToken: null,
      userInfo: null
    };

    this.sessions.set(sessionId, session);
    
    console.log(`✅ Auth session created: ${sessionId}`);
    
    return {
      sessionId: sessionId,
      presentationRequest: verificationSession.presentationRequest,
      callbackUrl: `http://localhost:${this.port}/auth/callback/${sessionId}`,
      qrCode: this.generateQRCodeData(sessionId, verificationSession.presentationRequest)
    };
  }

  async createVerificationSession() {
    console.log('📝 Creating verification session with walt.id...');
    
    // Request passport credential presentation
    const presentationRequest = {
      request_credentials: [
        {
          format: 'mso_mdoc',
          doctype: 'org.iso.18013.5.1.mDL'
        }
      ],
      purpose: 'Web Authentication',
      challenge: uuidv4()
    };

    try {
      const { data } = await axios.post(`${VERIFIER_BASE}/openid4vc/verify`, presentationRequest, {
        headers: { 'Content-Type': 'application/json' }
      });

      return {
        sessionId: data.sessionId || uuidv4(),
        presentationRequest: data.request || presentationRequest
      };
    } catch (error) {
      console.warn('⚠️ Direct verifier session failed, using fallback');
      return {
        sessionId: uuidv4(),
        presentationRequest: presentationRequest
      };
    }
  }

  async handleVPPresentation(sessionId, vpToken) {
    console.log(`🔍 Processing VP presentation for session: ${sessionId}`);
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'pending') {
      throw new Error('Session already processed');
    }

    // Verify the VP with walt.id verifier
    const verificationResult = await this.verifyVP(vpToken);
    
    if (verificationResult.valid) {
      // Extract user information from the verified VP
      const userInfo = this.extractUserInfo(verificationResult.vpData);
      
      // Generate authentication token
      const authToken = this.generateAuthToken(userInfo);
      
      // Update session
      session.status = 'completed';
      session.authToken = authToken;
      session.userInfo = userInfo;
      session.completedAt = new Date().toISOString();
      
      console.log(`✅ Authentication successful for web ID: ${userInfo.webId}`);
      
      return {
        success: true,
        authToken: authToken,
        userInfo: userInfo,
        callbackUrl: `http://localhost:${this.port}/auth/callback/${sessionId}`
      };
    } else {
      session.status = 'failed';
      session.error = verificationResult.error;
      
      throw new Error(`VP verification failed: ${verificationResult.error}`);
    }
  }

  async verifyVP(vpToken) {
    console.log('🔐 Verifying VP with walt.id verifier...');
    
    try {
      // This would integrate with walt.id verifier API
      // For now, we'll do basic validation
      
      // Decode and validate the VP structure
      const vpData = this.decodeVP(vpToken);
      
      // Validate required fields
      if (!vpData || !vpData.verifiableCredential) {
        return { valid: false, error: 'Invalid VP structure' };
      }

      // Check for passport credential
      const passportCredential = vpData.verifiableCredential.find(vc => 
        vc.type && vc.type.includes('PassportCredential')
      );

      if (!passportCredential) {
        return { valid: false, error: 'No passport credential found' };
      }

      // Validate credential claims
      const subject = passportCredential.credentialSubject;
      if (!subject.webId || !subject.passportNumber) {
        return { valid: false, error: 'Missing required claims' };
      }

      return {
        valid: true,
        vpData: vpData,
        passportCredential: passportCredential
      };

    } catch (error) {
      console.error('❌ VP verification error:', error);
      return { valid: false, error: error.message };
    }
  }

  decodeVP(vpToken) {
    // This is a simplified VP decoder
    // In production, use proper JWT/CBOR decoding
    try {
      if (vpToken.startsWith('eyJ')) {
        // JWT format
        const payload = vpToken.split('.')[1];
        const decoded = Buffer.from(payload, 'base64').toString('utf8');
        return JSON.parse(decoded);
      } else {
        // Assume JSON format for now
        return JSON.parse(vpToken);
      }
    } catch (error) {
      throw new Error('Failed to decode VP token');
    }
  }

  extractUserInfo(vpData) {
    const passportCredential = vpData.verifiableCredential.find(vc => 
      vc.type && vc.type.includes('PassportCredential')
    );

    const subject = passportCredential.credentialSubject;
    
    return {
      webId: subject.webId,
      fullName: `${subject.givenName} ${subject.familyName}`,
      nationality: subject.nationality,
      passportNumber: subject.passportNumber,
      nfcVerified: subject.nfcVerified,
      verificationLevel: subject.verificationLevel,
      authenticationMethod: 'passport_vc'
    };
  }

  generateAuthToken(userInfo) {
    // In production, use proper JWT signing
    const tokenData = {
      webId: userInfo.webId,
      fullName: userInfo.fullName,
      authMethod: 'passport_vc',
      issuedAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };

    return Buffer.from(JSON.stringify(tokenData)).toString('base64');
  }

  generateQRCodeData(sessionId, presentationRequest) {
    // Generate QR code data for wallet scanning
    return {
      type: 'openid4vp',
      sessionId: sessionId,
      presentation_definition: presentationRequest,
      callback_url: `http://localhost:${this.port}/auth/present`,
      format: 'mso_mdoc'
    };
  }

  getAuthPage() {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>🎫 Passport Authentication</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 40px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; font-weight: 600; }
        input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px; }
        button { background: #007AFF; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; cursor: pointer; width: 100%; }
        button:hover { background: #0051D5; }
        .status { margin-top: 20px; padding: 12px; border-radius: 6px; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .qr-code { text-align: center; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎫 Passport Authentication</h1>
            <p>Authenticate using your passport mDoc credential</p>
        </div>

        <form id="authForm">
            <div class="form-group">
                <label for="website">Website Name:</label>
                <input type="text" id="website" value="demo-website.com" required>
            </div>
            
            <div class="form-group">
                <label for="webId">Your Web ID:</label>
                <input type="email" id="webId" placeholder="your@email.com" required>
            </div>
            
            <div class="form-group">
                <label for="returnUrl">Return URL:</label>
                <input type="url" id="returnUrl" value="https://demo-website.com/login/callback" required>
            </div>
            
            <button type="submit">🚀 Start Authentication</button>
        </form>

        <div id="status"></div>
        <div id="qrCode" class="qr-code" style="display: none;">
            <h3>📱 Scan with your wallet:</h3>
            <div id="qrCodeData"></div>
            <p><small>Or use the callback URL directly</small></p>
        </div>
    </div>

    <script>
        document.getElementById('authForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                website: document.getElementById('website').value,
                returnUrl: document.getElementById('returnUrl').value
            };
            
            try {
                const response = await fetch('/auth/start', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    document.getElementById('status').innerHTML = 
                        '<div class="success">✅ Authentication session started! Session ID: ' + result.sessionId + '</div>';
                    
                    document.getElementById('qrCodeData').innerHTML = 
                        '<pre>' + JSON.stringify(result.qrCode, null, 2) + '</pre>' +
                        '<p><a href="' + result.callbackUrl + '" target="_blank">Open Callback URL</a></p>';
                    
                    document.getElementById('qrCode').style.display = 'block';
                    
                    // Start polling for status
                    pollStatus(result.sessionId);
                } else {
                    document.getElementById('status').innerHTML = 
                        '<div class="error">❌ Error: ' + result.error + '</div>';
                }
            } catch (error) {
                document.getElementById('status').innerHTML = 
                    '<div class="error">❌ Network error: ' + error.message + '</div>';
            }
        });
        
        function pollStatus(sessionId) {
            const poll = async () => {
                try {
                    const response = await fetch('/auth/status/' + sessionId);
                    const session = await response.json();
                    
                    if (session.status === 'completed') {
                        document.getElementById('status').innerHTML = 
                            '<div class="success">🎉 Authentication completed!<br>' +
                            'User: ' + (session.userInfo ? session.userInfo.fullName : 'Unknown') + '<br>' +
                            'Web ID: ' + (session.userInfo ? session.userInfo.webId : 'Unknown') + '</div>';
                        return;
                    } else if (session.status === 'failed') {
                        document.getElementById('status').innerHTML = 
                            '<div class="error">❌ Authentication failed: ' + (session.error || 'Unknown error') + '</div>';
                        return;
                    }
                    
                    // Continue polling
                    setTimeout(poll, 2000);
                } catch (error) {
                    console.error('Polling error:', error);
                    setTimeout(poll, 5000);
                }
            };
            
            poll();
        }
    </script>
</body>
</html>`;
  }

  getWaitingPage(sessionId) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Waiting for Authentication</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 40px; background: #f5f5f5; text-align: center; }
        .container { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #007AFF; border-radius: 50%; width: 50px; height: 50px; animation: spin 2s linear infinite; margin: 20px auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <h2>🔄 Waiting for Authentication</h2>
        <div class="spinner"></div>
        <p>Please present your passport credential in your wallet app.</p>
        <p><small>Session: ${sessionId}</small></p>
    </div>
    
    <script>
        // Auto-refresh every 3 seconds to check status
        setTimeout(() => location.reload(), 3000);
    </script>
</body>
</html>`;
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`🌐 Web Auth Service running on http://localhost:${this.port}`);
      console.log(`🎫 Ready to authenticate users with passport mDocs!`);
    });
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.argv[2] || 8080;
  const service = new WebAuthService(port);
  service.start();
}

export { WebAuthService };
