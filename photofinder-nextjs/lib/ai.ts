export interface FaceEmbedding {
  embedding: number[];
  bbox: number[];
  det_score: number;
}

export async function extractFaces(imageBuffer: Buffer, filename: string = 'image.jpg'): Promise<FaceEmbedding[]> {
  const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  
  // Use native FormData and Blob instead of npm form-data package
  // Modern Next.js fetch doesn't work well with the legacy form-data package headers
  const blob = new Blob([new Uint8Array(imageBuffer)]);
  const formData = new FormData();
  formData.append('file', blob, filename);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 seconds

  let response: Response;
  try {
    response = await fetch(`${aiUrl}/extract`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('AI Service timed out after 45 seconds. It might be waking up (cold start).');
    }
    throw new Error(`Unable to reach the AI service at ${aiUrl}. Start the ai-service container or point AI_SERVICE_URL to a reachable endpoint.`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`AI Service error (${response.status}): ${response.statusText || 'Unknown error'}`);
  }

  const data = await response.json();
  return data as FaceEmbedding[];
}
