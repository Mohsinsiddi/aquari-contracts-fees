// scripts/checkBalance.js
const { ethers } = require("hardhat");

async function main() {
  const signers = await ethers.getSigners();
  
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║          WALLET BALANCE CHECKER                                ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  console.log("📋 NETWORK INFORMATION");
  console.log("═".repeat(70));
  console.log("Network:", network.name);
  console.log("Chain ID:", network.config.chainId);
  console.log("Total Wallets:", signers.length);

  for (let i = 0; i < signers.length; i++) {
    const signer = signers[i];
    const balance = await ethers.provider.getBalance(signer.address);
    const balanceInEth = ethers.formatEther(balance);

    console.log(`\n💰 WALLET ${i + 1} (ONCHAINKEY${i === 0 ? '' : i + 1})`);
    console.log("═".repeat(70));
    console.log("Address:", signer.address);
    console.log("Balance (wei):", balance.toString());
    console.log("Balance (ETH):", balanceInEth, "ETH");
  }

  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  BALANCE CHECK COMPLETED                                       ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });