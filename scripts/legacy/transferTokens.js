// scripts/transferTokens.js
const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║          TRANSFER AQUARIT TOKENS                               ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  // Load deployment info
  const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
  const AQUARI = deploymentInfo.proxyAddress || deploymentInfo.contractAddress;

  const [deployer] = await ethers.getSigners();
  const recipient = "0x0650f665753A34d477dBE22A7CBF9689e3401334";
  const amount = ethers.parseEther("10000"); // 10,000 tokens

  console.log("📋 TRANSFER DETAILS");
  console.log("═".repeat(70));
  console.log("Token:    ", AQUARI);
  console.log("From:     ", deployer.address);
  console.log("To:       ", recipient);
  console.log("Amount:   ", "10,000 AQUARIT");

  // ABI
  const tokenABI = [
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function symbol() view returns (string)",
  ];

  const token = await ethers.getContractAt(tokenABI, AQUARI);
  const symbol = await token.symbol();

  // Balances before
  const senderBefore = await token.balanceOf(deployer.address);
  const recipientBefore = await token.balanceOf(recipient);

  console.log("\n💰 BALANCES BEFORE");
  console.log("═".repeat(70));
  console.log("Sender:   ", ethers.formatEther(senderBefore), symbol);
  console.log("Recipient:", ethers.formatEther(recipientBefore), symbol);

  // Transfer
  console.log("\n🚀 SENDING TRANSACTION...");
  console.log("═".repeat(70));

  const tx = await token.transfer(recipient, amount);
  console.log("Transaction Hash:", tx.hash);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log("✅ Confirmed in block:", receipt.blockNumber);
  console.log("Gas Used:", receipt.gasUsed.toString());

  // Balances after
  const senderAfter = await token.balanceOf(deployer.address);
  const recipientAfter = await token.balanceOf(recipient);

  console.log("\n💰 BALANCES AFTER");
  console.log("═".repeat(70));
  console.log("Sender:   ", ethers.formatEther(senderAfter), symbol);
  console.log("Recipient:", ethers.formatEther(recipientAfter), symbol);

  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║          TRANSFER COMPLETED SUCCESSFULLY!                      ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });