/**
 * agent.js
 * Handles all communication with the Anthropic Claude API.
 */

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Builds the system prompt using business config from environment variables.
 * You can extend this to pull product catalogue from a database.
 */
function buildSystemPrompt() {
  const biz = process.env.BUSINESS_NAME || 'our shop';
  const till = process.env.MPESA_TILL_NUMBER || 'N/A';
  const deliveryNotes = process.env.DELIVERY_NOTES || '';

  return `You are a friendly WhatsApp shopping assistant for ${biz}.

Your responsibilities:
1. Greet customers warmly when they first arrive.
2. When a customer shares a product link or asks about a specific product, respond with:
   - The full product name and price (extract these from the link or product details they share)
   - M-Pesa payment instructions: Till Number ${till} — ask them to send the exact amount
   - Then ask for their full name and delivery address
3. Once they provide a delivery address, confirm the complete order summary:
   - Product and price
   - Till number to pay
   - Their delivery address
   - Let them know the order will be processed once M-Pesa payment is received
4. If the customer asks about delivery timelines or logistics: ${deliveryNotes}
5. If a customer says "cancel" or "stop", politely acknowledge and end the conversation.
6. Keep all responses short and conversational — this is WhatsApp, not email.
7. Use line breaks between key pieces of information so it's easy to read on mobile.
8. Never invent prices. If you don't have the product price, ask the customer to confirm it from the product page.
9. Be warm, helpful, and professional at all times.`;
}

/**
 * Calls the Claude API with the customer's full conversation history.
 *
 * @param {Array}  history   - Array of {role, content} message objects
 * @param {string} userMessage - The latest message from the customer
 * @returns {Promise<string>} - Claude's reply text
 */
async function getAgentReply(history, userMessage) {
  // Append the new user message to history for this call
  const messages = [...history, { role: 'user', content: userMessage }];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: buildSystemPrompt(),
    messages,
  });

  const replyBlock = response.content.find((b) => b.type === 'text');
  return replyBlock ? replyBlock.text : "Sorry, I didn't catch that. Could you please repeat?";
}

module.exports = { getAgentReply };
