require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.21",
    settings: {
      optimizer: { enabled: true, runs: 100 },
    },
  },

  networks: {
    // Local Hardhat node (for unit tests)
    hardhat: {
      chainId: 8453,
    },

    // Connect to Docker fork node (Anvil)
    // Anvil generates 10 deterministic accounts with 10000 ETH each
    fork: {
      url: "http://localhost:8545",
      chainId: 8453,
      accounts: [
        // Account #0 - Owner/Deployer
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        // Account #1 - Test buyer (not excluded from fees)
        "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
        // Account #2 - Test seller
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
      ],
    },

    // Base Mainnet (production)
    base: {
      url: process.env.BASE_RPC || "https://base-mainnet.public.blastapi.io",
      chainId: 8453,
      accounts: process.env.ADMIN_KEY ? [process.env.ADMIN_KEY] : [],
    },
  },

  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_API_KEY || "",
    },
  },
};
