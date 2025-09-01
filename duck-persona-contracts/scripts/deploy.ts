import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Starting complete deployment with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const deployedContracts: { [key: string]: string } = {};

  // 1. Deploy DuckToken (no dependencies)
  console.log("\n1. Deploying DuckToken...");
  const DuckToken = await ethers.getContractFactory("DuckToken");
  const initialSupply = 1000000; // 1 million tokens
  const duckToken = await DuckToken.deploy(initialSupply, deployer.address);
  await duckToken.waitForDeployment();
  deployedContracts.DuckToken = await duckToken.getAddress();
  console.log("✓ DuckToken deployed to:", deployedContracts.DuckToken);

  // 2. Deploy DuckNFT (no dependencies)
  console.log("\n2. Deploying DuckNFT...");
  const DuckNFT = await ethers.getContractFactory("DuckNFT");
  const baseURI = "https://api.duckchain.io/metadata/";
  const duckNFT = await DuckNFT.deploy(baseURI, deployer.address);
  await duckNFT.waitForDeployment();
  deployedContracts.DuckNFT = await duckNFT.getAddress();
  console.log("✓ DuckNFT deployed to:", deployedContracts.DuckNFT);


  // 3. Deploy SkillStore (depends on DuckToken)
  console.log("\n5. Deploying SkillStore...");
  const SkillStore = await ethers.getContractFactory("SkillStore");
  const skillsURI = "https://api.duckchain.io/skills/{id}.json";
  const skillStore = await SkillStore.deploy(deployedContracts.DuckToken, skillsURI, deployer.address);
  await skillStore.waitForDeployment();
  deployedContracts.SkillStore = await skillStore.getAddress();
  console.log("✓ SkillStore deployed to:", deployedContracts.SkillStore);


  // 4. Deploy TipsAndTasks (depends on DuckNFT and DuckToken)
  console.log("\n8. Deploying TipsAndTasks...");
  const TipsAndTasks = await ethers.getContractFactory("TipsAndTasks");
  const tipsAndTasks = await TipsAndTasks.deploy(
    deployedContracts.DuckNFT,
    deployedContracts.DuckToken,
    deployer.address
  );
  await tipsAndTasks.waitForDeployment();
  deployedContracts.TipsAndTasks = await tipsAndTasks.getAddress();
  console.log("✓ TipsAndTasks deployed to:", deployedContracts.TipsAndTasks);

  // 5. Deploy PersonaUpgrades (depends on DuckNFT, SkillStore, and DuckToken)
  console.log("\n9. Deploying PersonaUpgrades...");
  const PersonaUpgrades = await ethers.getContractFactory("PersonaUpgrades");
  const personaUpgrades = await PersonaUpgrades.deploy(
    deployedContracts.DuckNFT,
    deployedContracts.SkillStore,
    deployedContracts.DuckToken,
    deployer.address
  );
  await personaUpgrades.waitForDeployment();
  deployedContracts.PersonaUpgrades = await personaUpgrades.getAddress();
  console.log("✓ PersonaUpgrades deployed to:", deployedContracts.PersonaUpgrades);

 

  // Set up permissions for TipsAndTasks to be orchestrator
  console.log("\n12. Setting up permissions...");
  await duckNFT.setOrchestratorAuth(deployedContracts.TipsAndTasks, true);
  console.log("✓ TipsAndTasks authorized as DuckNFT orchestrator");
  
  await duckNFT.setOrchestratorAuth(deployedContracts.PersonaUpgrades, true);
  console.log("✓ PersonaUpgrades authorized as DuckNFT orchestrator");

  console.log("\n=== COMPLETE DEPLOYMENT SUMMARY ===");
  console.log("Network: DuckChain Mainnet");
  console.log("Deployer:", deployer.address);
  console.log("\nCore Contracts:");
  console.log(`DuckToken: ${deployedContracts.DuckToken}`);
  console.log(`DuckNFT: ${deployedContracts.DuckNFT}`);
  
  
  console.log("\nGamefi Contracts:");
  console.log(`SkillStore: ${deployedContracts.SkillStore}`);
  console.log(`PersonaUpgrades: ${deployedContracts.PersonaUpgrades}`);
  console.log(`TipsAndTasks: ${deployedContracts.TipsAndTasks}`);
;

  console.log("\n=== Next Steps ===");
  console.log("1. Verify contracts on block explorer");
  console.log("2. Set up frontend with these contract addresses");
  console.log("3. Create initial skills in SkillStore");
  console.log("5. Test the complete flow");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});