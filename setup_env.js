const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Check if .env file exists
const envPath = path.join(__dirname, 'backend', '.env');
const envExamplePath = path.join(__dirname, 'env.example');

if (!fs.existsSync(envPath)) {
    console.log('🔧 Setting up .env file...');
    
    // Read the example file
    let envContent = fs.readFileSync(envExamplePath, 'utf8');
    
    // Generate a secure JWT secret
    const jwtSecret = crypto.randomBytes(64).toString('hex');
    
    // Replace the placeholder JWT secret
    envContent = envContent.replace('your_super_secure_jwt_secret_key_here', jwtSecret);
    
    // Write the .env file
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ .env file created successfully!');
    console.log('🔐 JWT secret generated automatically');
} else {
    console.log('✅ .env file already exists');
}

console.log('📁 Environment setup complete!');
