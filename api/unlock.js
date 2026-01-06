import { PDFDocument } from 'pdf-lib';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // --- CORS HEADERS (Security Access) ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // --- 1. Parse File & Password ---
    const form = formidable({
      maxFileSize: 20 * 1024 * 1024, // 20MB limit
      keepExtensions: true
    });

    const [fields, files] = await form.parse(req);

    const password = Array.isArray(fields.password) ? fields.password[0] : fields.password;
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!password || !uploadedFile) {
      return res.status(400).json({ error: 'File and password are required' });
    }

    const fileBuffer = fs.readFileSync(uploadedFile.filepath);

    // --- 2. UNLOCKING LOGIC ---
    let pdfDoc;
    try {
      // Try to load the PDF using the provided password
      // This is where the magic happens. If password is correct, it opens.
      pdfDoc = await PDFDocument.load(fileBuffer, { password: password });
    } catch (e) {
      console.error("Load Failed:", e);
      // Differentiate errors
      if (e.message.includes('password')) {
        return res.status(401).json({ error: 'Incorrect Password! Please try again.' });
      }
      return res.status(422).json({ error: 'Encryption method not supported or file is damaged.' });
    }

    // --- 3. Save as New PDF (Without Password) ---
    // When we save a loaded document, pdf-lib removes the password by default
    const pdfBytes = await pdfDoc.save();
    const outputBuffer = Buffer.from(pdfBytes);

    // --- 4. Send Response ---
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="unlocked-${uploadedFile.originalFilename}"`);
    return res.status(200).send(outputBuffer);

  } catch (error) {
    console.error('Unlock API Error:', error);
    return res.status(500).json({ error: 'Server Error: ' + error.message });
  }
}