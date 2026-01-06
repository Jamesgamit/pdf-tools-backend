import { PDFDocument } from 'pdf-lib';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const form = formidable({
      maxFileSize: 20 * 1024 * 1024, // 20MB limit
      keepExtensions: true
    });

    const [fields, files] = await form.parse(req);

    const password = fields.password?.[0];
    const uploadedFile = files.file?.[0];

    if (!password || !uploadedFile) {
      return res.status(400).json({ error: 'File and password are required' });
    }

    const fileBuffer = fs.readFileSync(uploadedFile.filepath);

    // --- UNLOCKING LOGIC ---
    let pdfDoc;
    try {
      // Try to load the PDF using the provided password
      pdfDoc = await PDFDocument.load(fileBuffer, { password: password });
    } catch (e) {
      // If loading fails, it usually means wrong password or unsupported encryption
      if (e.message.includes('password')) {
        return res.status(401).json({ error: 'Incorrect Password!' });
      }
      return res.status(422).json({ error: 'Encryption method not supported by this tool.' });
    }

    // Save the PDF (This removes the password/encryption)
    const pdfBytes = await pdfDoc.save();
    const outputBuffer = Buffer.from(pdfBytes);

    // Send the unlocked file back
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="unlocked-${uploadedFile.originalFilename}"`);
    return res.status(200).send(outputBuffer);

  } catch (error) {
    console.error('Unlock API Error:', error);
    return res.status(500).json({ error: 'Server Error: ' + error.message });
  }
}