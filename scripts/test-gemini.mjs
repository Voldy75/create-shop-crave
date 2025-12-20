
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import fs from 'fs';
import path from 'path';

// Manual env parsing to avoid adding dotenv dependency
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            content.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^["']|["']$/g, '');
                    process.env[key] = value;
                    // console.log(`Loaded ${key}`); // Don't log values
                }
            });
        } else {
            console.warn("Warning: .env.local not found at " + envPath);
        }
    } catch (e) {
        console.error("Error loading .env.local", e);
    }
}

loadEnv();

async function testGemini() {
    console.log("Checking API Key availability...");
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        console.error("❌ GOOGLE_GENERATIVE_AI_API_KEY is missing from environment variables.");
        process.exit(1);
    }
    console.log("✅ API Key found (length: " + process.env.GOOGLE_GENERATIVE_AI_API_KEY.length + ")");
    console.log("Key prefix: " + process.env.GOOGLE_GENERATIVE_AI_API_KEY.substring(0, 4) + "...");

    const models = ["gemini-2.5-flash"];

    for (const modelName of models) {
        console.log(`\nTesting model: ${modelName}...`);
        try {
            const result = await generateText({
                model: google(modelName),
                prompt: "Hello",
            });
            console.log(`✅ Success with ${modelName}`);
            console.log(result.text.substring(0, 50) + "...");
            return; // Exit on first success
        } catch (error) {
            console.error(`❌ Failed with ${modelName}:`);
            if (error instanceof Error) console.error(error.message);
        }
    }
    process.exit(1);
}

testGemini();
