// Upload non firmato (unsigned upload preset): nessun segreto lato client, per design.
// Da sostituire con i valori della tua Cloudinary Console dopo aver creato l'account
// e un upload preset "Unsigned" (Settings > Upload > Upload presets > Add upload preset).
export const CLOUDINARY_CLOUD_NAME = 'ypihgcio';
export const CLOUDINARY_UPLOAD_PRESET = 'ml_default';

export async function uploadToCloudinary(file, folder) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Caricamento foto non riuscito.');
  const data = await res.json();
  return data.secure_url;
}
