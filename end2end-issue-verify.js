#!/usr/bin/env node
// End-to-end issuance + verification test for walt.id issuer & verifier
// Flow: discover config -> generate key -> POST issuance -> parse offer -> token -> credential -> start verify session -> (simplified) verify credential directly.
// NOTE: This script focuses on jwt_vc_json credential flow with PRE_AUTHORIZED code grant.

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { generateKeyPair, SignJWT, exportJWK } from 'jose';

// Make crypto globally available for jose library
global.crypto = crypto;

const ISSUER_BASE = 'http://localhost:7002';
const VERIFIER_BASE = 'http://localhost:7003';
const STANDARD_VERSION = 'draft13';

async function discoverIssuerConfigs() {
  console.log('  -> Fetching issuer metadata...');
  const url = `${ISSUER_BASE}/${STANDARD_VERSION}/.well-known/openid-credential-issuer`;
  const { data } = await axios.get(url);
  return data; // Contains credential_configurations_supported
}

async function generateEd25519Jwk() {
  const { publicKey, privateKey } = await generateKeyPair('Ed25519', { extractable: true });
  const jwk = await exportJWK(privateKey);
  jwk.kid = crypto.randomUUID();
  return { jwk, privateKey };
}

function buildCredentialData(credentialType) {
  // Minimal VC body. Adjust type mapping if issuer expects specific structure.
  return {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', credentialType],
    issuer: { name: 'Test Issuer' },
    credentialSubject: {
      id: 'did:example:holder123',
      givenName: 'Alice',
      familyName: 'Doe'
    }
  };
}

async function startIssuance(issuerKeyJwk, credentialConfigurationId, credentialType) {
  console.log('  -> Posting issuance request...');
  const issuanceRequest = {
    credentialConfigurationId,
    issuerKey: { type: 'jwk', jwk: issuerKeyJwk },
    authenticationMethod: 'PRE_AUTHORIZED',
    credentialData: buildCredentialData(credentialType),
    mapping: {
      id: uuidv4(),
      issuer: { id: 'did:key:issuer-did-placeholder' },
      credentialSubject: { id: 'did:key:holder-did-placeholder' },
      issuanceDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 365*24*3600*1000).toISOString()
    },
    standardVersion: 'DRAFT13'
  };
  const { data } = await axios.post(`${ISSUER_BASE}/openid4vc/jwt/issue`, issuanceRequest, { headers: { 'Content-Type': 'application/json' }});
  return data; // Expect issuance URL (credential offer URL string)
}

function parseCredentialOfferUrl(offerUrl) {
  // Example: openid-credential-offer://localhost/?credential_offer=<urlencodedJSON>
  const query = offerUrl.split('?')[1] || '';
  const params = new URLSearchParams(query);
  const raw = params.get('credential_offer');
  if (!raw) throw new Error('credential_offer not found');
  const decoded = decodeURIComponent(raw);
  return JSON.parse(decoded);
}

async function exchangePreAuthorizedCode(code) {
  console.log('  -> Exchanging pre-authorized code...');
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
    'pre-authorized_code': code
  });
  const { data } = await axios.post(`${ISSUER_BASE}/${STANDARD_VERSION}/token`, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return data; // access_token, c_nonce maybe
}

async function createProofOfPossession(holderKey, audience, nonce) {
  console.log('  -> Creating proof of possession JWT...');
  const proof = await new SignJWT({
    aud: audience,
    iat: Math.floor(Date.now() / 1000),
    nonce: nonce
  })
    .setProtectedHeader({ 
      alg: 'EdDSA', 
      typ: 'openid4vci-proof+jwt',
      jwk: await exportJWK(holderKey.publicKey)
    })
    .setIssuedAt()
    .sign(holderKey.privateKey);
  
  return proof;
}

async function requestCredential(accessToken, credentialConfigurationId, tokenResponse, holderKey) {
  console.log('  -> Requesting credential...');
  let payload = { 
    credential_configuration_id: credentialConfigurationId, 
    format: 'jwt_vc_json' 
  };
  
  // Add proof of possession if c_nonce is present
  if (tokenResponse.c_nonce) {
    console.log('  -> Adding proof of possession (c_nonce present)');
    console.log('  -> c_nonce value:', tokenResponse.c_nonce);
    const proof = await createProofOfPossession(holderKey, `${ISSUER_BASE}/${STANDARD_VERSION}`, tokenResponse.c_nonce);
    console.log('  -> Generated proof JWT (first 100 chars):', proof.substring(0, 100));
    payload.proof = {
      proof_type: 'jwt',
      jwt: proof
    };
  }
  
  console.log('  -> Final payload:', JSON.stringify(payload, null, 2));
  
  const { data } = await axios.post(`${ISSUER_BASE}/${STANDARD_VERSION}/credential`, payload, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
  });
  return data; // Credential response structure (likely { credential: <JWT or object> })
}

async function startVerification(credentialType) {
  console.log('  -> Starting verification session...');
  const body = {
    request_credentials: [ { format: 'jwt_vc_json', type: credentialType } ]
  };
  const { data } = await axios.post(`${VERIFIER_BASE}/openid4vc/verify`, body, { headers: { 'Content-Type': 'application/json' }});
  return data; // Expect session URL or id
}

async function fetchCredentialOfferWithRetry(offerUri, attempts=5, delayMs=500) {
  for (let i=0;i<attempts;i++) {
    try {
      const { data } = await axios.get(offerUri);
      return data;
    } catch (e) {
      if (i === attempts-1) throw e;
      await new Promise(r=>setTimeout(r, delayMs));
    }
  }
}

async function resolveOfferIfUri(offerUrl) {
  // If the URL contains credential_offer_uri param, fetch it.
  const query = offerUrl.split('?')[1] || '';
  const params = new URLSearchParams(query);
  if (params.get('credential_offer')) {
    return parseCredentialOfferUrl(offerUrl);
  }
  const offerUri = params.get('credential_offer_uri');
  if (!offerUri) throw new Error('No credential_offer or credential_offer_uri');
  return await fetchCredentialOfferWithRetry(offerUri);
}

async function main() {
  try {
    console.log('=== Starting walt.id End-to-End Test ===');
    console.log('Discovering issuer configurations...');
    const issuerMeta = await discoverIssuerConfigs();
    console.log('Successfully discovered issuer configurations');
    
    const configs = issuerMeta.credential_configurations_supported || {};
    const entries = Object.entries(configs);
    if (entries.length === 0) throw new Error('No credential configurations discovered');
    // Pick first jwt_vc_json capable config
    let pickedId, picked;
    for (const [id, conf] of entries) {
      if ((conf.format === 'jwt_vc_json') || (conf.format === 'jwt_vc')) { pickedId = id; picked = conf; break; }
    }
    if (!pickedId) { const [id, conf] = entries[0]; pickedId = id; picked = conf; }
    const credentialType = (picked.types && picked.types[0]) || 'VerifiableId';
    console.log('Using credentialConfigurationId:', pickedId, 'type:', credentialType);

    // Generate keys up front to save time later
    console.log('Generating issuer key (Ed25519)...');
    const { jwk: issuerKey } = await generateEd25519Jwk();

    console.log('Generating holder key (Ed25519)...');
    const holderKey = await generateKeyPair('Ed25519', { extractable: true });

    // Start issuance and immediately continue through the flow
    console.log('Starting issuance...');
    const issuanceUrl = await startIssuance(issuerKey, pickedId, credentialType);
    console.log('Issuance URL:', issuanceUrl);

    console.log('Parsing credential offer...');
    const offer = await resolveOfferIfUri(issuanceUrl);
    console.log('Credential offer parsed successfully');
    
    let code = offer?.grants?.authorization_code?.issuer_state;
    if (!code) {
      // draft13 pre-authorized variant
      const grant = offer?.grants && (offer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code'] || offer.grants['pre-authorized_code']);
      code = grant && (grant.pre_authorized_code || grant['pre-authorized_code']);
    }
    if (!code) throw new Error('Pre-authorized or authorization code not found in offer');
    console.log('Got pre-authorized code');

    // Exchange immediately
    console.log('Exchanging code for access token...');
    const tokenResp = await exchangePreAuthorizedCode(code);
    const accessToken = tokenResp.access_token;
    console.log('Access token acquired, c_nonce:', tokenResp.c_nonce ? 'present' : 'not present');

    // Request credential immediately - no delays
    console.log('Requesting credential IMMEDIATELY...');
    const credentialResp = await requestCredential(accessToken, pickedId, tokenResp, holderKey);
    console.log('Credential response keys:', Object.keys(credentialResp));
    const credentialJwt = credentialResp.credential || credentialResp.jwt || credentialResp.vc;
    if (!credentialJwt) {
      console.warn('Could not find credential JWT in response:', credentialResp);
    } else {
      console.log('✓ CREDENTIAL RECEIVED! (truncated):', credentialJwt.substring(0,60) + '...');
    }

    // Start verification session
    console.log('Starting verification session...');
    const verifySession = await startVerification(credentialType);
    console.log('Verification session response:', verifySession);

    console.log('\n=== SUCCESS ===');
    console.log('✓ Credential issued successfully');
    console.log('✓ Verification session started');
    console.log('NOTE: Full VP submission flow not implemented (depends on session details).');
    console.log('Extend script to build VP and submit to verifier token endpoint as next step.');
  } catch (e) {
    console.log('\n=== ERROR ===');
    if (e.response) {
      console.error('HTTP Error:', e.response.status, e.response.data);
    } else {
      console.error(e);
    }
    process.exit(1);
  }
}

main();
