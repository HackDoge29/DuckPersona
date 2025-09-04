import * as cdk from 'aws-cdk-lib';
import { DuckPersonaStack } from './lib/duck-persona-stack';
import * as dotenv from "dotenv";

dotenv.config();

const app = new cdk.App();

// Development environment
new DuckPersonaStack(app, 'DuckPersonaDev', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1'
  },
  tags: {
    Environment: 'development',
    Project: 'DuckPersona'
  }
});

// Production environment
new DuckPersonaStack(app, 'DuckPersonaProd', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1'
  },
  tags: {
    Environment: 'production',
    Project: 'DuckPersona'
  }
});
