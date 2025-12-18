// scripts/transferETH.js
const { ethers } = require("hardhat");

async function main() {
  const signers = await ethers.getSigners();
  const [wallet1, wallet2] = signers;

  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║          ETH TRANSFER                                          ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  console.log("📋 TRANSFER DETAILS");
  console.log("═".repeat(70));
  console.log("Network:", network.name);
  console.log("Chain ID:", network.config.chainId);
  console.log("From (Wallet 2):", wallet2.address);
  console.log("To (Wallet 1):", wallet1.address);
  console.log("Amount:", "0.05 ETH");

  // Get balances before transfer
  const balance1Before = await ethers.provider.getBalance(wallet1.address);
  const balance2Before = await ethers.provider.getBalance(wallet2.address);

  console.log("\n💰 BALANCES BEFORE TRANSFER");
  console.log("═".repeat(70));
  console.log("Wallet 1:", ethers.formatEther(balance1Before), "ETH");
  console.log("Wallet 2:", ethers.formatEther(balance2Before), "ETH");

  // Transfer 0.05 ETH from wallet2 to wallet1
  const amountToSend = ethers.parseEther("0.05");

  console.log("\n🚀 SENDING TRANSACTION...");
  console.log("═".repeat(70));

  const tx = await wallet2.sendTransaction({
    to: wallet1.address,
    value: amountToSend,
  });

  console.log("Transaction Hash:", tx.hash);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log("✅ Confirmed in block:", receipt.blockNumber);
  console.log("Gas Used:", receipt.gasUsed.toString());

  // Get balances after transfer
  const balance1After = await ethers.provider.getBalance(wallet1.address);
  const balance2After = await ethers.provider.getBalance(wallet2.address);

  console.log("\n💰 BALANCES AFTER TRANSFER");
  console.log("═".repeat(70));
  console.log("Wallet 1:", ethers.formatEther(balance1After), "ETH");
  console.log("Wallet 2:", ethers.formatEther(balance2After), "ETH");

  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  TRANSFER COMPLETED SUCCESSFULLY!                              ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });