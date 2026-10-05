// Wrapper minimo su getUserMedia/canvas per lo scatto doppio stile BeReal.
// Nessuna API Media Capture garantisce due stream simultanei su tutti i device,
// quindi le due foto si scattano in sequenza (back poi front) invece che davvero
// in parallelo: è il compromesso che ogni clone web di BeReal adotta.
export async function startCamera(facingMode) {
  return navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
}

export function stopCamera(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

export function captureFrame(videoEl) {
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  canvas.getContext('2d').drawImage(videoEl, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}
