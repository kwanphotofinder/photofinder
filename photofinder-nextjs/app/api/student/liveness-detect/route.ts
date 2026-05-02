import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const frameFile = formData.get('frame') as Blob;

    if (!frameFile) {
      return NextResponse.json(
        { error: 'No frame provided' },
        { status: 400 }
      );
    }

    // Forward to AI service for liveness detection
    // Default to port 8000 (host) where the AI container is exposed
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const detectUrl = `${aiServiceUrl}/liveness/detect`;
    console.log('[LIVENESS API] Forwarding to AI service URL:', detectUrl);

    // Create form data for AI service
    const aiFormData = new FormData();
    aiFormData.append('file', frameFile, 'frame.jpg');

    try {
      const aiResponse = await fetch(detectUrl, {
        method: 'POST',
        body: aiFormData,
      });

      if (!aiResponse.ok) {
        const text = await aiResponse.text().catch(() => '<no body>');
        console.error('AI service error:', aiResponse.status, text);
        // Return default response and include AI error for debugging
        return NextResponse.json({
          blink: false,
          head_turn: false,
          head_turn_direction: null,
          head_up: false,
          head_down: false,
          face_detected: false,
          confidence: 0,
          ai_error: { status: aiResponse.status, body: text },
          ai_request_url: detectUrl,
        });
      }

      const livenessResult = await aiResponse.json();

      const response = {
        blink: livenessResult.blink || false,
        head_turn: livenessResult.head_turn || false,
        head_turn_direction: livenessResult.head_turn_direction || null,
        head_up: livenessResult.head_up || false,
        head_down: livenessResult.head_down || false,
        face_detected: livenessResult.face_detected !== false,
        confidence: livenessResult.confidence || 0,
        ai_request_url: detectUrl,
      };

      console.log('[LIVENESS API] AI Response:', livenessResult);
      console.log('[LIVENESS API] Formatted Response:', response);

      return NextResponse.json(response);
    } catch (fetchError) {
      console.error('Error calling AI service:', fetchError);
      // Return default response if AI service is unreachable
      return NextResponse.json({
        blink: false,
        head_turn: false,
        head_turn_direction: null,
        head_up: false,
        head_down: false,
        face_detected: false,
        confidence: 0,
      });
    }
  } catch (error) {
    console.error('Liveness detection error:', error);
    return NextResponse.json(
      { error: 'Failed to process liveness detection' },
      { status: 500 }
    );
  }
}
