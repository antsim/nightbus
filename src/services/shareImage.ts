/**
 * Saves a PNG data URL: the share sheet on phones that support sharing
 * files, otherwise a regular download.
 */
export async function saveImage(dataUrl: string, filename: string, title: string): Promise<void> {
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], filename, { type: 'image/png' });

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Sharing failed for another reason: fall back to a download.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
