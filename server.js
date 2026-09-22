const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { Connection } = require('@solana/web3.js');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const MERCHANT_WALLET_ADDRESS = process.env.MERCHANT_WALLET_ADDRESS;
const PAYMENT_LAMPORTS = Number(process.env.PAYMENT_LAMPORTS || 20_000_000);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

if (!MERCHANT_WALLET_ADDRESS) {
    throw new Error('MERCHANT_WALLET_ADDRESS must be configured.');
}

if (!Number.isSafeInteger(PAYMENT_LAMPORTS) || PAYMENT_LAMPORTS <= 0) {
    throw new Error('PAYMENT_LAMPORTS must be a positive integer.');
}

let supabase;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
    supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} else if (process.env.NODE_ENV === 'production') {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in production.');
} else {
    console.warn('[BlinkLane] Supabase is not configured; using in-memory development storage.');
}

const localPremiumUsers = new Map();

app.use(cors({
    origin: allowedOrigins.includes('*') ? true : allowedOrigins,
    methods: ['POST', 'GET', 'OPTIONS'],
}));
app.use(express.json());

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', database: supabase ? 'supabase' : 'memory' });
});

app.post('/api/blinklane-settle', async (req, res) => {
    try {
        const { signature, publicKey, userRef } = req.body;

        if (!signature || !publicKey || !userRef) {
            return res.status(400).json({ success: false, error: "Missing transaction signature." });
        }

        const connection = new Connection(RPC_URL, "confirmed");

        const transactionDetails = await connection.getParsedTransaction(signature, {
            maxSupportedTransactionVersion: 0
        });

        if (!transactionDetails) {
            return res.status(404).json({ success: false, error: "Transaction not found on-chain yet. Try again." });
        }

        const instructions = transactionDetails.transaction.message.instructions;
        const correctPayment = instructions.some((instruction) => {
            const info = instruction.parsed?.info;
            return info?.destination === MERCHANT_WALLET_ADDRESS
                && Number(info.lamports) >= PAYMENT_LAMPORTS;
        });

        if (!correctPayment) {
            return res.status(400).json({ success: false, error: "Payment verification failed. Invalid destination target." });
        }

        const premiumRecord = {
            id: crypto.createHash('sha256').update(`${userRef}:${signature}`).digest('hex'),
            user_ref: userRef,
            wallet_address: publicKey,
            transaction_signature: signature,
            merchant_wallet: MERCHANT_WALLET_ADDRESS,
            amount_lamports: PAYMENT_LAMPORTS,
        };

        if (supabase) {
            const { error } = await supabase
                .from('premium_users')
                .upsert(premiumRecord, { onConflict: 'user_ref' });
            if (error) throw error;
        } else {
            localPremiumUsers.set(userRef, premiumRecord);
        }

        return res.json({ 
            success: true, 
            message: "On-chain transaction successfully verified. Premium unlocked." 
        });

    } catch (err) {
        console.error("[BlinkLane Server Error]: ", err);
        return res.status(500).json({ success: false, error: "Internal processing engine verification failure." });
    }
});

app.listen(PORT, () => console.log(`[BlinkLane Core Engine] Listening on port ${PORT}`));
