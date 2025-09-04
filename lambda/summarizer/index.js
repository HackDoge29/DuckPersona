const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const axios = require('axios');
const cheerio = require('cheerio');

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

exports.handler = async (event, context) => {
    try {
        const body = JSON.parse(event.body || '{}');
        const url = body.url;
        
        if (!url) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'URL is required' })
            };
        }
        
        // Fetch and extract content
        const content = await fetchWebContent(url);
        
        if (!content) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Could not extract content from URL' })
            };
        }
        
        // Generate summary using Bedrock
        const summary = await generateSummary(content, url);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                url: url,
                summary: summary,
                wordCount: content.split(' ').length
            })
        };
        
    } catch (error) {
        console.error('Error summarizing content:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to summarize content' })
        };
    }
};

async function fetchWebContent(url) {
    try {
        // Add timeout and proper headers
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'DuckPersona-Summarizer/1.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            maxRedirects: 5
        });
        
        const $ = cheerio.load(response.data);
        
        // Remove script and style elements
        $('script, style, nav, header, footer, aside, .advertisement').remove();
        
        // Try to extract main content
        let content = '';
        
        // Look for common article containers
        const contentSelectors = [
            'article',
            '.article-content',
            '.post-content', 
            '.entry-content',
            '.content',
            'main',
            '.main-content',
            '#content'
        ];
        
        for (const selector of contentSelectors) {
            const element = $(selector);
            if (element.length > 0 && element.text().length > 200) {
                content = element.text();
                break;
            }
        }
        
        // Fallback to body if no specific content area found
        if (!content) {
            content = $('body').text();
        }
        
        // Clean up whitespace
        content = content.replace(/\s+/g, ' ').trim();
        
        // Limit content length for processing
        if (content.length > 10000) {
            content = content.substring(0, 10000) + '...';
        }
        
        return content;
        
    } catch (error) {
        console.error('Error fetching web content:', error);
        return null;
    }
}

async function generateSummary(content, url) {
    try {
        const prompt = `Please provide a concise summary of the following web content. Focus on the main points and key information. Keep the summary under 200 words.

URL: ${url}

Content:
${content}

Summary:`;

        const command = new InvokeModelCommand({
            modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 300,
                temperature: 0.3,
                anthropic_version: 'bedrock-2023-05-31'
            }),
            contentType: 'application/json'
        });
        
        const response = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        
        return responseBody.content[0].text.trim();
        
    } catch (error) {
        console.error('Error generating summary:', error);
        return 'Unable to generate summary at this time.';
    }
}