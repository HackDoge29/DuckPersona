#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const duck_persona_stack_1 = require("../duck-persona-stack");
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config();
const app = new cdk.App();
// Get configuration from environment or context
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT || app.node.tryGetContext('account'),
    region: process.env.CDK_DEFAULT_REGION || app.node.tryGetContext('region') || 'us-east-1',
};
// Deploy stack
new duck_persona_stack_1.DuckPersonaStack(app, 'DuckPersonaStack', {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHVjay1wZXJzb25hLWNkay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImR1Y2stcGVyc29uYS1jZGsudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUNuQyw4REFBeUQ7QUFDekQsK0NBQWlDO0FBRWpDLDZCQUE2QjtBQUM3QixNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7QUFFaEIsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsZ0RBQWdEO0FBQ2hELE1BQU0sR0FBRyxHQUFHO0lBQ1YsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDO0lBQzdFLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxJQUFJLFdBQVc7Q0FDMUYsQ0FBQztBQUVGLGVBQWU7QUFDZixJQUFJLHFDQUFnQixDQUFDLEdBQUcsRUFBRSxrQkFBa0IsRUFBRTtJQUM1QyxHQUFHO0lBQ0gsV0FBVyxFQUFFLHNDQUFzQztJQUVuRCxzQ0FBc0M7SUFDdEMsZ0JBQWdCLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0I7SUFDaEQsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTztJQUMzQixVQUFVLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXO0lBRW5DLGlCQUFpQixFQUFFO1FBQ2pCLE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQjtRQUN0QyxTQUFTLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7UUFDMUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0JBQW9CO1FBQzVDLGVBQWUsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLHlCQUF5QjtRQUN0RCxTQUFTLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7S0FDM0M7SUFFRCxJQUFJLEVBQUU7UUFDSixPQUFPLEVBQUUsYUFBYTtRQUN0QixXQUFXLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLElBQUksYUFBYTtRQUNsRCxTQUFTLEVBQUUsU0FBUztLQUNyQjtDQUNGLENBQUMsQ0FBQztBQUVILEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBEdWNrUGVyc29uYVN0YWNrIH0gZnJvbSAnLi4vZHVjay1wZXJzb25hLXN0YWNrJztcbmltcG9ydCAqIGFzIGRvdGVudiBmcm9tICdkb3RlbnYnO1xuXG4vLyBMb2FkIGVudmlyb25tZW50IHZhcmlhYmxlc1xuZG90ZW52LmNvbmZpZygpO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG4vLyBHZXQgY29uZmlndXJhdGlvbiBmcm9tIGVudmlyb25tZW50IG9yIGNvbnRleHRcbmNvbnN0IGVudiA9IHtcbiAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCB8fCBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdhY2NvdW50JyksXG4gIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OIHx8IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ3JlZ2lvbicpIHx8ICd1cy1lYXN0LTEnLFxufTtcblxuLy8gRGVwbG95IHN0YWNrXG5uZXcgRHVja1BlcnNvbmFTdGFjayhhcHAsICdEdWNrUGVyc29uYVN0YWNrJywge1xuICBlbnYsXG4gIGRlc2NyaXB0aW9uOiAnRHVjayBQZXJzb25hIEFJIEFnZW50IEluZnJhc3RydWN0dXJlJyxcbiAgXG4gIC8vIFBhc3MgZW52aXJvbm1lbnQgdmFyaWFibGVzIGFzIHByb3BzXG4gIHRlbGVncmFtQm90VG9rZW46IHByb2Nlc3MuZW52LlRFTEVHUkFNX0JPVF9UT0tFTixcbiAgcnBjVXJsOiBwcm9jZXNzLmVudi5SUENfVVJMLFxuICBwcml2YXRlS2V5OiBwcm9jZXNzLmVudi5QUklWQVRFX0tFWSxcbiAgXG4gIGNvbnRyYWN0QWRkcmVzc2VzOiB7XG4gICAgZHVja05mdDogcHJvY2Vzcy5lbnYuRFVDS19ORlRfQ09OVFJBQ1QsXG4gICAgZHVja1Rva2VuOiBwcm9jZXNzLmVudi5EVUNLX1RPS0VOX0NPTlRSQUNULFxuICAgIHNraWxsU3RvcmU6IHByb2Nlc3MuZW52LlNLSUxMX1NUT1JFX0NPTlRSQUNULFxuICAgIHBlcnNvbmFVcGdyYWRlczogcHJvY2Vzcy5lbnYuUEVSU09OQV9VUEdSQURFU19DT05UUkFDVCxcbiAgICB0aXBzVGFza3M6IHByb2Nlc3MuZW52LlRJUFNfVEFTS1NfQ09OVFJBQ1QsXG4gIH0sXG4gIFxuICB0YWdzOiB7XG4gICAgUHJvamVjdDogJ0R1Y2tQZXJzb25hJyxcbiAgICBFbnZpcm9ubWVudDogcHJvY2Vzcy5lbnYuTk9ERV9FTlYgfHwgJ2RldmVsb3BtZW50JyxcbiAgICBNYW5hZ2VkQnk6ICdBV1MtQ0RLJ1xuICB9XG59KTtcblxuYXBwLnN5bnRoKCk7Il19