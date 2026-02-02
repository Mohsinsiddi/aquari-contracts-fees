// scripts/mainnet/1_configureToken.js
// Run: npx hardhat run scripts/mainnet/1_configureToken.js --network baseMainnet
//
// This script configures:
// 1. Foundation Wallet
// 2. Tax Configuration (burn tax + foundation fee)
// 3. Uniswap V2 Pair (enables taxes on swaps)
//
const { ethers } = require("hardhat");

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                           CONFIGURATION                                    ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const CONFIG = {
  // AQUARIT Test Token
  TOKEN: "0x78D84c417bE56da7eA5694acAc5E85EE14E46138",
  PAIR: "0xcb02d34fBD34dC5af95bABb3AFE7bF23c376b6a7",
  WETH: "0x4200000000000000000000000000000000000006",
};

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                        TAX CONFIGURATION                                   ║
// ║              100 bps = 1%,  10000 bps = 100%                               ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const TAX_CONFIG = {
  BURN_TAX_BPS: 125,           // 1.25%
  FOUNDATION_FEE_BPS: 125,     // 1.25%
  // Total = 2.5%
};

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                     FOUNDATION WALLET                                      ║
// ║              Set to null to skip updating foundation wallet                ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const FOUNDATION_WALLET = {
  // Set new foundation wallet (null = skip, keep current)
  NEW_WALLET: "0x8c5DF0e0a8DDE9b701BEf30761E54D86c69f430A",
  
  // Example:
  // NEW_WALLET: "0x1234567890123456789012345678901234567890",
};

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                              ABI                                           ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function owner() view returns (address)",
  "function pairIsSet() view returns (bool)",
  "function tradingEnabled() view returns (bool)",
  "function uniswapV2Pair() view returns (address)",
  "function burnTax() view returns (uint256)",
  "function foundationFee() view returns (uint256)",
  "function foundationWallet() view returns (address)",
  "function setFoundationWallet(address newWallet) external",
  "function setUniswapV2Pair(address newPairAddress) external",
  "function setTaxConfig(uint256 newBurnTax, uint256 newFoundationFee) external",
];

const PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112, uint112, uint32)",
];

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                            MAIN SCRIPT                                     ║
// ╚════════════════════════════════════════════════════════════════════════════╝

async function main() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════════════════╗");
  console.log("║              AQUARIT TOKEN - CONFIGURE PAIR, TAXES & WALLET                ║");
  console.log("║                            Base Mainnet                                    ║");
  console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");

  const [deployer] = await ethers.getSigners();

  // ─────────────────────────────────────────────────────────────────────────────
  // WALLET CHECK
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("💰 WALLET CHECK");
  console.log("═".repeat(78));
  const deployerEth = await ethers.provider.getBalance(deployer.address);
  console.log(`Caller:      ${deployer.address}`);
  console.log(`ETH Balance: ${ethers.formatEther(deployerEth)} ETH`);

  if (deployerEth < ethers.parseEther("0.0005")) {
    console.log("\n❌ ERROR: Insufficient ETH for gas!");
    process.exit(1);
  }
  console.log(`✅ Sufficient ETH for gas\n`);

  // Connect to contracts
  const token = await ethers.getContractAt(TOKEN_ABI, CONFIG.TOKEN);
  const pair = await ethers.getContractAt(PAIR_ABI, CONFIG.PAIR);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1: Read Current State
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("📋 STEP 1: CURRENT CONTRACT STATE");
  console.log("═".repeat(78));

  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = await token.decimals();
  const totalSupply = await token.totalSupply();
  const owner = await token.owner();
  const pairIsSet = await token.pairIsSet();
  const tradingEnabled = await token.tradingEnabled();
  const currentPair = await token.uniswapV2Pair();
  const currentBurnTax = await token.burnTax();
  const currentFoundationFee = await token.foundationFee();
  const currentFoundationWallet = await token.foundationWallet();

  console.log(`Token Name:         ${name}`);
  console.log(`Symbol:             ${symbol}`);
  console.log(`Decimals:           ${decimals}`);
  console.log(`Total Supply:       ${ethers.formatUnits(totalSupply, decimals)} ${symbol}`);
  console.log(`Owner:              ${owner}`);
  console.log(`─`.repeat(78));
  console.log(`Pair Is Set:        ${pairIsSet ? "✅ YES (TAXES ACTIVE)" : "❌ NO (TAXES INACTIVE)"}`);
  console.log(`Trading Enabled:    ${tradingEnabled ? "✅ YES" : "❌ NO"}`);
  console.log(`Current Pair:       ${currentPair}`);
  console.log(`─`.repeat(78));
  console.log(`Burn Tax:           ${currentBurnTax} bps (${Number(currentBurnTax) / 100}%)`);
  console.log(`Foundation Fee:     ${currentFoundationFee} bps (${Number(currentFoundationFee) / 100}%)`);
  console.log(`Total Tax:          ${Number(currentBurnTax) + Number(currentFoundationFee)} bps (${(Number(currentBurnTax) + Number(currentFoundationFee)) / 100}%)`);
  console.log(`Foundation Wallet:  ${currentFoundationWallet}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2: Pair Reserves
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n💧 STEP 2: PAIR RESERVES");
  console.log("═".repeat(78));

  const token0 = await pair.token0();
  const [reserve0, reserve1] = await pair.getReserves();
  const wethIsToken0 = token0.toLowerCase() === CONFIG.WETH.toLowerCase();
  const wethReserve = wethIsToken0 ? reserve0 : reserve1;
  const tokenReserve = wethIsToken0 ? reserve1 : reserve0;

  console.log(`Pair Address:       ${CONFIG.PAIR}`);
  console.log(`WETH Reserve:       ${ethers.formatEther(wethReserve)} ETH`);
  console.log(`${symbol} Reserve:     ${ethers.formatUnits(tokenReserve, decimals)} ${symbol}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3: Permission Check
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n🔐 STEP 3: PERMISSION CHECK");
  console.log("═".repeat(78));

  if (deployer.address.toLowerCase() !== owner.toLowerCase()) {
    console.log(`❌ ERROR: Caller is not owner!`);
    console.log(`   Caller: ${deployer.address}`);
    console.log(`   Owner:  ${owner}`);
    process.exit(1);
  }
  console.log(`✅ Caller is owner - authorized`);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 4: Update Foundation Wallet (if configured)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n🏦 STEP 4: FOUNDATION WALLET");
  console.log("═".repeat(78));

  console.log(`Current: ${currentFoundationWallet}`);

  if (FOUNDATION_WALLET.NEW_WALLET) {
    const newWallet = FOUNDATION_WALLET.NEW_WALLET;

    if (newWallet.toLowerCase() === currentFoundationWallet.toLowerCase()) {
      console.log(`ℹ️  Already set to desired address - skipping`);
    } else {
      console.log(`New:     ${newWallet}`);
      console.log(`\n📝 Updating foundation wallet...`);

      const walletTx = await token.setFoundationWallet(newWallet);
      console.log(`   TX Hash: ${walletTx.hash}`);
      const walletReceipt = await walletTx.wait();

      console.log(`✅ Foundation wallet updated!`);
      console.log(`   Block: ${walletReceipt.blockNumber}`);
      console.log(`   Gas:   ${walletReceipt.gasUsed.toString()}`);
    }
  } else {
    console.log(`ℹ️  No new wallet configured - keeping current`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 5: Set Tax Configuration
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n💸 STEP 5: TAX CONFIGURATION");
  console.log("═".repeat(78));

  const newBurnTax = TAX_CONFIG.BURN_TAX_BPS;
  const newFoundationFee = TAX_CONFIG.FOUNDATION_FEE_BPS;
  const newTotalTax = newBurnTax + newFoundationFee;

  console.log(`Current Burn Tax:       ${currentBurnTax} bps (${Number(currentBurnTax) / 100}%)`);
  console.log(`Current Foundation Fee: ${currentFoundationFee} bps (${Number(currentFoundationFee) / 100}%)`);
  console.log(`─`.repeat(78));
  console.log(`Desired Burn Tax:       ${newBurnTax} bps (${newBurnTax / 100}%)`);
  console.log(`Desired Foundation Fee: ${newFoundationFee} bps (${newFoundationFee / 100}%)`);
  console.log(`Desired Total Tax:      ${newTotalTax} bps (${newTotalTax / 100}%)`);

  const taxesMatch =
    Number(currentBurnTax) === newBurnTax &&
    Number(currentFoundationFee) === newFoundationFee;

  if (taxesMatch) {
    console.log(`\nℹ️  Taxes already match - skipping`);
  } else {
    console.log(`\n📝 Updating tax configuration...`);

    const taxTx = await token.setTaxConfig(newBurnTax, newFoundationFee);
    console.log(`   TX Hash: ${taxTx.hash}`);
    const taxReceipt = await taxTx.wait();

    console.log(`✅ Tax configuration updated!`);
    console.log(`   Block: ${taxReceipt.blockNumber}`);
    console.log(`   Gas:   ${taxReceipt.gasUsed.toString()}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 6: Set Pair Address (Enables Taxes)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n🔗 STEP 6: SET PAIR (ENABLE TAXES)");
  console.log("═".repeat(78));

  if (pairIsSet) {
    console.log(`ℹ️  Pair already set: ${currentPair}`);
    console.log(`   Taxes are ACTIVE - skipping`);
  } else {
    console.log(`Setting pair to: ${CONFIG.PAIR}`);
    console.log(`⚠️  This will ACTIVATE taxes on all swaps!`);

    const pairTx = await token.setUniswapV2Pair(CONFIG.PAIR);
    console.log(`\n   TX Hash: ${pairTx.hash}`);
    const pairReceipt = await pairTx.wait();

    console.log(`✅ Pair set! Taxes now ACTIVE!`);
    console.log(`   Block: ${pairReceipt.blockNumber}`);
    console.log(`   Gas:   ${pairReceipt.gasUsed.toString()}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FINAL STATE
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════════════════╗");
  console.log("║                         ✅ FINAL STATE                                     ║");
  console.log("╚════════════════════════════════════════════════════════════════════════════╝");

  const finalPairIsSet = await token.pairIsSet();
  const finalPair = await token.uniswapV2Pair();
  const finalBurnTax = await token.burnTax();
  const finalFoundationFee = await token.foundationFee();
  const finalFoundationWallet = await token.foundationWallet();

  console.log(`
Token:              ${CONFIG.TOKEN}
Symbol:             ${symbol}
─────────────────────────────────────────────────────────────────────────────
Pair Is Set:        ${finalPairIsSet ? "✅ YES (TAXES ACTIVE)" : "❌ NO"}
Pair Address:       ${finalPair}
─────────────────────────────────────────────────────────────────────────────
Burn Tax:           ${finalBurnTax} bps (${Number(finalBurnTax) / 100}%)
Foundation Fee:     ${finalFoundationFee} bps (${Number(finalFoundationFee) / 100}%)
Total Tax:          ${Number(finalBurnTax) + Number(finalFoundationFee)} bps (${(Number(finalBurnTax) + Number(finalFoundationFee)) / 100}%)
─────────────────────────────────────────────────────────────────────────────
Foundation Wallet:  ${finalFoundationWallet}
`);

  console.log("╔════════════════════════════════════════════════════════════════════════════╗");
  console.log("║                      ✅ CONFIGURATION COMPLETE                             ║");
  console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message || error);
    process.exit(1);
  });