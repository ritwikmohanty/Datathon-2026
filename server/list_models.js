/**
 * List available Gemini models
 */
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  console.log('Available Gemini Models:\n');
  
  try {
    const models = await genAI.listModels();
    for await (const model of models) {
      console.log(`- ${model.name}`);
      console.log(`  Display Name: ${model.displayName}`);
      console.log(`  Supported Methods: ${model.supportedGenerationMethods?.join(', ')}`);
      console.log('');
    }
  } catch (error) {
    console.error('Error listing models:', error.message);
    
    // Try specific models
    console.log('\nTrying specific models...');
    const modelsToTry = [
      'gemini-pro',
      'gemini-1.0-pro',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-2.0-flash',
      'gemini-2.0-flash-exp',
      'models/gemini-pro',
      'models/gemini-1.5-flash'
    ];
    
    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Say "Hello"');
        console.log(`✅ ${modelName} - WORKS!`);
      } catch (e) {
        console.log(`❌ ${modelName} - ${e.message.substring(0, 50)}...`);
      }
    }
  }
}

listModels();
