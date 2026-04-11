import { NextResponse } from 'next/server';

export const maxDuration = 10; // Fast timeout, just a ping

export async function GET() {
  try {
    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    
    // We just need to hit the root or /health to trigger the Hugging Face Space to wake up
    // We don't await the response, we just fire and forget (with a short timeout to prevent Vercel hanging)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    
    fetch(aiUrl, { signal: controller.signal }).catch(() => {});
    clearTimeout(timeout);
    
    return NextResponse.json({ status: 'waking_up' });
  } catch (error) {
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
