import { NextRequest, NextResponse } from 'next/server';
import { runCleanup } from '@/lib/cleanup';

// This allows the cron job to run for up to 60 seconds
export const maxDuration = 60;

// Manual trigger. The in-app scheduler (lib/cleanup-scheduler.ts) runs the same cleanup daily;
// this route stays for running it by hand.
export async function GET(request: NextRequest) {
  try {
    // Strict security: only allow requests with the matching CRON_SECRET authorization header
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    console.log('Running daily cleanup job...');
    const result = await runCleanup();

    return NextResponse.json({ message: 'Cleanup successful', ...result });
  } catch (error) {
    console.error('Cron cleanup error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
