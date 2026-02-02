// scripts/compareTokens.js
const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║          TOKEN COMPARISON - MAINNET vs TEST                    ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  // Token addresses
  const MAINNET_AQUARI = "0x7f0e9971d3320521fc88f863e173a4cddbb051ba"; // Working token
  
  // Load new token from deployment-info.json
  let NEW_AQUARI;
  if (fs.existsSync('deployment-info.json')) {
    const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
    NEW_AQUARI = deploymentInfo.proxyAddress || deploymentInfo.contractAddress;
  } else {
    NEW_AQUARI = "0x78D84c417bE56da7eA5694acAc5E85EE14E46138";
  }

  const FACTORY = "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6";
  const ROUTER = "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24";
  const WETH = "0x4200000000000000000000000000000000000006";

  console.log("📋 ADDRESSES");
  console.log("═".repeat(70));
  console.log("Mainnet AQUARI (working):", MAINNET_AQUARI);
  console.log("New Test Token:          ", NEW_AQUARI);
  console.log("Network:                 ", network.name);

  // ABI
  const tokenABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function owner() view returns (address)",
    "function pairIsSet() view returns (bool)",
    "function uniswapV2Pair() view returns (address)",
    "function burnTax() view returns (uint256)",
    "function foundationFee() view returns (uint256)",
    "function foundationWallet() view returns (address)",
    "function tradingEnabled() view returns (bool)",
    "function isExcludedFromTax(address) view returns (bool)",
  ];

  const factoryABI = [
    "function getPair(address, address) view returns (address)",
  ];

  const pairABI = [
    "function getReserves() view returns (uint112, uint112, uint32)",
    "function token0() view returns (address)",
    "function totalSupply() view returns (uint256)",
  ];

  const factory = await ethers.getContractAt(factoryABI, FACTORY);

  // Function to analyze a token
  async function analyzeToken(address, label) {
    console.log(`\n${"═".repeat(70)}`);
    console.log(`📊 ${label}`);
    console.log(`${"═".repeat(70)}`);
    console.log("Address:", address);

    const token = await ethers.getContractAt(tokenABI, address);

    // Basic info
    const name = await token.name();
    const symbol = await token.symbol();
    const owner = await token.owner();

    console.log("\n🏷️  BASIC INFO");
    console.log("─".repeat(50));
    console.log("Name:  ", name);
    console.log("Symbol:", symbol);
    console.log("Owner: ", owner);

    // Tax config
    const burnTax = await token.burnTax();
    const foundationFee = await token.foundationFee();
    const foundationWallet = await token.foundationWallet();

    console.log("\n💸 TAX CONFIG");
    console.log("─".repeat(50));
    console.log("Burn Tax:        ", `${burnTax} bps (${Number(burnTax) / 100}%)`);
    console.log("Foundation Fee:  ", `${foundationFee} bps (${Number(foundationFee) / 100}%)`);
    console.log("Total Tax:       ", `${Number(burnTax) + Number(foundationFee)} bps (${(Number(burnTax) + Number(foundationFee)) / 100}%)`);
    console.log("Foundation Wallet:", foundationWallet);

    // Pair status
    const tradingEnabled = await token.tradingEnabled();
    const pairIsSet = await token.pairIsSet();
    const contractPair = await token.uniswapV2Pair();
    const factoryPair = await factory.getPair(address, WETH);

    console.log("\n🔄 PAIR & TRADING");
    console.log("─".repeat(50));
    console.log("Trading Enabled:", tradingEnabled ? "✅ YES" : "❌ NO");
    console.log("pairIsSet:      ", pairIsSet ? "✅ YES (taxes ACTIVE on trades)" : "❌ NO (taxes NOT active)");
    console.log("Contract Pair:  ", contractPair);
    console.log("Factory Pair:   ", factoryPair);

    // Check exclusions
    const routerExcluded = await token.isExcludedFromTax(ROUTER);
    const ownerExcluded = await token.isExcludedFromTax(owner);

    console.log("\n🔓 TAX EXCLUSIONS");
    console.log("─".repeat(50));
    console.log("Router excluded:", routerExcluded ? "✅ YES" : "❌ NO");
    console.log("Owner excluded: ", ownerExcluded ? "✅ YES" : "❌ NO");

    // Liquidity info
    if (factoryPair !== "0x0000000000000000000000000000000000000000") {
      const pair = await ethers.getContractAt(pairABI, factoryPair);
      const [reserve0, reserve1] = await pair.getReserves();
      const token0 = await pair.token0();

      let ethReserve, tokenReserve;
      if (token0.toLowerCase() === address.toLowerCase()) {
        tokenReserve = reserve0;
        ethReserve = reserve1;
      } else {
        ethReserve = reserve0;
        tokenReserve = reserve1;
      }

      console.log("\n💧 LIQUIDITY");
      console.log("─".repeat(50));
      console.log("ETH Reserve:  ", ethers.formatEther(ethReserve), "ETH");
      console.log("Token Reserve:", ethers.formatEther(tokenReserve), symbol);
      
      if (ethReserve > 0n) {
        const price = Number(ethers.formatEther(tokenReserve)) / Number(ethers.formatEther(ethReserve));
        console.log("Price:        ", `1 ETH = ${price.toFixed(2)} ${symbol}`);
      }
    } else {
      console.log("\n💧 LIQUIDITY: ❌ No pair exists");
    }

    return { pairIsSet, tradingEnabled, burnTax: Number(burnTax), foundationFee: Number(foundationFee) };
  }

  // Analyze both tokens
  const mainnet = await analyzeToken(MAINNET_AQUARI, "MAINNET AQUARI (WORKING)");
  const newToken = await analyzeToken(NEW_AQUARI, "NEW TEST TOKEN");

  // Key comparison
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║          KEY DIFFERENCES                                       ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  console.log("                      MAINNET        NEW TOKEN");
  console.log("═".repeat(55));
  console.log(`pairIsSet:            ${mainnet.pairIsSet ? "YES ✅" : "NO ❌"}           ${newToken.pairIsSet ? "YES ✅" : "NO ❌"}`);
  console.log(`tradingEnabled:       ${mainnet.tradingEnabled ? "YES ✅" : "NO ❌"}           ${newToken.tradingEnabled ? "YES ✅" : "NO ❌"}`);
  console.log(`Burn Tax:             ${mainnet.burnTax / 100}%             ${newToken.burnTax / 100}%`);
  console.log(`Foundation Fee:       ${mainnet.foundationFee / 100}%             ${newToken.foundationFee / 100}%`);

  console.log("\n📝 IMPORTANT NOTES:");
  console.log("═".repeat(70));
  console.log("• pairIsSet = false means taxes are NOT applied on Uniswap trades");
  console.log("• The mainnet token works because pairIsSet controls tax logic");
  console.log("• Your _update() function checks: (from == uniswapV2Pair || to == uniswapV2Pair) && pairIsSet");
  console.log("• If pairIsSet = false, trades go through WITHOUT tax deduction");

  if (!newToken.pairIsSet) {
    console.log("\n⚠️  YOUR NEW TOKEN has pairIsSet = false");
    console.log("   This means liquidity can be added without tax issues!");
    console.log("   After adding liquidity, call setUniswapV2Pair() to enable taxes.");
  }

  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║          COMPARISON COMPLETE                                   ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });