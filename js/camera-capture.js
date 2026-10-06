// Wrapper minimo su getUserMedia/canvas per lo scatto doppio stile BeReal.
// Nessuna API Media Capture garantisce due stream simultanei su tutti i device,
// quindi le due foto si scattano in sequenza (back poi front) invece che davvero
// in parallelo: è il compromesso che ogni clone web di BeReal adotta.
// facingMode "exact": se la fotocamera richiesta non è disponibile (es. lo
// stream precedente non si è ancora liberato) il browser deve fallire con
// OverconstrainedError invece di consegnare silenziosamente l'altra camera.
export async function startCamera(facingMode) {
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facingMode } }, audio: false });
}

export function stopCamera(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

// getUserMedia non consegna mai lo stream già specchiato (quello è solo un
// effetto CSS sulla preview, qui non applicato): lo scatto va salvato così
// com'è, senza flip.
export function captureFrame(videoEl) {
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}
