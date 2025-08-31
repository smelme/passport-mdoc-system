#!/usr/bin/env node
/**
 * Passport Data Reader for walt.id mDoc Issuance
 * 
 * This script simulates reading passport data and prepares it for mDoc issuance.
 * For production, integrate with actual NFC passport reading libraries.
 * 
 * Features:
 * - Mock passport data generation
 * - MRZ data simulation
 * - Data preparation for mDoc format
 * - Custom web ID integration
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

class PassportDataReader {
  constructor() {
    // In production, this would initialize NFC readers
    console.log('📱 Passport Data Reader initialized (mock mode)');
  }

  async readPassportData() {
    // Simulate reading passport data
    // In production, this would use NFC libraries to read actual passport chips
    
    console.log('🔐 Simulating passport chip communication...');
    console.log('📖 Reading passport data groups...');
    
    // Simulate realistic delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockPassportData = this.generateMockPassportData();
    
    return this.formatForMDoc(mockPassportData);
  }

  generateMockPassportData() {
    // Generate realistic mock passport data
    const countries = ['USA', 'GBR', 'CAN', 'AUS', 'DEU', 'FRA', 'JPN'];
    const firstNames = ['ALICE', 'BOB', 'CHARLIE', 'DIANA', 'EDWARD', 'FIONA', 'GEORGE'];
    const lastNames = ['SMITH', 'JOHNSON', 'WILLIAMS', 'BROWN', 'JONES', 'GARCIA', 'MILLER'];
    
    const country = countries[Math.floor(Math.random() * countries.length)];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    const docNumber = 'P' + Math.random().toString().substr(2, 7);
    const birthYear = 1980 + Math.floor(Math.random() * 30);
    const birthDate = `${birthYear}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;
    const expiryYear = 2025 + Math.floor(Math.random() * 10);
    const expiryDate = `${expiryYear}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;
    
    return {
      documentNumber: docNumber,
      documentType: 'P',
      issuingCountry: country,
      lastName: lastName,
      firstName: firstName,
      nationality: country,
      dateOfBirth: birthDate,
      sex: Math.random() > 0.5 ? 'M' : 'F',
      expiryDate: expiryDate,
      personalNumber: Math.random().toString().substr(2, 9),
      photo: this.generateMockPhotoData(),
      fingerprints: null, // Not commonly available in passport chips
      mrz: this.generateMRZ(docNumber, country, lastName, firstName, birthDate, expiryDate)
    };
  }

  generateMockPhotoData() {
    // Generate a mock base64 encoded photo placeholder
    // In production, this would be the actual biometric photo from the passport chip
    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  }

  generateMRZ(docNumber, country, lastName, firstName, birthDate, expiryDate) {
    // Generate a realistic Machine Readable Zone
    const birthDateMRZ = birthDate.replace(/-/g, '').substr(2); // YYMMDD
    const expiryDateMRZ = expiryDate.replace(/-/g, '').substr(2); // YYMMDD
    const sex = Math.random() > 0.5 ? 'M' : 'F';
    
    // Line 1: Document type, Country, Name
    const line1 = `P<${country}${lastName}<<${firstName}${'<'.repeat(44 - lastName.length - firstName.length - 2)}`.substr(0, 44);
    
    // Line 2: Document number, check digit, nationality, birth date, check digit, sex, expiry date, check digit, personal number, check digit, composite check digit
    const line2 = `${docNumber}<${country}${birthDateMRZ}<${sex}${expiryDateMRZ}<<<<<<<<<<<<<<04`.substr(0, 44);
    
    return line1 + line2;
  }

  formatForMDoc(passportData) {
    // Format passport data according to ISO 18013-5 structure
    // This creates the data elements that will be included in the mDoc
    
    const mDocData = {
      // Standard mDoc namespace for identity documents
      'org.iso.18013.5.1': {
        // Personal information
        family_name: passportData.lastName,
        given_name: passportData.firstName,
        birth_date: passportData.dateOfBirth,
        sex: passportData.sex === 'M' ? 1 : 0, // ISO encoding: 1=male, 0=female
        nationality: passportData.nationality,
        
        // Document information
        document_number: passportData.documentNumber,
        issuing_country: passportData.issuingCountry,
        expiry_date: passportData.expiryDate,
        
        // Biometric data (if available)
        ...(passportData.photo && { portrait: passportData.photo })
      },
      
      // Custom namespace for web authentication
      'com.yourcompany.webauth': {
        web_id: '', // Will be populated during issuance
        passport_verification_level: 'mock_verified', // Change to 'nfc_verified' in production
        verification_timestamp: new Date().toISOString(),
        verification_method: 'mock_passport_read' // Change to 'nfc_chip_read' in production
      }
    };

    return {
      doctype: 'org.iso.18013.5.1.mDL', // Using mDL format as template
      data: mDocData,
      metadata: {
        source: 'mock_passport_reader', // Change to 'nfc_passport_reader' in production
        mrz: passportData.mrz,
        extraction_timestamp: new Date().toISOString(),
        mode: 'simulation'
      }
    };
  }

  async startReading() {
    console.log('🚀 Starting passport data reader...');
    console.log('📱 Simulating passport scan (in production: place passport on NFC reader)');
    
    try {
      const data = await this.readPassportData();
      console.log('✅ Passport data extracted successfully');
      return data;
    } catch (error) {
      console.error('❌ Failed to read passport data:', error.message);
      throw error;
    }
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const reader = new PassportDataReader();
  
  reader.startReading()
    .then(passportData => {
      console.log('\n📋 Passport Data Extracted:');
      console.log('🆔 Name:', passportData.data['org.iso.18013.5.1'].given_name, passportData.data['org.iso.18013.5.1'].family_name);
      console.log('🏳️ Nationality:', passportData.data['org.iso.18013.5.1'].nationality);
      console.log('📄 Document:', passportData.data['org.iso.18013.5.1'].document_number);
      console.log('📅 Birth Date:', passportData.data['org.iso.18013.5.1'].birth_date);
      console.log('⏰ Expiry:', passportData.data['org.iso.18013.5.1'].expiry_date);
      
      console.log('\n🎯 Next steps:');
      console.log('1. Run: npm run issue-mdoc -- --web-id="your@email.com"');
      console.log('2. The script will use this passport data for mDoc issuance');
      console.log('3. Store mDoc in your wallet');
      
      // Save for easy access
      import('fs/promises').then(fs => {
        fs.writeFile('passport-data.json', JSON.stringify(passportData, null, 2))
          .then(() => console.log('💾 Saved to: passport-data.json'))
          .catch(err => console.error('Failed to save:', err));
      });
      
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error:', error.message);
      process.exit(1);
    });
}

export { PassportDataReader };
