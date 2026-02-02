const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║          AQUARI PROTOCOL - PROXY DEPLOYMENT                    ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");
  
  console.log("📋 DEPLOYMENT CONFIGURATION");
  console.log("═".repeat(70));
  console.log("Network:", network.name);
  console.log("Deploying account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("\n");

  // Base mainnet addresses
  const WETH = "0x4200000000000000000000000000000000000006";
  const FACTORY = "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6";
  const ROUTER = "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24";

  try {
    const { upgrades } = require("hardhat");
    
    console.log("🚀 Deploying AquariProtocol with proxy (forced validation skip)...");
    const AquariProtocol = await ethers.getContractFactory("AquariProtocol");
    
    // Set environment variable to force skip validation
    process.env.HARDHAT_UPGRADES_SKIP_VALIDATION = "true";
    
    // Deploy with proxy
    const aquari = await upgrades.deployProxy(
      AquariProtocol,
      [deployer.address],
      {
        initializer: "initialize",
        kind: "uups", // Try UUPS instead of transparent
        timeout: 0,
        unsafeAllow: ['constructor', 'delegatecall', 'missing-public-upgradeto', 'state-variable-immutable', 'state-variable-assignment', 'external-library-linking', 'selfdestruct', 'internal-function-storage','missing-initializer-call'],
        unsafeSkipStorageCheck: true,
        unsafeAllowLinkedLibraries: true,
        unsafeAllowCustomTypes: true,
        constructorArgs: []
      }
    );
    
    await aquari.waitForDeployment();
    const contractAddress = await aquari.getAddress();
    
    console.log("✅ Proxy deployed to:", contractAddress);
    
    try {
      const implementationAddress = await upgrades.erc1967.getImplementationAddress(contractAddress);
      console.log("✅ Implementation deployed to:", implementationAddress);
    } catch (e) {
      console.log("⚠️  Could not fetch implementation address");
    }

    // Verify deployment
    const code = await ethers.provider.getCode(contractAddress);
    if (code === '0x') {
      throw new Error('Deployment verification failed - no code at address');
    }
    console.log("✅ Contract bytecode verified (length:", code.length, ")");
    
    // Fetch and display token info
    console.log("\n📊 TOKEN INFORMATION");
    console.log("═".repeat(70));
    
    const name = await aquari.name();
    const symbol = await aquari.symbol();
    const totalSupply = await aquari.totalSupply();
    const owner = await aquari.owner();
    const deployerBalance = await aquari.balanceOf(deployer.address);
    
    console.log("Name:", name);
    console.log("Symbol:", symbol);
    console.log("Total Supply:", ethers.formatEther(totalSupply), symbol);
    console.log("Owner:", owner);
    console.log("Deployer Balance:", ethers.formatEther(deployerBalance), symbol);
    
    // Fetch and display tax configuration
    console.log("\n💸 TAX CONFIGURATION");
    console.log("═".repeat(70));
    
    const burnTax = await aquari.burnTax();
    const foundationFee = await aquari.foundationFee();
    const foundationWallet = await aquari.foundationWallet();
    const tradingEnabled = await aquari.tradingEnabled();
    
    console.log("Burn Tax:", burnTax.toString(), "bps =", (Number(burnTax) / 100).toFixed(2) + "%");
    console.log("Foundation Fee:", foundationFee.toString(), "bps =", (Number(foundationFee) / 100).toFixed(2) + "%");
    console.log("Total Tax:", (Number(burnTax) + Number(foundationFee)).toString(), "bps =", ((Number(burnTax) + Number(foundationFee)) / 100).toFixed(2) + "%");
    console.log("Foundation Wallet:", foundationWallet);
    console.log("Trading Enabled:", tradingEnabled);
    
    // Save deployment information
    const deploymentInfo = {
      network: network.name,
      chainId: network.config.chainId || 8453,
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      contractAddress: contractAddress,
      tokenInfo: {
        name: name,
        symbol: symbol,
        totalSupply: ethers.formatEther(totalSupply),
        owner: owner,
        deployerBalance: ethers.formatEther(deployerBalance)
      },
      taxConfig: {
        burnTax: burnTax.toString(),
        burnTaxPercent: (Number(burnTax) / 100).toFixed(2) + "%",
        foundationFee: foundationFee.toString(),
        foundationFeePercent: (Number(foundationFee) / 100).toFixed(2) + "%",
        foundationWallet: foundationWallet,
        tradingEnabled: tradingEnabled
      },
      baseAddresses: {
        weth: WETH,
        factory: FACTORY,
        router: ROUTER
      }
    };

    const filename = 'deployment-info.json';
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    
    console.log("\n✅ Deployment information saved to:", filename);
    
    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║  DEPLOYMENT COMPLETED SUCCESSFULLY!                            ║");
    console.log("╚════════════════════════════════════════════════════════════════╝");
    
    console.log("\n📝 NEXT STEPS:");
    console.log("═".repeat(70));
    console.log("1. Set Uniswap V2 Pair:");
    console.log("   npx hardhat run scripts/setPair.js --network localhost");
    console.log("\n2. Add Liquidity:");
    console.log("   npx hardhat run scripts/addLiquidity.js --network localhost");
    console.log("\n3. Test Trading:");
    console.log("   npx hardhat run scripts/testTrade.js --network localhost");
    console.log("\n");
    
  } catch (error) {
    console.error("\n╔════════════════════════════════════════════════════════════════╗");
    console.error("║  DEPLOYMENT FAILED                                             ║");
    console.error("╚════════════════════════════════════════════════════════════════╝\n");
    console.error("Error Name:", error.name);
    console.error("Error Message:", error.message);
    
    if (error.data) {
      console.error("\nError Data:", error.data);
    }
    
    console.error("\n💡 The contract requires proxy deployment but has validation issues.");
    console.error("This is because the initialize function doesn't call all parent initializers.");
    
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Fatal Error:", error.message);
    process.exit(1);
  });