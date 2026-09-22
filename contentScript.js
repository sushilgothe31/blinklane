// 1. Break out of Content Script sandbox into webpage execution thread
const scriptRoot = document.head || document.documentElement;
const configScript = document.createElement('script');
configScript.src = chrome.runtime.getURL('config.js');
scriptRoot.appendChild(configScript);

const gatewayScript = document.createElement('script');
gatewayScript.src = chrome.runtime.getURL('injectedscript.js');
configScript.onload = () => {
  scriptRoot.appendChild(gatewayScript);
  gatewayScript.onload = () => {
    configScript.remove();
    gatewayScript.remove();
  };
};

// 2. Inject Premium Cyberpunk UI Widget Into Target Web2 Canvas Interface
function renderBlinkLaneWidget() {
  if (document.getElementById("blinklane-premium-widget")) return;
  if (!document.body) return;

  const widget = document.createElement('div');
  widget.id = "blinklane-premium-widget";
  widget.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
    width: 320px; background: rgba(10, 11, 16, 0.95);
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(153, 69, 243, 0.3); border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.1);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", Roboto, sans-serif;
    color: #ffffff; padding: 20px; box-sizing: border-box;
    transition: all 0.3s ease;
  `;

  widget.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 8px; height: 8px; background: #14F195; border-radius: 50%; box-shadow: 0 0 8px #14F195;"></div>
        <span style="font-weight: 700; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; color: #9945FF;">BlinkLane Core</span>
      </div>
      <span style="font-size: 11px; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">Mainnet V1</span>
    </div>
    
    <div style="margin-bottom: 18px;">
      <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px; color: #fff;">Streamless Settle</div>
      <div style="font-size: 12px; color: #a0a5c1; line-height: 1.4;">Authorize atomic conversion swap & micro-payment to unlock your Web2 account tier.</div>
    </div>

    <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span style="font-size: 11px; color: rgba(255,255,255,0.5);">Asset Target</span>
        <span style="font-size: 12px; font-weight: 600; color: #14F195;">USDT / USDC</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 11px; color: rgba(255,255,255,0.5);">Network Cost</span>
        <span style="font-size: 11px; color: #fff; font-family: monospace;">< 0.00005 SOL</span>
      </div>
    </div>

    <button id="blinklane-action-trigger" style="width: 100%; background: linear-gradient(90deg, #9945FF 0%, #14F195 100%); color: #000; border: none; padding: 14px; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer; box-shadow: 0 4px 20px rgba(20, 241, 149, 0.25); transition: transform 0.1s ease, opacity 0.2s;">
      Connect & Transact
    </button>
    
    <div id="blinklane-status-monitor" style="margin-top: 12px; font-size: 11px; text-align: center; color: rgba(255,255,255,0.4); min-height: 14px; font-family: monospace;">
      Awaiting execution...
    </div>
  `;

  document.body.appendChild(widget);

  const btn = document.getElementById("blinklane-action-trigger");
  btn.addEventListener("click", () => {
    window.postMessage({ type: "BLINKLANE_INITIATE_FLOW" }, "*");
  });
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", renderBlinkLaneWidget, { once: true });
} else {
  renderBlinkLaneWidget();
}

// 3. Forward cryptographically signed proofs downstream to off-chain Web2 validation API
window.addEventListener("message", async (event) => {
  if (event.source !== window || !event.data || event.data.type !== "BLINKLANE_TX_BROADCAST_COMPLETED") return;

  const monitor = document.getElementById("blinklane-status-monitor");
  monitor.style.color = "#9945FF";
  monitor.innerText = "Processing off-chain network verification...";

  try {
    const apiCall = await fetch(`${globalThis.BLINKLANE_CONFIG.apiBaseUrl}/api/blinklane-settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey: event.data.publicKey,
        signature: event.data.signature,
        message: event.data.message,
        userRef: `web2_customer_${event.data.publicKey}`
      })
    });

    const res = await apiCall.json();
    if (res.success) {
      monitor.style.color = "#14F195";
      monitor.innerText = "Payment Mutated! Database Upgraded.";
      document.getElementById("blinklane-action-trigger").style.background = "#14F195";
      document.getElementById("blinklane-action-trigger").innerText = "Success Unlocked";
    } else {
      monitor.style.color = "#FF4A4A";
      monitor.innerText = `Error: ${res.error}`;
    }
  } catch (err) {
    monitor.style.color = "#FF4A4A";
    monitor.innerText = "Network Failure: Web2 API server unreachable.";
  }
});
