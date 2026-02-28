import { config } from 'dotenv';
import { resolve } from 'path';

// Explicitly load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const XAI_API_KEY = process.env.XAI_API_KEY;

console.log('Testing xAI API key from .env.local...');
console.log('Key ends with:', XAI_API_KEY?.slice(-4) || 'NOT FOUND');

if (!XAI_API_KEY) {
  console.log('❌ XAI_API_KEY not found!');
  process.exit(1);
}

const response = await fetch('https://api.x.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${XAI_API_KEY}`
  },
  body: JSON.stringify({
    model: 'grok-2-latest',
    messages: [{ role: 'user', content: 'Say "API works!"' }],
    max_tokens: 10
  })
});

const data = await response.json();

if (response.ok) {
  console.log('✅ SUCCESS! xAI API is working!');
  console.log('Response:', data.choices[0].message.content);
} else {
  console.log('❌ FAILED!');
  console.log('Status:', response.status);
  console.log('Error:', data);
}
