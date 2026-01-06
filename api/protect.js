const { IncomingForm } = require('formidable');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const form = new IncomingForm({ maxFileSize: 10 * 1024 * 1024, keepExtensions: true });
    
    const parseForm = (req) => new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err); else resolve({ fields, files });
      });
    });

    const { fields, files } = await parseForm(req);
    const password = Array.isArray(fields.password) ? fields.password[0] : fields.password;
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!password || !uploadedFile) return res.status(400).json({ error: 'File and password are required' });

    const fileBuffer = fs.readFileSync(uploadedFile.filepath);
    
    // Log version check (internal debug)
    console.log('PDF-Lib Loading...');
    
    const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });

    if (typeof pdfDoc.encrypt !== 'function') {
      throw new Error('CRITICAL: pdf-lib version mismatch. Encrypt function missing.');
    }

    pdfDoc.encrypt({ userPassword: password, ownerPassword: password, permissions: { printing: 'highResolution', modifying: false, copying: false, annotating: false } });

    const pdfBytes = await pdfDoc.save();
    const outputBuffer = Buffer.from(pdfBytes);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="protected-${uploadedFile.originalFilename}"`);
    return res.status(200).send(outputBuffer);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Failed to protect PDF', details: error.message });
  }
}