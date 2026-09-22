// Dynamically load the Solana Web3 CDN library inside the main window thread
if (!window.solanaWeb3) {
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/@solana/web3.js@1.98.4/lib/index.iife.min.js';
  document.head.appendChild(script);
}

window.addEventListener("message", async (event) => {
  if (event.source !== window || !event.data || event.data.type !== "BLINKLANE_INITIATE_FLOW") return;

  const walletProvider = window.phantom?.solana || window.solana;
  if (!walletProvider) {
    alert("BlinkLane Exception: Please install Phantom or Solflare wallet!");
    return;
  }

  try {
    const session = await walletProvider.connect();
    const userWalletPubkey = session.publicKey;
    const solanaWeb3 = window.solanaWeb3;

    if (!solanaWeb3) {
      alert("Network library initializing, please click again in a second!");
      return;
    }

    // Establish Mainnet RPC Connection
    const connection = new solanaWeb3.Connection("https://api.mainnet-beta.solana.com", "confirmed");

    // ─── TARGET CONFIGURATION ───
    const TARGET_MERCHANT = new solanaWeb3.PublicKey(globalThis.BLINKLANE_CONFIG.merchantWalletAddress);
    const USDT_MINT = new solanaWeb3.PublicKey("Es9vMFrzaGMRFRG4UXXYZssWFTR2kW1bfUsGj4Gv56dB"); // Official Mainnet USDT Mint
    const TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

    // 1. Calculate Associated Token Accounts (ATA) for layout execution
    // Simple direct SOL micro-transfer demonstrated for local test baseline:
    const paymentInstruction = solanaWeb3.SystemProgram.transfer({
      fromPubkey: userWalletPubkey,
      toPubkey: TARGET_MERCHANT,
      lamports: globalThis.BLINKLANE_CONFIG.paymentLamports
    });

    const transaction = new solanaWeb3.Transaction().add(paymentInstruction);
    const { blockhash } = await connection.getLatestBlockhash();
    
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userWalletPubkey;

    // 2. Trigger wallet signing window and broadcast to Solana Mainnet
    const { signature } = await walletProvider.signAndSendTransaction(transaction);

    // 3. Send transaction signature receipt back into the extension sandbox
    window.postMessage({
      type: "BLINKLANE_TX_BROADCAST_COMPLETED",
      signature,
      publicKey: userWalletPubkey.toBase58()
    }, "*");

  } catch (error) {
    console.error("[BlinkLane Engine Failure] Transaction rejected: ", error);
  }
});
