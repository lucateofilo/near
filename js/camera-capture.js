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

// Zoom e torcia sono constraint non standard (MediaTrackCapabilities), supportate
// solo su alcuni browser/device (perlopiù Chrome Android, fotocamera posteriore):
// niente libreria, solo applyConstraints col fallback "non disponibile" lasciato
// al chiamante, che nasconde il controllo quando la capability manca.
export function getZoomCapability(stream) {
  const caps = stream.getVideoTracks()[0]?.getCapabilities?.();
  return caps?.zoom ? { min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1 } : null;
}

export function setZoom(stream, value) {
  return stream.getVideoTracks()[0].applyConstraints({ advanced: [{ zoom: Number(value) }] });
}

export function hasTorch(stream) {
  return !!stream.getVideoTracks()[0]?.getCapabilities?.()?.torch;
}

export function setTorch(stream, on) {
  return stream.getVideoTracks()[0].applyConstraints({ advanced: [{ torch: on }] });
}

// getUserMedia non consegna mai lo stream già specchiato: il flip va fatto
// esplicitamente qui, e deve combaciare con quello CSS applicato alla preview
// (classe .mirrored) perché lo scatto salvato corrisponda a ciò che si vede
// mentre si inquadra — come una normale fotocamera frontale.
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
