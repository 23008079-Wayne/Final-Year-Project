const axios = require('axios');

const chatbotController = {
  // Chat endpoint for stock/financial questions
  async chat(req, res) {
    try {
      const { message } = req.body;
      
      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
      }

      // System prompt to restrict chatbot to stocks/finance only
      const systemPrompt = `You are a financial and stock market assistant. You can only answer questions related to:
- Stock market trends and analysis
- Financial news and market updates
- Investment strategies
- Company financial information
- Market indicators and economic data
- Trading concepts and terminology

If a question is not related to stocks, finance, or investing, politely decline and redirect the conversation to financial topics.
Keep responses concise and informative.`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: message
            }
          ],
          temperature: 0.7,
          max_tokens: 500
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('[Chatbot] OpenAI Response Status:', response.status);
      const reply = response.data.choices[0].message.content;
      console.log('[Chatbot] Bot Reply:', reply);
      res.json({ reply });

    } catch (error) {
      console.error('❌ Chatbot error details:');
      console.error('  Status:', error.response?.status);
      console.error('  Data:', JSON.stringify(error.response?.data, null, 2));
      console.error('  Message:', error.message);
      
      // Return detailed error message to client
      let errorMsg = 'Unknown error';
      
      if (error.response?.data?.error?.message) {
        errorMsg = error.response.data.error.message;
      } else if (error.response?.data?.error) {
        errorMsg = typeof error.response.data.error === 'string' 
          ? error.response.data.error 
          : JSON.stringify(error.response.data.error);
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      console.error('  Final error message:', errorMsg);
      
      res.status(500).json({ 
        error: errorMsg
      });
    }
  }
};

module.exports = chatbotController;
