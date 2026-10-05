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

// Molti browser mobile (es. Chrome su Android) consegnano lo stream della
// fotocamera frontale già specchiato a livello di driver, per far "sentire"
// naturale l'anteprima come davanti a uno specchio. Lo scatto però va salvato
// com'è realmente (non specchiato): per la frontale ribaltiamo il canvas prima
// di disegnare, annullando lo specchiamento solo nel file finale.
export function captureFrame(videoEl, mirror = false) {
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext('2d');
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(videoEl, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}
