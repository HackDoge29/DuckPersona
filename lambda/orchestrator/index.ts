import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { OpenSearchServerlessClient } from '@aws-sdk/client-opensearchserverless';
import { ethers } from 'ethers';
import axios from 'axios';

// =============================================================================
// INTERFACES AND TYPES
// =============================================================================
interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: any;
}

interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    first_name?: string;
    username?: string;
    type: string;
  };
  date: number;
  text?: string;
  entities?: any[];
}

interface DuckProfile {
  tokenId: string;
  ownerId: string;
  personaPrompt: string;
  traits: DuckTraits;
  skills: EquippedSkill[];
  level: number;
  xp: number;
  lastActions: string[];
  memory: MemoryEntry[];
  telegramUserId?: number;
}

interface DuckTraits {
  rarity: number;
  species: number;
  color: number;
  personality: number;
  customName?: string;
}

interface EquippedSkill {
  skillId: string;
  name: string;
  tier: number;
  description: string;
}

interface MemoryEntry {
  id: string;
  content: string;
  embedding?: number[];
  timestamp: number;
  importance: number;
  type: 'user_interaction' | 'action_result' | 'observation';
}

interface ActionContext {
  duckProfile: DuckProfile;
  userMessage: string;
  telegramUserId: number;
  chatId: number;
}

// =============================================================================
// AWS CLIENTS AND CONFIGURATION
// =============================================================================
const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const openSearchClient = new OpenSearchServerlessClient({ region: process.env.AWS_REGION });

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const PROFILES_TABLE = process.env.PROFILES_TABLE!;
const MEMORY_TABLE = process.env.MEMORY_TABLE!;
const S3_BUCKET = process.env.S3_BUCKET!;
const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT!;
const RPC_URL = process.env.RPC_URL!;
const CONTRACT_ADDRESSES = {
  DUCK_NFT: process.env.DUCK_NFT_CONTRACT!,
  DUCK_TOKEN: process.env.DUCK_TOKEN_CONTRACT!,
  SKILL_STORE: process.env.SKILL_STORE_CONTRACT!,
  PERSONA_UPGRADES: process.env.PERSONA_UPGRADES_CONTRACT!,
  TIPS_TASKS: process.env.TIPS_TASKS_CONTRACT!
};

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

// =============================================================================
// CONTRACT INTERFACES
// =============================================================================
const DUCK_NFT_ABI = [
  "function mintDuck(address to, uint256 seed) external payable returns (uint256)",
  "function duckTraits(uint256 tokenId) external view returns (uint8 rarity, uint8 species, uint8 color, uint8 personality, uint256 level, uint256 xp, uint256 mintTimestamp, string customName)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function addXP(uint256 tokenId, uint256 xpAmount) external"
];

const DUCK_TOKEN_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function mint(address to, uint256 amount) external"
];

const SKILL_STORE_ABI = [
  "function skills(uint256 skillId) external view returns (string name, string description, uint256 priceDUCK, uint8 maxTier, bool active)",
  "function purchaseSkill(uint256 skillId, uint8 tier, uint256 amount) external"
];

const TIPS_TASKS_ABI = [
  "function createTask(string description, uint256 rewardDUCK, uint256 durationHours) external returns (bytes32)",
  "function completeTask(bytes32 taskHash, uint256 tokenId, bytes32 proofHash) external",
  "function tipDuck(uint256 fromTokenId, uint256 toTokenId, uint256 amount) external"
];

// =============================================================================
// CORE ORCHESTRATOR LOGIC
// =============================================================================
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  try {
    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No body provided' }) };
    }

    const telegramUpdate: TelegramUpdate = JSON.parse(event.body);
    
    if (!telegramUpdate.message) {
      return { statusCode: 200, body: 'OK' };
    }

    const message = telegramUpdate.message;
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text || '';

    console.log(`Processing message from user ${userId}: ${text}`);

    // Handle different command types
    if (text.startsWith('/mint')) {
      await handleMintCommand(chatId, userId);
    } else if (text.startsWith('/profile')) {
      await handleProfileCommand(chatId, userId);
    } else if (text.startsWith('/upgrade')) {
      await handleUpgradeCommand(chatId, userId, text);
    } else if (text.startsWith('/tip')) {
      await handleTipCommand(chatId, userId, text);
    } else if (text.startsWith('/task')) {
      await handleTaskCommand(chatId, userId, text);
    } else if (text.startsWith('/help')) {
      await handleHelpCommand(chatId);
    } else {
      // Regular chat with duck
      await handleDuckChat(chatId, userId, text);
    }

    return { statusCode: 200, body: 'OK' };
  } catch (error) {
    console.error('Error processing request:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'Internal server error' }) 
    };
  }
};

// =============================================================================
// COMMAND HANDLERS
// =============================================================================
async function handleMintCommand(chatId: number, userId: number) {
  try {
    // Check if user already has a duck
    const existingProfile = await getDuckProfileByTelegramUser(userId);
    if (existingProfile) {
      await sendTelegramMessage(chatId, "You already have a Duck! Use /profile to see your Duck's stats.");
      return;
    }

    // Generate seed for deterministic traits
    const seed = ethers.keccak256(ethers.toUtf8Bytes(`${userId}-${Date.now()}`));
    
    // Mint duck on-chain (in production, this would be funded by the protocol)
    const duckNFTContract = new ethers.Contract(CONTRACT_ADDRESSES.DUCK_NFT, DUCK_NFT_ABI, wallet);
    const mintTx = await duckNFTContract.mintDuck(wallet.address, seed, {
      value: ethers.parseEther("0.01"),
      gasLimit: 200000
    });
    
    const receipt = await mintTx.wait();
    const tokenId = receipt?.logs[0]?.args?.[0] || '1'; // Extract tokenId from mint event or use fallback
    
    // Get duck traits from contract
    const traits = await duckNFTContract.duckTraits(tokenId);
    
    // Create duck profile
    const duckProfile: DuckProfile = {
      tokenId: tokenId.toString(),
      ownerId: wallet.address,
      personaPrompt: generatePersonaPrompt(traits),
      traits: {
        rarity: Number(traits[0]),
        species: Number(traits[1]),
        color: Number(traits[2]),
        personality: Number(traits[3]),
        customName: traits[7] || ""
      },
      skills: [],
      level: Number(traits[4]),
      xp: Number(traits[5]),
      lastActions: [],
      memory: [],
      telegramUserId: userId
    };

    // Store profile in DynamoDB
    await saveDuckProfile(duckProfile);

    // Generate and send duck image/card
    const imageUrl = await generateDuckImage(duckProfile);
    const profileText = formatDuckProfile(duckProfile);

    await sendTelegramPhoto(chatId, imageUrl, `🦆 Your Duck has been minted!\n\n${profileText}`);
    
    // Give welcome DUCK tokens
    const duckTokenContract = new ethers.Contract(CONTRACT_ADDRESSES.DUCK_TOKEN, DUCK_TOKEN_ABI, wallet);
    await duckTokenContract.mint(wallet.address, ethers.parseEther("1000")); // 1000 DUCK tokens
    
    await sendTelegramMessage(chatId, "🎉 Welcome bonus: 1000 DUCK tokens have been added to your account!");

  } catch (error) {
    console.error('Error minting duck:', error);
    await sendTelegramMessage(chatId, "Sorry, there was an error minting your Duck. Please try again later.");
  }
}

async function handleProfileCommand(chatId: number, userId: number) {
  try {
    const profile = await getDuckProfileByTelegramUser(userId);
    if (!profile) {
      await sendTelegramMessage(chatId, "You don't have a Duck yet! Use /mint to create one.");
      return;
    }

    const profileText = formatDuckProfile(profile);
    const imageUrl = await generateDuckImage(profile);
    
    await sendTelegramPhoto(chatId, imageUrl, `🦆 Your Duck Profile:\n\n${profileText}`);
  } catch (error) {
    console.error('Error getting profile:', error);
    await sendTelegramMessage(chatId, "Error retrieving your profile.");
  }
}

async function handleUpgradeCommand(chatId: number, userId: number, text: string) {
  try {
    const profile = await getDuckProfileByTelegramUser(userId);
    if (!profile) {
      await sendTelegramMessage(chatId, "You need a Duck first! Use /mint to create one.");
      return;
    }

    const parts = text.split(' ');
    if (parts.length < 2) {
      await sendTelegramMessage(chatId, "Usage: /upgrade <skill_name>\nAvailable skills: memesmith, summarizer");
      return;
    }

    const skillName = parts[1].toLowerCase();
    const skillMap: Record<string, number> = {
      'memesmith': 1,
      'summarizer': 2
    };

    const skillId = skillMap[skillName];
    if (!skillId) {
      await sendTelegramMessage(chatId, "Unknown skill. Available: memesmith, summarizer");
      return;
    }

    // Purchase and equip skill
    const skillStoreContract = new ethers.Contract(CONTRACT_ADDRESSES.SKILL_STORE, SKILL_STORE_ABI, wallet);

    // Purchase skill (this would require DUCK token approval in production)
    await skillStoreContract.purchaseSkill(skillId, 1, 1);
    
    // Update profile
    profile.skills.push({
      skillId: skillId.toString(),
      name: skillName,
      tier: 1,
      description: getSkillDescription(skillName)
    });

    await saveDuckProfile(profile);

    await sendTelegramMessage(chatId, `🎯 Successfully upgraded your Duck with ${skillName} skill!`);
  } catch (error) {
    console.error('Error upgrading:', error);
    await sendTelegramMessage(chatId, "Error upgrading your Duck. Make sure you have enough DUCK tokens.");
  }
}

async function handleTipCommand(chatId: number, userId: number, text: string) {
  try {
    const profile = await getDuckProfileByTelegramUser(userId);
    if (!profile) {
      await sendTelegramMessage(chatId, "You need a Duck first! Use /mint to create one.");
      return;
    }

    const parts = text.split(' ');
    if (parts.length < 3) {
      await sendTelegramMessage(chatId, "Usage: /tip @username <amount>");
      return;
    }

    const targetUsername = parts[1].replace('@', '');
    const amount = parseFloat(parts[2]);

    if (isNaN(amount) || amount <= 0) {
      await sendTelegramMessage(chatId, "Invalid tip amount.");
      return;
    }

    // Find target user's duck (simplified - in production you'd have username mapping)
    const targetProfile = await getDuckProfileByUsername(targetUsername);
    if (!targetProfile) {
      await sendTelegramMessage(chatId, "Target user not found or doesn't have a Duck.");
      return;
    }

    // Send tip on-chain
    const tipsTasksContract = new ethers.Contract(CONTRACT_ADDRESSES.TIPS_TASKS, TIPS_TASKS_ABI, wallet);
    await tipsTasksContract.tipDuck(profile.tokenId, targetProfile.tokenId, ethers.parseEther(amount.toString()));

    await sendTelegramMessage(chatId, `💰 Successfully tipped ${amount} DUCK to @${targetUsername}!`);
  } catch (error) {
    console.error('Error tipping:', error);
    await sendTelegramMessage(chatId, "Error sending tip.");
  }
}

async function handleTaskCommand(chatId: number, userId: number, text: string) {
  try {
    const profile = await getDuckProfileByTelegramUser(userId);
    if (!profile) {
      await sendTelegramMessage(chatId, "You need a Duck first! Use /mint to create one.");
      return;
    }

    const parts = text.split(' ');
    const subcommand = parts[1];

    if (subcommand === 'create') {
      // /task create "description" reward_amount duration_hours
      if (parts.length < 5) {
        await sendTelegramMessage(chatId, 'Usage: /task create "description" <reward> <hours>');
        return;
      }

      const description = parts[2];
      const reward = parseFloat(parts[3]);
      const hours = parseInt(parts[4]);

      const tipsTasksContract = new ethers.Contract(CONTRACT_ADDRESSES.TIPS_TASKS, TIPS_TASKS_ABI, wallet);
      const taskHash = await tipsTasksContract.createTask(description, ethers.parseEther(reward.toString()), hours);

      await sendTelegramMessage(chatId, `✅ Task created! Hash: ${taskHash}`);
    } else if (subcommand === 'complete') {
      // /task complete <task_hash> <proof_text>
      if (parts.length < 4) {
        await sendTelegramMessage(chatId, 'Usage: /task complete <task_hash> <proof_text>');
        return;
      }

      const taskHash = parts[2];
      const proofText = parts.slice(3).join(' ');
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes(proofText));

      const tipsTasksContract = new ethers.Contract(CONTRACT_ADDRESSES.TIPS_TASKS, TIPS_TASKS_ABI, wallet);
      await tipsTasksContract.completeTask(taskHash, profile.tokenId, proofHash);

      await sendTelegramMessage(chatId, "🎉 Task completed! Reward has been sent to your account.");
    } else {
      await sendTelegramMessage(chatId, "Usage: /task create or /task complete");
    }
  } catch (error) {
    console.error('Error with task:', error);
    await sendTelegramMessage(chatId, "Error processing task command.");
  }
}

async function handleHelpCommand(chatId: number) {
  const helpText = `
🦆 **DuckPersona Commands**

/mint - Create your AI Duck NFT
/profile - View your Duck's stats
/upgrade <skill> - Buy and equip skills (memesmith, summarizer)
/tip @username <amount> - Tip another user's Duck
/task create "desc" <reward> <hours> - Create a task
/task complete <hash> <proof> - Complete a task
/help - Show this help

**Available Skills:**
🎨 memesmith - Create memes and images  
📖 summarizer - Summarize links and content

Just chat normally to interact with your Duck!
  `;
  
  await sendTelegramMessage(chatId, helpText);
}

async function handleDuckChat(chatId: number, userId: number, text: string) {
  try {
    const profile = await getDuckProfileByTelegramUser(userId);
    if (!profile) {
      await sendTelegramMessage(chatId, "You don't have a Duck yet! Use /mint to create one first.");
      return;
    }

    // Store user interaction in memory
    await storeMemory(profile.tokenId, {
      id: generateId(),
      content: `User said: ${text}`,
      timestamp: Date.now(),
      importance: 1,
      type: 'user_interaction'
    });

    // Get relevant memories for context
    const relevantMemories = await getRelevantMemories(profile.tokenId, text);
    
    // Generate response using LLM
    const response = await generateDuckResponse({
      duckProfile: profile,
      userMessage: text,
      telegramUserId: userId,
      chatId: chatId
    }, relevantMemories);

    // Check if duck wants to perform actions
    const actions = extractActions(response);
    
    if (actions.length > 0) {
      for (const action of actions) {
        await executeAction(action, profile, chatId);
      }
    } else {
      await sendTelegramMessage(chatId, response);
    }

    // Store duck response in memory
    await storeMemory(profile.tokenId, {
      id: generateId(),
      content: `Duck responded: ${response}`,
      timestamp: Date.now(),
      importance: 1,
      type: 'user_interaction'
    });

    // Award XP for interaction
    const duckNFTContract = new ethers.Contract(CONTRACT_ADDRESSES.DUCK_NFT, DUCK_NFT_ABI, wallet);
    await duckNFTContract.addXP(profile.tokenId, 10);

  } catch (error) {
    console.error('Error in duck chat:', error);
    await sendTelegramMessage(chatId, "Quack! Something went wrong. Try again later.");
  }
}

// =============================================================================
// AI RESPONSE GENERATION
// =============================================================================
async function generateDuckResponse(context: ActionContext, memories: MemoryEntry[]): Promise<string> {
  const { duckProfile, userMessage } = context;
  
  const memoryContext = memories.map(m => m.content).join('\n');
  const skillsText = duckProfile.skills.map(s => `${s.name} (Tier ${s.tier})`).join(', ');
  
  const prompt = `${duckProfile.personaPrompt}

DUCK STATS:
- Level: ${duckProfile.level}
- XP: ${duckProfile.xp}
- Skills: ${skillsText || 'None'}
- Rarity: ${getRarityName(duckProfile.traits.rarity)}

RECENT MEMORIES:
${memoryContext}

AVAILABLE ACTIONS:
- [MEME_CREATE] - Create a meme (requires memesmith skill)
- [SUMMARIZE] - Summarize a link or content (requires summarizer skill)
- [TIP_SUGGEST] - Suggest tipping another user
- [TASK_SUGGEST] - Suggest creating or completing a task

User message: "${userMessage}"

Respond as this duck character. If you want to perform an action, include it in your response like [ACTION_NAME: details]. Keep responses under 200 characters for Telegram.`;

  const bedrockCommand = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.7,
      anthropic_version: 'bedrock-2023-05-31'
    }),
    contentType: 'application/json'
  });

  const response = await bedrockClient.send(bedrockCommand);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  
  return responseBody.content[0].text;
}

// =============================================================================
// ACTION SYSTEM
// =============================================================================
function extractActions(response: string): Array<{ type: string; details: string }> {
  const actionRegex = /\[([A-Z_]+):\s*([^\]]+)\]/g;
  const actions: Array<{ type: string; details: string }> = [];
  let match;
  
  while ((match = actionRegex.exec(response)) !== null) {
    actions.push({
      type: match[1],
      details: match[2]
    });
  }
  
  return actions;
}

async function executeAction(action: { type: string; details: string }, profile: DuckProfile, chatId: number) {
  switch (action.type) {
    case 'MEME_CREATE':
      if (profile.skills.some(s => s.name === 'memesmith')) {
        await createMeme(action.details, chatId);
      } else {
        await sendTelegramMessage(chatId, "I need the memesmith skill to create memes! Use /upgrade memesmith");
      }
      break;
      
    case 'SUMMARIZE':
      if (profile.skills.some(s => s.name === 'summarizer')) {
        await summarizeContent(action.details, chatId);
      } else {
        await sendTelegramMessage(chatId, "I need the summarizer skill to summarize content! Use /upgrade summarizer");
      }
      break;
      
    default:
      console.log('Unknown action:', action.type);
  }
}

async function createMeme(prompt: string, chatId: number) {
  try {
    // Use Bedrock to generate meme concept, then create image
    const memeImageUrl = await generateMemeImage(prompt);
    await sendTelegramPhoto(chatId, memeImageUrl, `🎨 Fresh meme created: "${prompt}"`);
  } catch (error) {
    console.error('Error creating meme:', error);
    await sendTelegramMessage(chatId, "Quack! Couldn't create that meme right now.");
  }
}

async function summarizeContent(url: string, chatId: number) {
  try {
    // Fetch and summarize content
    const content = await fetchWebContent(url);
    const summary = await generateSummary(content);
    await sendTelegramMessage(chatId, `📖 Summary: ${summary}`);
  } catch (error) {
    console.error('Error summarizing:', error);
    await sendTelegramMessage(chatId, "Quack! Couldn't summarize that content.");
  }
}

// =============================================================================
// MEMORY MANAGEMENT
// =============================================================================
async function storeMemory(tokenId: string, memory: MemoryEntry) {
  try {
    // Generate embedding for semantic search
    const embedding = await generateEmbedding(memory.content);
    memory.embedding = embedding;
    
    // Store in DynamoDB
    await dynamoDB.send(new PutItemCommand({
      TableName: MEMORY_TABLE,
      Item: {
        tokenId: { S: tokenId },
        memoryId: { S: memory.id },
        content: { S: memory.content },
        timestamp: { N: memory.timestamp.toString() },
        importance: { N: memory.importance.toString() },
        type: { S: memory.type },
        embedding: { S: JSON.stringify(embedding) }
      }
    }));
    
    // Also store in vector database for semantic search
    await indexMemoryInOpenSearch(tokenId, memory);
  } catch (error) {
    console.error('Error storing memory:', error);
  }
}

async function getRelevantMemories(tokenId: string, query: string, limit: number = 5): Promise<MemoryEntry[]> {
  try {
    // For now, get recent memories from DynamoDB
    // In production, you'd use vector search with embeddings
    const response = await dynamoDB.send(new QueryCommand({
      TableName: MEMORY_TABLE,
      KeyConditionExpression: 'tokenId = :tokenId',
      ExpressionAttributeValues: {
        ':tokenId': { S: tokenId }
      },
      ScanIndexForward: false,
      Limit: limit
    }));
    
    return response.Items?.map(item => ({
      id: item.memoryId.S!,
      content: item.content.S!,
      timestamp: parseInt(item.timestamp.N!),
      importance: parseInt(item.importance.N!),
      type: item.type.S! as MemoryEntry['type']
    })) || [];
  } catch (error) {
    console.error('Error retrieving memories:', error);
    return [];
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Use Bedrock Titan embeddings
    const command = new InvokeModelCommand({
      modelId: 'amazon.titan-embed-text-v1',
      body: JSON.stringify({ inputText: text }),
      contentType: 'application/json'
    });
    
    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return [];
  }
}

async function indexMemoryInOpenSearch(tokenId: string, memory: MemoryEntry) {
  // For now, just log - in production you'd index in OpenSearch
  console.log(`Would index memory for duck ${tokenId}:`, memory.content);
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================
async function getDuckProfileByTelegramUser(telegramUserId: number): Promise<DuckProfile | null> {
  try {
    const response = await dynamoDB.send(new GetItemCommand({
      TableName: PROFILES_TABLE,
      Key: { telegramUserId: { N: telegramUserId.toString() } }
    }));
    
    if (!response.Item) return null;
    
    return {
      tokenId: response.Item.tokenId.S!,
      ownerId: response.Item.ownerId.S!,
      personaPrompt: response.Item.personaPrompt.S!,
      traits: JSON.parse(response.Item.traits.S!),
      skills: JSON.parse(response.Item.skills.S!),
      level: parseInt(response.Item.level.N!),
      xp: parseInt(response.Item.xp.N!),
      lastActions: JSON.parse(response.Item.lastActions.S!),
      memory: [],
      telegramUserId: telegramUserId
    };
  } catch (error) {
    console.error('Error getting duck profile:', error);
    return null;
  }
}

async function getDuckProfileByUsername(username: string): Promise<DuckProfile | null> {
  // Simplified - in production you'd have a proper username->profile mapping
  console.log('Looking up duck profile for username:', username);
  return null;
}

async function saveDuckProfile(profile: DuckProfile) {
  await dynamoDB.send(new PutItemCommand({
    TableName: PROFILES_TABLE,
    Item: {
      telegramUserId: { N: profile.telegramUserId!.toString() },
      tokenId: { S: profile.tokenId },
      ownerId: { S: profile.ownerId },
      personaPrompt: { S: profile.personaPrompt },
      traits: { S: JSON.stringify(profile.traits) },
      skills: { S: JSON.stringify(profile.skills) },
      level: { N: profile.level.toString() },
      xp: { N: profile.xp.toString() },
      lastActions: { S: JSON.stringify(profile.lastActions) },
      lastUpdated: { N: Date.now().toString() }
    }
  }));
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================
function generatePersonaPrompt(traits: any): string {
  const personalities = [
    "You are a wise and contemplative duck who speaks in philosophical riddles.",
    "You are an energetic and mischievous duck who loves pranks and jokes.",
    "You are a sophisticated duck with refined tastes and proper manners.",
    "You are a rebellious duck who questions everything and loves chaos.",
    "You are a friendly and helpful duck who always tries to assist others.",
    "You are a mysterious duck with secrets and speaks in cryptic messages.",
    "You are an adventurous duck who dreams of exploration and discovery.",
    "You are a tech-savvy duck obsessed with the latest innovations."
  ];
  
  return personalities[Number(traits[3]) % personalities.length] || personalities[0];
}

function formatDuckProfile(profile: DuckProfile): string {
  const rarityName = getRarityName(profile.traits.rarity);
  const skillsList = profile.skills.map(s => `${s.name} (T${s.tier})`).join(', ') || 'None';
  
  return `**${profile.traits.customName || 'Unnamed Duck'}**
🏆 Level ${profile.level} (${profile.xp} XP)
💎 Rarity: ${rarityName}
🎯 Skills: ${skillsList}
🆔 Token ID: ${profile.tokenId}`;
}

function getRarityName(rarity: number): string {
  const names = ['', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
  return names[rarity] || 'Unknown';
}

function getSkillDescription(skillName: string): string {
  const descriptions: Record<string, string> = {
    'memesmith': 'Create viral memes and funny images',
    'summarizer': 'Summarize articles and web content'
  };
  return descriptions[skillName] || 'Unknown skill';
}

async function generateDuckImage(profile: DuckProfile): Promise<string> {
  // Generate duck image based on traits
  const imagePrompt = `A cute cartoon duck with rarity ${profile.traits.rarity}, species ${profile.traits.species}, color ${profile.traits.color}`;
  // This would call an image generation service
  return `https://example.com/duck-${profile.tokenId}.png`;
}

async function generateMemeImage(prompt: string): Promise<string> {
  // Generate meme image
  return `https://example.com/meme-${Date.now()}.png`;
}

async function fetchWebContent(url: string): Promise<string> {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching web content:', error);
    return '';
  }
}

async function generateSummary(content: string): Promise<string> {
  try {
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      body: JSON.stringify({
        messages: [{ role: 'user', content: `Summarize this content in 100 words or less: ${content}` }],
        max_tokens: 150,
        anthropic_version: 'bedrock-2023-05-31'
      }),
      contentType: 'application/json'
    });
    
    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.content[0].text;
  } catch (error) {
    console.error('Error generating summary:', error);
    return 'Unable to generate summary';
  }
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// =============================================================================
// TELEGRAM API FUNCTIONS
// =============================================================================
async function sendTelegramMessage(chatId: number, text: string) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
}

async function sendTelegramPhoto(chatId: number, photoUrl: string, caption?: string) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      chat_id: chatId,
      photo: photoUrl,
      caption: caption,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error sending Telegram photo:', error);
  }
}