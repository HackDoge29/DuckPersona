# DuckPersona
DuckPersona creates AI Duck NFTs that are actual intelligent agents - not just static profile pictures, but autonomous entities with memory, skills, and economic agency. Each Duck is a unique AI personality that can chat, learn, create content, complete tasks, and participate in a $DUCK token economy, all through an intuitive Telegram interface.

## 📁 Project Structure

## 🤖 Telegram Commands

- `/mint` - Create your AI Duck NFT
- `/profile` - View duck stats and skills
- `/upgrade <skill>` - Purchase and equip skills
- `/tip @user <amount>` - Tip another user's duck
- `/task create "desc" <reward> <hours>` - Create a task
- `/task complete <hash> <proof>` - Complete a task
- Chat naturally with your duck for AI interactions!

## 🌟 Features

### Current
- ✅ Duck NFT minting with deterministic traits
- ✅ $DUCK token economy with tips and tasks
- ✅ Skill system (MemeSmith, Summarizer)
- ✅ AI chat with persistent memory
- ✅ Telegram bot interface
- ✅ Action execution system

### Roadmap
- 🔄 Advanced skill marketplace
- 🔄 Duck-to-duck interactions
- 🔄 Seasonal events and rewards
- 🔄 Cross-chain bridge support
- 🔄 DAO governance for new features

## 🛠️ Development

### Project Structure
```
duck-persona/
├── contracts/          # Smart contracts
├── lambda/            # AWS Lambda functions
├── lib/              # CDK infrastructure
├── scripts/          # Deployment scripts
├── test/             # Test suites
├── monitoring/       # Observability configs
└── docs/             # Documentation
```

### Available Skills
- **MemeSmith**: Create memes and images
- **Summarizer**: Summarize links and content
- More skills coming soon!


## 🚀 Quick Start Guide

### 1. Environment Setup

```bash
# Clone repository
git clone https://github.com/hackdoge29/duckpersona.git
cd duckpersona

# Install dependencies
make setup

# Copy environment template
cp .env.example .env
# Fill in your values (see Environment Variables section)
```

### 2. Local Development

```bash
# Start local services (DynamoDB, OpenSearch, etc.)
make local-start

# Run tests
make test

# Start development mode
make dev
```

### 3. Deploy to Production

```bash
# Deploy smart contracts first
make deploy-contracts

# Deploy AWS infrastructure
make deploy-aws

# Setup Telegram webhook
make setup-webhook
```

## 🔧 Environment Variables

### Required Variables

```bash
# Telegram Bot (get from @BotFather)
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Blockchain
RPC_URL=https://rpc.duckchain.io/
PRIVATE_KEY=0x_your_private_key_for_contract_interactions

# AWS
AWS_REGION=us-east-1
CDK_DEFAULT_ACCOUNT=your_aws_account_id

# Contract Addresses 
DUCK_NFT_CONTRACT=0x734F53765a9eEe59A4509a71C75fa15FAF73184C
DUCK_TOKEN_CONTRACT=0xcE48924fE33B1dCD0c4CFbB3Cc99149a18CA439E
SKILL_STORE_CONTRACT=00xe730899a822497909eFA7d51CE1f580Ed04a9F39
PERSONA_UPGRADES_CONTRACT=0x1D7f1713eE2732648264f6f52c087D5eE871F674
TIPS_TASKS_CONTRACT=0x452Bc3C08B34303e3eCE590232196A9Ad19C0B1a
```

### Optional Variables

```bash
# Development
NODE_ENV=development
DEBUG=true
LOG_LEVEL=debug

# Monitoring
SENTRY_DSN=your_sentry_dsn
DATADOG_API_KEY=your_datadog_key

# External Services
OPENAI_API_KEY=your_openai_key  # Alternative to Bedrock
PINATA_API_KEY=your_pinata_key  # For IPFS storage
```

## 📋 Deployment Checklist

### Pre-deployment

- [x] Environment variables configured
- [x] AWS credentials set up
- [x] Telegram bot created (@BotFather)
- [x] Domain name registered (optional)
- [x] SSL certificate obtained (optional)

### Contract Deployment

```bash
# 1. Test on local network
npx hardhat node
npm run deploy:contracts -- --network localhost

# 2. Deploy to testnet
npm run deploy:contracts -- --network duckTestnet

# 3. Verify contracts
npx hardhat verify --network duckTestnet 

# 4. Deploy to mainnet
npm run deploy:contracts -- --network duckMainnet
```

### AWS Infrastructure

```bash
# 1. Bootstrap CDK (first time only)
npx cdk bootstrap

# 2. Review changes
npx cdk diff

# 3. Deploy
npm run deploy

# 4. Verify deployment
curl https://your-api-gateway-url/health
```

### Telegram Setup

```bash
# Set webhook URL
node scripts/setup-telegram-webhook.js

# Test bot
# Send /mint to your bot in Telegram
```

## 🧪 Testing Strategy

### Unit Tests

```bash
# Contract tests
cd contracts && npm test

# Lambda function tests  
cd lambda && npm test

# Integration tests
npm run test:integration
```

### Test Coverage

- Smart contract functions (100% coverage required)
- Lambda handlers and core logic
- API endpoints and error handling
- Telegram bot command processing
- Memory and database operations

### Load Testing

```bash
# API load testing
npm run test:load

# Telegram bot stress test
npm run test:telegram-load
```


## 📊 Monitoring & Observability

### Key Metrics

1. **Functional Metrics**
   - Duck minting rate
   - Skill purchases
   - Task completions
   - Active users

2. **Technical Metrics**
   - Lambda execution duration
   - DynamoDB read/write capacity
   - Error rates and types
   - API response times

3. **Business Metrics**
   - $DUCK token circulation
   - User retention rate
   - Feature adoption
   - Revenue metrics

### Dashboards

```bash
# CloudWatch Dashboard
aws cloudwatch put-dashboard --cli-input-json file://monitoring/dashboard.json

# Grafana setup (optional)
docker-compose -f monitoring/grafana-stack.yml up -d
```

### Alerting

- High error rates (>5% over 5 minutes)
- High latency (>10s average)
- DynamoDB throttling
- Lambda timeout errors
- Low $DUCK token balance in contracts

## 🛠️ Development Workflow

### Git Workflow

1. Create feature branch: `git checkout -b feature/duck-trading`
2. Make changes with tests
3. Run full test suite: `make test`
4. Create pull request
5. Code review and approval
6. Merge to main branch
7. Automatic deployment via GitHub Actions



## 🔄 CI/CD Pipeline

### GitHub Actions Workflows

1. **Test Workflow** (on all PRs)
   - Unit tests
   - Integration tests
   - Security scanning
   - Code coverage

2. **Deploy Workflow** (on main branch)
   - Deploy contracts to testnet
   - Deploy AWS infrastructure
   - Run smoke tests
   - Deploy to production

3. **Security Workflow** (scheduled)
   - Dependency scanning
   - SAST analysis
   - Infrastructure security checks

## 📈 Scaling Considerations

### Current Limits

- Lambda: 1000 concurrent executions
- DynamoDB: 40,000 RCU/WCU on-demand
- API Gateway: 10,000 requests per second
- Telegram: 30 messages per second per bot

### Scaling Strategies

1. **Horizontal Scaling**
   - Multiple Lambda regions
   - DynamoDB Global Tables
   - CloudFront edge locations

2. **Performance Optimization**
   - Lambda memory auto-tuning
   - DynamoDB query optimization
   - Memory caching with Redis

3. **Cost Optimization**
   - Reserved capacity for DynamoDB
   - S3 Intelligent Tiering
   - Lambda provisioned concurrency

## 🐛 Troubleshooting

### Common Issues

1. **"Duck not found" errors**
   ```bash
   # Check DynamoDB records
   aws dynamodb scan --table-name duck-persona-profiles
   ```

2. **Telegram webhook not receiving messages**
   ```bash
   # Check webhook info
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
   ```

3. **Lambda timeout errors**
   ```bash
   # Check CloudWatch logs
   aws logs tail --follow /aws/lambda/DuckPersona-OrchestratorFunction
   ```

4. **Contract interaction failures**
   ```bash
   # Check transaction on Polygonscan
   # Verify contract addresses in .env
   ```

### Debug Mode

```bash
# Enable debug logging
export DEBUG=true
export LOG_LEVEL=debug

# Run with verbose output
npm run dev -- --verbose
```

## 🎯 Performance Benchmarks

### Expected Performance

- Duck minting: <5 seconds end-to-end
- Chat response: <2 seconds
- Skill upgrade: <3 seconds
- Image generation: <30 seconds
- Meme creation: <15 seconds

### Optimization Tips

1. **Lambda Cold Starts**
   - Use provisioned concurrency for critical functions
   - Optimize bundle size
   - Implement proper warming strategies

2. **DynamoDB Performance**
   - Design efficient partition keys
   - Use projection in GSIs
   - Implement caching layer

3. **Memory Management**
   - Regular cleanup of old memories
   - Efficient vector storage
   - Implement memory importance scoring

## 📚 Additional Resources

### Documentation

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)


## 🎉 Ready for Production!

This complete DuckPersona implementation includes:

✅ **Smart Contracts**: Full ERC-721/1155/20 implementation with upgrades and tasks
✅ **AI Agent Runtime**: Memory, skills, and action execution
✅ **Telegram Integration**: Complete bot with all commands
✅ **AWS Infrastructure**: Scalable, monitored, and secure
✅ **CI/CD Pipeline**: Automated testing and deployment
✅ **Documentation**: Comprehensive guides and troubleshooting
✅ **Security**: WAF, IAM, input validation, and audit trails
✅ **Monitoring**: Dashboards, alerts, and performance optimization



Each component is production-ready with proper error handling, logging, security measures, and scaling capabilities. The modular architecture allows for easy feature additions and maintenance.

Ready to make some AI ducks! 🦆💫
