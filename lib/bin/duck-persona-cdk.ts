#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DuckPersonaStack } from '../duck-persona-stack';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = new cdk.App();

// Get configuration from environment or context
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || app.node.tryGetContext('account'),
  region: process.env.CDK_DEFAULT_REGION || app.node.tryGetContext('region') || 'us-east-1',
};

// Deploy stack
new DuckPersonaStack(app, 'DuckPersonaStack', {
  env,
  description: 'Duck Persona AI Agent Infrastructure',
  
  // Pass environment variables as props
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  rpcUrl: process.env.RPC_URL,
  privateKey: process.env.PRIVATE_KEY,
  
  contractAddresses: {
    duckNft: process.env.DUCK_NFT_CONTRACT,
    duckToken: process.env.DUCK_TOKEN_CONTRACT,
    skillStore: process.env.SKILL_STORE_CONTRACT,
    personaUpgrades: process.env.PERSONA_UPGRADES_CONTRACT,
    tipsTasks: process.env.TIPS_TASKS_CONTRACT,
  },
  
  tags: {
    Project: 'DuckPersona',
    Environment: process.env.NODE_ENV || 'development',
    ManagedBy: 'AWS-CDK'
  }
});

app.synth();