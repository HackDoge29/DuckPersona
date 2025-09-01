import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    DuckChainMainnet: {
      url: `https://rpc.duckchain.io/`,
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 5545
    },
  },
  etherscan: {
    // Add API key if you want contract verification
    apiKey: {
      DuckChainTestnet: process.env.ETHERSCAN_API_KEY || "dummy",
    },
    customChains: [
      {
        network: "DuckChainTestnet",
        chainId: 20241133,
        urls: {
          apiURL: "https://testnet-scan.duckchain.io/api",
          browserURL: "https://testnet-scan.duckchain.io"
        }
      }
    ]
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
};

export default config;