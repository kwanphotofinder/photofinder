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

  const response = await fetch(`${aiUrl}/extract`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`AI Service error: ${response.statusText}`);
  }

  const data = await response.json();
  return data as FaceEmbedding[];
}
