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
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:7860';
    const detectUrl = `${aiServiceUrl}/liveness/detect`;

    // Create form data for AI service
    const aiFormData = new FormData();
    aiFormData.append('file', frameFile, 'frame.jpg');

    try {
      const aiResponse = await fetch(detectUrl, {
        method: 'POST',
        body: aiFormData,
      });

      if (!aiResponse.ok) {
        console.error('AI service error:', aiResponse.statusText);
        // Return default response if AI service fails
        return NextResponse.json({
          blink: false,
          head_turn: false,
          head_up: false,
          head_down: false,
          face_detected: false,
          confidence: 0,
        });
      }

      const livenessResult = await aiResponse.json();

      return NextResponse.json({
        blink: livenessResult.blink || false,
        head_turn: livenessResult.head_turn || false,
        head_up: livenessResult.head_up || false,
        head_down: livenessResult.head_down || false,
        face_detected: livenessResult.face_detected !== false,
        confidence: livenessResult.confidence || 0,
      });
    } catch (fetchError) {
      console.error('Error calling AI service:', fetchError);
      // Return default response if AI service is unreachable
      return NextResponse.json({
        blink: false,
        head_turn: false,
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
