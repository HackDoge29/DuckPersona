// lambda/test/orchestrator.test.js
const { handler } = require('../orchestrator/dist/index');

describe('Orchestrator Lambda', () => {
    test('handles mint command', async () => {
        const event = {
            body: JSON.stringify({
                message: {
                    chat: { id: 12345 },
                    from: { id: 67890 },
                    text: '/mint'
                }
            })
        };
        
        const result = await handler(event, {});
        expect(result.statusCode).toBe(200);
    });
    
    test('handles duck chat', async () => {
        const event = {
            body: JSON.stringify({
                message: {
                    chat: { id: 12345 },
                    from: { id: 67890 },
                    text: 'Hello duck!'
                }
            })
        };
        
        const result = await handler(event, {});
        expect(result.statusCode).toBe(200);
    });
});