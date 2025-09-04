import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as opensearch from 'aws-cdk-lib/aws-opensearchserverless';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface DuckPersonaStackProps extends cdk.StackProps {
  telegramBotToken?: string;
  rpcUrl?: string;
  privateKey?: string;
  contractAddresses?: {
    duckNft?: string;
    duckToken?: string;
    skillStore?: string;
    personaUpgrades?: string;
    tipsTasks?: string;
  };
}

export class DuckPersonaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: DuckPersonaStackProps) {
    super(scope, id, props);

    // Get environment variables with fallbacks
    const envVars = {
      telegramBotToken: props?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || 'REPLACE_WITH_YOUR_BOT_TOKEN',
      rpcUrl: props?.rpcUrl || process.env.RPC_URL || 'https://polygon-mainnet.infura.io/v3/YOUR_KEY',
      privateKey: props?.privateKey || process.env.PRIVATE_KEY || 'REPLACE_WITH_YOUR_PRIVATE_KEY',
      contracts: {
        duckNft: props?.contractAddresses?.duckNft || process.env.DUCK_NFT_CONTRACT || '0x0000000000000000000000000000000000000000',
        duckToken: props?.contractAddresses?.duckToken || process.env.DUCK_TOKEN_CONTRACT || '0x0000000000000000000000000000000000000000',
        skillStore: props?.contractAddresses?.skillStore || process.env.SKILL_STORE_CONTRACT || '0x0000000000000000000000000000000000000000',
        personaUpgrades: props?.contractAddresses?.personaUpgrades || process.env.PERSONA_UPGRADES_CONTRACT || '0x0000000000000000000000000000000000000000',
        tipsTasks: props?.contractAddresses?.tipsTasks || process.env.TIPS_TASKS_CONTRACT || '0x0000000000000000000000000000000000000000',
      }
    };

    // =============================================================================
    // S3 BUCKET FOR ASSETS
    // =============================================================================
    const assetsBucket = new s3.Bucket(this, 'DuckPersonaAssets', {
      bucketName: `duck-persona-assets-${this.account}-${this.region}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
        allowedOrigins: ['*'],
        allowedHeaders: ['*']
      }],
      lifecycleRules: [{
        id: 'delete-incomplete-multipart-uploads',
        abortIncompleteMultipartUploadAfter: cdk.Duration.days(1)
      }],
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // =============================================================================
    // CLOUDFRONT DISTRIBUTION
    // =============================================================================
    const distribution = new cloudfront.Distribution(this, 'AssetDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(assetsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED
      }
    });

    // =============================================================================
    // DYNAMODB TABLES
    // =============================================================================
    const profilesTable = new dynamodb.Table(this, 'DuckProfiles', {
      tableName: 'duck-persona-profiles',
      partitionKey: { name: 'telegramUserId', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Add GSI for tokenId lookups
    profilesTable.addGlobalSecondaryIndex({
      indexName: 'tokenId-index',
      partitionKey: { name: 'tokenId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });

    const memoryTable = new dynamodb.Table(this, 'DuckMemories', {
      tableName: 'duck-persona-memories',
      partitionKey: { name: 'tokenId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'memoryId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Add GSI for timestamp-based queries
    memoryTable.addGlobalSecondaryIndex({
      indexName: 'timestamp-index',
      partitionKey: { name: 'tokenId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // =============================================================================
    // OPENSEARCH SERVERLESS COLLECTION
    // =============================================================================
    const vectorCollection = new opensearch.CfnCollection(this, 'DuckMemoryVectorDB', {
      name: 'duck-persona-vectors',
      type: 'VECTORSEARCH',
      description: 'Vector database for Duck memory storage and semantic search'
    });

    // Create network policy for OpenSearch Serverless
    new opensearch.CfnSecurityPolicy(this, 'VectorDBNetworkPolicy', {
      name: 'duck-persona-network-policy',
      type: 'network',
      policy: JSON.stringify([{
        Rules: [{
          Resource: [`collection/duck-persona-vectors`],
          ResourceType: 'collection'
        }],
        AllowFromPublic: true
      }])
    });

    // Create encryption policy
    new opensearch.CfnSecurityPolicy(this, 'VectorDBEncryptionPolicy', {
      name: 'duck-persona-encryption-policy', 
      type: 'encryption',
      policy: JSON.stringify({
        Rules: [{
          Resource: [`collection/duck-persona-vectors`],
          ResourceType: 'collection'
        }],
        AWSOwnedKey: true
      })
    });

    // =============================================================================
    // IAM ROLES AND POLICIES
    // =============================================================================
    const orchestratorRole = new iam.Role(this, 'OrchestratorRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    // DynamoDB permissions
    profilesTable.grantReadWriteData(orchestratorRole);
    memoryTable.grantReadWriteData(orchestratorRole);

    // S3 permissions
    assetsBucket.grantReadWrite(orchestratorRole);

    // Bedrock permissions
    orchestratorRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream'
      ],
      resources: [
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`,
        `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v1`
      ]
    }));

    // OpenSearch Serverless permissions
    orchestratorRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'aoss:APIAccessAll'
      ],
      resources: [vectorCollection.attrArn]
    }));

    // =============================================================================
    // LAMBDA FUNCTIONS
    // =============================================================================
    const orchestratorFunction = new lambda.Function(this, 'OrchestratorFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/orchestrator'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      role: orchestratorRole,
      environment: {
        PROFILES_TABLE: profilesTable.tableName,
        MEMORY_TABLE: memoryTable.tableName,
        S3_BUCKET: assetsBucket.bucketName,
        OPENSEARCH_ENDPOINT: vectorCollection.attrCollectionEndpoint,
        CLOUDFRONT_DOMAIN: distribution.distributionDomainName,
        TELEGRAM_BOT_TOKEN: envVars.telegramBotToken,
        RPC_URL: envVars.rpcUrl,
        PRIVATE_KEY: envVars.privateKey,
        DUCK_NFT_CONTRACT: envVars.contracts.duckNft,
        DUCK_TOKEN_CONTRACT: envVars.contracts.duckToken,
        SKILL_STORE_CONTRACT: envVars.contracts.skillStore,
        PERSONA_UPGRADES_CONTRACT: envVars.contracts.personaUpgrades,
        TIPS_TASKS_CONTRACT: envVars.contracts.tipsTasks
      }
    });

    // =============================================================================
    // API GATEWAY
    // =============================================================================
    const api = new apigateway.RestApi(this, 'DuckPersonaAPI', {
      restApiName: 'DuckPersona Telegram Bot API',
      description: 'API for DuckPersona Telegram bot webhook',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS
      }
    });

    // Webhook endpoint for Telegram
    const webhookIntegration = new apigateway.LambdaIntegration(orchestratorFunction);
    api.root.addResource('webhook').addMethod('POST', webhookIntegration);

    // Health check endpoint
    const healthFunction = new lambda.Function(this, 'HealthFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          return {
            statusCode: 200,
            body: JSON.stringify({ 
              status: 'healthy',
              timestamp: new Date().toISOString()
            })
          };
        };
      `),
      timeout: cdk.Duration.seconds(10)
    });

    api.root.addResource('health').addMethod('GET', 
      new apigateway.LambdaIntegration(healthFunction)
    );

    // =============================================================================
    // ADDITIONAL LAMBDA FUNCTIONS
    // =============================================================================

    // Image Generation Function (Python)
    const imageGenFunction = new lambda.Function(this, 'ImageGenFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/image-gen'),
      timeout: cdk.Duration.seconds(60),
      memorySize: 2048,
      environment: {
        S3_BUCKET: assetsBucket.bucketName,
        CLOUDFRONT_DOMAIN: distribution.distributionDomainName
      }
    });

    assetsBucket.grantReadWrite(imageGenFunction);

    // Meme Generation Function (Python)
    const memeGenFunction = new lambda.Function(this, 'MemeGenFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/meme-gen'),
      timeout: cdk.Duration.seconds(60),
      memorySize: 2048,
      environment: {
        S3_BUCKET: assetsBucket.bucketName,
        CLOUDFRONT_DOMAIN: distribution.distributionDomainName
      }
    });

    assetsBucket.grantReadWrite(memeGenFunction);

    // Content Summarizer Function
    const summarizerFunction = new lambda.Function(this, 'SummarizerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/summarizer'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      role: orchestratorRole
    });

    // =============================================================================
    // EVENT BRIDGE FOR TASK SCHEDULING
    // =============================================================================
    const eventBridgeRole = new iam.Role(this, 'EventBridgeRole', {
      assumedBy: new iam.ServicePrincipal('events.amazonaws.com')
    });

    orchestratorFunction.grantInvoke(eventBridgeRole);

    // Daily duck maintenance
    new events.Rule(this, 'DailyMaintenance', {
      schedule: events.Schedule.cron({ hour: '0', minute: '0' }),
      targets: [new targets.LambdaFunction(orchestratorFunction, {
        event: events.RuleTargetInput.fromObject({
          source: 'scheduled-maintenance',
          action: 'daily-cleanup'
        })
      })]
    });

    // =============================================================================
    // MONITORING AND ALARMS
    // =============================================================================
    const dashboard = new cloudwatch.Dashboard(this, 'DuckPersonaDashboard', {
      dashboardName: 'DuckPersona-Monitoring'
    });

    // Lambda metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Invocations',
        left: [orchestratorFunction.metricInvocations()],
        right: [orchestratorFunction.metricErrors()]
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration',
        left: [orchestratorFunction.metricDuration()]
      })
    );

    // DynamoDB metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Read/Write',
        left: [
          profilesTable.metricConsumedReadCapacityUnits(),
          profilesTable.metricConsumedWriteCapacityUnits()
        ]
      })
    );

    // Error alarms
    new cloudwatch.Alarm(this, 'OrchestratorErrorAlarm', {
      metric: orchestratorFunction.metricErrors({
        period: cdk.Duration.minutes(5)
      }),
      threshold: 5,
      evaluationPeriods: 2
    });

    // =============================================================================
    // OUTPUTS
    // =============================================================================
    new cdk.CfnOutput(this, 'APIGatewayURL', {
      value: api.url,
      description: 'API Gateway URL for Telegram webhook'
    });

    new cdk.CfnOutput(this, 'WebhookURL', {
      value: `${api.url}webhook`,
      description: 'Telegram webhook URL'
    });

    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront distribution URL for assets'
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: assetsBucket.bucketName,
      description: 'S3 bucket for duck assets'
    });

    new cdk.CfnOutput(this, 'ProfilesTableName', {
      value: profilesTable.tableName,
      description: 'DynamoDB table for duck profiles'
    });

    new cdk.CfnOutput(this, 'MemoryTableName', {
      value: memoryTable.tableName,
      description: 'DynamoDB table for duck memories'
    });

    new cdk.CfnOutput(this, 'OpenSearchEndpoint', {
      value: vectorCollection.attrCollectionEndpoint,
      description: 'OpenSearch Serverless collection endpoint'
    });
  }
}