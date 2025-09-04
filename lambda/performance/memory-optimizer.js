// lambda/performance/memory-optimizer.js
const AWS = require('aws-sdk');
const cloudwatch = AWS.CloudWatch();
const lambda = new AWS.Lambda();

// Auto-adjust Lambda memory based on performance metrics
exports.optimizeMemory = async () => {
    try {
        const functions = [
            'DuckPersona-OrchestratorFunction',
            'DuckPersona-ImageGenFunction', 
            'DuckPersona-MemeGenFunction',
            'DuckPersona-SummarizerFunction'
        ];

        for (const functionName of functions) {
            const metrics = await getPerformanceMetrics(functionName);
            const recommendation = calculateOptimalMemory(metrics);
            
            if (recommendation.shouldUpdate) {
                await updateFunctionMemory(functionName, recommendation.memory);
                console.log(`Updated ${functionName} memory to ${recommendation.memory}MB`);
            }
        }
        
    } catch (error) {
        console.error('Error optimizing memory:', error);
    }
};

async function getPerformanceMetrics(functionName) {
    const endTime = new Date();
    const startTime = new Date(endTime - 24 * 60 * 60 * 1000); // 24 hours ago
    
    const params = {
        MetricDataQueries: [
            {
                Id: 'duration',
                MetricStat: {
                    Metric: {
                        Namespace: 'AWS/Lambda',
                        MetricName: 'Duration',
                        Dimensions: [{ Name: 'FunctionName', Value: functionName }]
                    },
                    Period: 3600,
                    Stat: 'Average'
                }
            },
            {
                Id: 'memory',
                MetricStat: {
                    Metric: {
                        Namespace: 'AWS/Lambda',
                        MetricName: 'MemoryUtilization',
                        Dimensions: [{ Name: 'FunctionName', Value: functionName }]
                    },
                    Period: 3600,
                    Stat: 'Average'
                }
            }
        ],
        StartTime: startTime,
        EndTime: endTime
    };
    
    const result = await cloudwatch.getMetricData(params).promise();
    return result.MetricDataResults;
}

function calculateOptimalMemory(metrics) {
    // Logic to determine if memory should be adjusted
    const avgDuration = metrics.find(m => m.Id === 'duration')?.Values?.[0] || 0;
    const avgMemoryUtil = metrics.find(m => m.Id === 'memory')?.Values?.[0] || 0;
    
    let recommendation = { shouldUpdate: false, memory: null };
    
    // If memory utilization is consistently high, increase memory
    if (avgMemoryUtil > 80) {
        recommendation = { shouldUpdate: true, memory: Math.min(3008, Math.ceil(avgMemoryUtil * 1.5)) };
    }
    // If memory utilization is very low, decrease memory
    else if (avgMemoryUtil < 30 && avgDuration < 5000) {
        recommendation = { shouldUpdate: true, memory: Math.max(128, Math.ceil(avgMemoryUtil * 0.8)) };
    }
    
    return recommendation;
}

async function updateFunctionMemory(functionName, memorySize) {
    const params = {
        FunctionName: functionName,
        MemorySize: memorySize
    };
    
    await lambda.updateFunctionConfiguration(params).promise();
}