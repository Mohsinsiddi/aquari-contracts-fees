// scripts/1_setPairAndFees.js
// Run: npx hardhat run scripts/1_setPairAndFees.js --network baseMainnet
//
// This script will:
// 1. Set the Uniswap V2 Pair address (enables tax on swaps)
// 2. Set the tax configuration (burn tax + foundation fee)
//
const { ethers } = require("hardhat");

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                           CONFIGURATION                                    ║
// ║         Update these addresses for MAINNET vs TESTNET                      ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const CONFIG = {
  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  TESTNET (AQUARIT) - Current                                            │
  // └─────────────────────────────────────────────────────────────────────────┘
  TOKEN: "0x78D84c417bE56da7eA5694acAc5E85EE14E46138",
  PAIR: "0xcb02d34fBD34dC5af95bABb3AFE7bF23c376b6a7",

  // ┌─────────────────────────────────────────────────────────────────────────┐
  // │  MAINNET (AQUARI) - Uncomment for production                            │
  // └─────────────────────────────────────────────────────────────────────────┘
  // TOKEN: "0x7f0e9971d3320521fc88f863e173a4cddbb051ba",
  // PAIR: "0x30Ec7B2f5be26d03D20AC86554dAadD2b738CA0F",

  // Base Chain Addresses (same for both)
  WETH: "0x4200000000000000000000000000000000000006",
  UNISWAP_V2_ROUTER: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
  UNISWAP_V2_FACTORY: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
};

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                        TAX CONFIGURATION                                   ║
// ║              Set your desired tax rates here (in basis points)             ║
// ║              100 bps = 1%                                                  ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const TAX_CONFIG = {
  // Burn Tax - tokens burned on each swap
  BURN_TAX_BPS: 125,           // 1.25% (125 basis points)

  // Foundation Fee - tokens sent to foundation wallet on each swap
  FOUNDATION_FEE_BPS: 125,     // 1.25% (125 basis points)

  // Total Tax = BURN_TAX + FOUNDATION_FEE = 2.5%

  // Set to true to update taxes even if already set
  FORCE_UPDATE_TAXES: false,
};

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                              ABIs                                          ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function owner() view returns (address)",
  "function pairIsSet() view returns (bool)",
  "function tradingEnabled() view returns (bool)",
  "function uniswapV2Pair() view returns (address)",
  "function burnTax() view returns (uint256)",
  "function foundationFee() view returns (uint256)",
  "function foundationWallet() view returns (address)",
  "function isExcludedFromFee(address) view returns (bool)",
  "function setUniswapV2Pair(address _pair) external",
  "function setTaxConfig(uint256 _burnTax, uint256 _foundationFee) external",
  "function setFoundationWallet(address _wallet) external",
];

const PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
];

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                            MAIN SCRIPT                                     ║
// ╚════════════════════════════════════════════════════════════════════════════╝

async function main() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════════════════╗");
  console.log("║              AQUARI TOKEN - SET PAIR ADDRESS & TAX FEES                    ║");
  console.log("║                         Base Mainnet Direct                                ║");
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

  if (deployerEth < ethers.parseEther("0.001")) {
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
  const foundationWallet = await token.foundationWallet();

  console.log(`Token Name:        ${name}`);
  console.log(`Symbol:            ${symbol}`);
  console.log(`Decimals:          ${decimals}`);
  console.log(`Total Supply:      ${ethers.formatUnits(totalSupply, decimals)} ${symbol}`);
  console.log(`Owner:             ${owner}`);
  console.log(`─`.repeat(78));
  console.log(`Pair Is Set:       ${pairIsSet ? "✅ YES (TAXES ACTIVE)" : "❌ NO (TAXES INACTIVE)"}`);
  console.log(`Trading Enabled:   ${tradingEnabled ? "✅ YES" : "❌ NO"}`);
  console.log(`Current Pair:      ${currentPair}`);
  console.log(`─`.repeat(78));
  console.log(`Current Burn Tax:      ${currentBurnTax} bps (${Number(currentBurnTax) / 100}%)`);
  console.log(`Current Foundation Fee: ${currentFoundationFee} bps (${Number(currentFoundationFee) / 100}%)`);
  console.log(`Current Total Tax:     ${Number(currentBurnTax) + Number(currentFoundationFee)} bps (${(Number(currentBurnTax) + Number(currentFoundationFee)) / 100}%)`);
  console.log(`Foundation Wallet: ${foundationWallet}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2: Read Pair Reserves
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n💧 STEP 2: UNISWAP V2 PAIR RESERVES");
  console.log("═".repeat(78));

  const token0 = await pair.token0();
  const token1 = await pair.token1();
  const [reserve0, reserve1] = await pair.getReserves();

  const wethIsToken0 = token0.toLowerCase() === CONFIG.WETH.toLowerCase();
  const wethReserve = wethIsToken0 ? reserve0 : reserve1;
  const tokenReserve = wethIsToken0 ? reserve1 : reserve0;

  console.log(`Pair Address:      ${CONFIG.PAIR}`);
  console.log(`Token0:            ${token0} ${wethIsToken0 ? "(WETH)" : `(${symbol})`}`);
  console.log(`Token1:            ${token1} ${wethIsToken0 ? `(${symbol})` : "(WETH)"}`);
  console.log(`─`.repeat(78));
  console.log(`WETH Reserve:      ${ethers.formatEther(wethReserve)} ETH`);
  console.log(`${symbol} Reserve:    ${ethers.formatUnits(tokenReserve, decimals)} ${symbol}`);

  if (Number(wethReserve) > 0) {
    console.log(`Price:             1 ETH = ${(Number(tokenReserve) / Number(wethReserve)).toFixed(2)} ${symbol}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3: Verify Caller is Owner
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n🔐 STEP 3: PERMISSION CHECK");
  console.log("═".repeat(78));

  if (deployer.address.toLowerCase() !== owner.toLowerCase()) {
    console.log(`❌ ERROR: Caller is not owner!`);
    console.log(`   Caller: ${deployer.address}`);
    console.log(`   Owner:  ${owner}`);
    console.log(`\n⚠️  Only owner can call setUniswapV2Pair() and setTaxConfig()`);
    process.exit(1);
  }
  console.log(`✅ Caller is owner - authorized to configure`);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 4: Set Tax Configuration
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n🔧 STEP 4: SET TAX CONFIGURATION");
  console.log("═".repeat(78));

  const newBurnTax = TAX_CONFIG.BURN_TAX_BPS;
  const newFoundationFee = TAX_CONFIG.FOUNDATION_FEE_BPS;
  const newTotalTax = newBurnTax + newFoundationFee;

  console.log(`Desired Burn Tax:       ${newBurnTax} bps (${newBurnTax / 100}%)`);
  console.log(`Desired Foundation Fee: ${newFoundationFee} bps (${newFoundationFee / 100}%)`);
  console.log(`Desired Total Tax:      ${newTotalTax} bps (${newTotalTax / 100}%)`);

  const taxesMatch = 
    Number(currentBurnTax) === newBurnTax && 
    Number(currentFoundationFee) === newFoundationFee;

  if (taxesMatch && !TAX_CONFIG.FORCE_UPDATE_TAXES) {
    console.log(`\nℹ️  Tax configuration already matches desired values`);
    console.log(`   Skipping setTaxConfig() call`);
  } else {
    console.log(`\n📝 Setting tax configuration...`);
    console.log(`   Burn Tax:       ${currentBurnTax} → ${newBurnTax} bps`);
    console.log(`   Foundation Fee: ${currentFoundationFee} → ${newFoundationFee} bps`);

    const taxTx = await token.setTaxConfig(newBurnTax, newFoundationFee);
    console.log(`\n📤 TX Submitted: ${taxTx.hash}`);
    console.log(`   Waiting for confirmation...`);

    const taxReceipt = await taxTx.wait();

    console.log(`\n✅ TAX CONFIG SET!`);
    console.log(`─`.repeat(78));
    console.log(`TX Hash:     ${taxReceipt.hash}`);
    console.log(`Block:       ${taxReceipt.blockNumber}`);
    console.log(`Gas Used:    ${taxReceipt.gasUsed.toString()}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 5: Set Pair Address (Enables Taxes)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n🔧 STEP 5: SET PAIR ADDRESS (ENABLE TAXES)");
  console.log("═".repeat(78));

  if (pairIsSet) {
    console.log(`ℹ️  Pair is already set to: ${currentPair}`);
    console.log(`   Taxes are already ACTIVE`);
    console.log(`   Skipping setUniswapV2Pair() call`);
  } else {
    console.log(`Setting pair to: ${CONFIG.PAIR}`);
    console.log(`⚠️  This will ACTIVATE taxes on all swaps!`);

    const pairTx = await token.setUniswapV2Pair(CONFIG.PAIR);
    console.log(`\n📤 TX Submitted: ${pairTx.hash}`);
    console.log(`   Waiting for confirmation...`);

    const pairReceipt = await pairTx.wait();

    console.log(`\n✅ PAIR SET!`);
    console.log(`─`.repeat(78));
    console.log(`TX Hash:     ${pairReceipt.hash}`);
    console.log(`Block:       ${pairReceipt.blockNumber}`);
    console.log(`Gas Used:    ${pairReceipt.gasUsed.toString()}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 6: Verify Final State
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n✅ STEP 6: FINAL CONTRACT STATE");
  console.log("═".repeat(78));

  const finalPairIsSet = await token.pairIsSet();
  const finalPair = await token.uniswapV2Pair();
  const finalBurnTax = await token.burnTax();
  const finalFoundationFee = await token.foundationFee();
  const finalTotalTax = Number(finalBurnTax) + Number(finalFoundationFee);

  console.log(`Pair Is Set:        ${finalPairIsSet ? "✅ YES (TAXES NOW ACTIVE!)" : "❌ NO"}`);
  console.log(`Pair Address:       ${finalPair}`);
  console.log(`─`.repeat(78));
  console.log(`Burn Tax:           ${finalBurnTax} bps (${Number(finalBurnTax) / 100}%)`);
  console.log(`Foundation Fee:     ${finalFoundationFee} bps (${Number(finalFoundationFee) / 100}%)`);
  console.log(`Total Tax:          ${finalTotalTax} bps (${finalTotalTax / 100}%)`);
  console.log(`Foundation Wallet:  ${foundationWallet}`);

  console.log("\n╔════════════════════════════════════════════════════════════════════════════╗");
  console.log("║                    ✅ CONFIGURATION COMPLETE                               ║");
  console.log("╠════════════════════════════════════════════════════════════════════════════╣");
  console.log(`║   Pair:           ${finalPair}             ║`);
  console.log(`║   Burn Tax:       ${String(Number(finalBurnTax) / 100).padEnd(5)}%                                                    ║`);
  console.log(`║   Foundation Fee: ${String(Number(finalFoundationFee) / 100).padEnd(5)}%                                                    ║`);
  console.log(`║   Total Tax:      ${String(finalTotalTax / 100).padEnd(5)}%                                                    ║`);
  console.log("╠════════════════════════════════════════════════════════════════════════════╣");
  console.log("║                     ║");
  console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message || error);
    process.exit(1);
  });