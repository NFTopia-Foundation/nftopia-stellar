const { Keypair, Transaction, Networks } = require('stellar-sdk');
const axios = require('axios');

async function testAuth() {
    const keypair = Keypair.random();
    const publicKey = keypair.publicKey();
    const api = axios.create({ baseURL: 'http://localhost:3000' });

    console.log(`Testing with Public Key: ${publicKey}`);

    try {
        // 1. Get Challenge
        console.log('Requesting challenge...');
        const challengeRes = await api.post('/api/v1/auth/challenge', { publicKey });
        const { transaction: xdr, networkPassphrase } = challengeRes.data;
        console.log('Challenge received.');

        // 2. Sign Transaction
        const transaction = new Transaction(xdr, networkPassphrase);
        transaction.sign(keypair);
        const signedXdr = transaction.toXDR();
        console.log('Transaction signed.');

        // 3. Login
        console.log('Attempting login...');
        const loginRes = await api.post('/api/v1/auth/login', { transaction: signedXdr });
        const { access_token } = loginRes.data;

        if (access_token) {
            console.log('✅ SUCCESS! Received JWT:', access_token);
        } else {
            console.error('❌ Failed: No access token returned');
        }

    } catch (error) {
        console.error('❌ Error during test:', error.response ? error.response.data : error.message);
    }
}

testAuth();
