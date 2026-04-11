export async function downloadPhoto(url: string, eventName: string, eventDate: string) {
  try {
    const downloadUrl = url.endsWith('.jpg') ? url : `${url}.jpg`;
    const response = await fetch(downloadUrl);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    const date = new Date(eventDate).toISOString().split('T')[0];
    const timestamp = Date.now();
    a.download = `${eventName.replace(/\s+/g, '_')}_${date}_${timestamp}.jpg`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
  } catch (err) {
    console.error('Failed to download photo:', err);
    alert('Unable to download automatically. Opening photo in new tab...');
    // Fallback to opening in new tab
    window.open(url, '_blank');
  }
}
