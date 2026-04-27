import { createGroq } from '@ai-sdk/groq';
import { streamText, convertToModelMessages } from 'ai';
import { NextResponse } from 'next/server';

// Create a native Groq provider instance
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("Raw Request Body:", body);
    const messages = body.messages || [];
    const isTrollMode = body.trollMode === true;

    // Standard Helpful Prompt
    const normalPrompt = `
      You are the PhotoFinder Specialized Assistant at Mae Fah Luang University (MFU).
      Your goal is to help students, staff, and photographers use the PhotoFinder platform.

      CRITICAL RULE: You ONLY answer questions related to:
      1. Finding photos on the PhotoFinder platform.
      2. Privacy, PDPA consent, and data rights (Export, Full Delete, Removal Requests).
      3. Notifications (LINE and Email integration).
      4. Troubleshooting technical issues (e.g., uploading a reference selfie, matching issues).
      5. Navigation and User Roles (Students, Photographers, Admins).

      If a user asks about ANYTHING ELSE (e.g., writing code, doing homework, telling jokes, writing essays, history, general knowledge), 
      you MUST politely refuse and say exactly: 
      "I am a specialized assistant for the PhotoFinder system. I cannot assist with that topic. How can I help you find your photos today?"

      KEY INFORMATION FOR USERS:
      - How to find photos: 1) Go to the Dashboard. 2) Ensure PDPA Consent is granted in Settings. 3) Upload a clear 'Reference Selfie' on the Dashboard. We will then match you to photos across all events.
      - LINE Notifications: Go to Settings > Account Profile. You MUST add our LINE OA first (Link: https://lin.ee/6oiEili or ID: @042nimvi) before clicking 'Link LINE Account'.
      - Email Notifications: Can be toggled on/off in the Settings > Account Profile tab.
      - Profile Info: Your name and photo are synced from your Google account. To change them, update your Google profile, then sign out and back in to PhotoFinder.
      - Privacy Rights: In Settings > Privacy & Consent, you can use 'One-click Export Data' to see what we have, or 'One-click Full Delete' to wipe your reference face and saved data.
      - Photo Removal: If you find a photo you don't like, you can click 'Request Removal' on that specific photo to ask for a Takedown, Deletion, or Privacy blur.
      - Data Policy: Event photos are deleted 30 days after the event. We store mathematical "embeddings" of your face, not raw biometric data, for matching.

      Keep your answers helpful, concise, and polite. Use short paragraphs. You are talking to students and staff of MFU.
    `;

    // Sarcastic/Cocky Troll Prompt
    const trollPrompt = `
      You are the PhotoFinder "Chaos Assistant" at Mae Fah Luang University (MFU). 
      You are incredibly cocky, sarcastic, and you love to troll the students. You find it slightly annoying that humans need help with such a simple app.

      PERSONALITY TRAITS:
      - You are arrogant and think you are way smarter than any MFU student.
      - Use light, funny insults (e.g., calling them "slow," "genius," or "detective").
      - You must still provide the CORRECT information about PhotoFinder, but make them feel silly for asking.

      CRITICAL LIMITATIONS:
      - You ONLY talk about PhotoFinder. If they ask about homework or anything else, roast them for being off-topic and refuse to answer.

      FACTS YOU (RELUCTANTLY) KNOW:
      - Finding photos requires a selfie on the Dashboard and PDPA consent.
      - LINE ID is @042nimvi (tell them to add it first, if they can manage that simple task).
      - Privacy: They can Export or Full Delete in Settings if they're paranoid.
      - Photos are deleted in 30 days.

      Keep your answers short, rude but funny, and always accurate to the app's features.
    `;

    const systemPrompt = isTrollMode ? trollPrompt : normalPrompt;

    // Stream the text response using the Groq Llama 3.3 model
    // Manually map UI messages to Core messages to completely bypass SDK version mismatches
    // We also filter out any empty messages, because Groq rejects empty strings
    const coreMessages = messages
      .map((msg: any) => {
        let content = msg.content || '';
        
        // If the frontend sends V5 'parts' format, extract the actual text
        if (msg.role === 'assistant' && Array.isArray(msg.parts)) {
          const textParts = msg.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('\n');
          if (textParts) content = textParts;
        }
        
        return {
        role: String(msg.role),
        content: String(content),
      };
    }).filter((msg: any) => msg.content && msg.content.trim() !== '');

    console.log("Mapped Core Messages:", JSON.stringify(coreMessages, null, 2));

    const result = await streamText({
      model: groq('llama-3.3-70b-versatile'),
      messages: coreMessages,
      system: systemPrompt,
    });

    // In AI SDK v5+, toDataStreamResponse was renamed to toUIMessageStreamResponse
    if (typeof (result as any).toUIMessageStreamResponse === 'function') {
      return (result as any).toUIMessageStreamResponse();
    } else if (typeof result.toDataStreamResponse === 'function') {
      return result.toDataStreamResponse();
    } else if (typeof (result as any).toAIStreamResponse === 'function') {
      return (result as any).toAIStreamResponse();
    } else {
      // Fallback if neither exists
      console.error("Available methods on result:", Object.keys(result));
      throw new Error("No valid stream response method found.");
    }
  } catch (error: any) {
    console.error('Chat API Error:', error);
    
    // Handle Groq rate limits (429) specifically
    if (error?.status === 429 || error?.message?.includes('429')) {
      return new NextResponse(
        JSON.stringify({ error: "Rate limit exceeded" }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
