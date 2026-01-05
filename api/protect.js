import { PDFDocument } from 'pdf-lib';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const form = formidable({ maxFileSize: 10 * 1024 * 1024, keepExtensions: true });
    const [fields, files] = await form.parse(req);

    const password = Array.isArray(fields.password) ? fields.password[0] : fields.password;
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!password || !uploadedFile) {
      return res.status(400).json({ error: 'File and password are required' });
    }

    const fileBuffer = fs.readFileSync(uploadedFile.filepath);
    const pdfDoc = await PDFDocument.load(fileBuffer);

    // This function requires pdf-lib > 1.7.0
    pdfDoc.encrypt({
      userPassword: password,
      ownerPassword: password,
      permissions: { printing: 'highResolution', modifying: false, copying: false, annotating: false },
    });

    const pdfBytes = await pdfDoc.save();
    const outputBuffer = Buffer.from(pdfBytes);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="protected-${uploadedFile.originalFilename}"`);
    return res.status(200).send(outputBuffer);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Processing Failed', details: error.message });
  }
}