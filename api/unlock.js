import { PDFDocument } from 'pdf-lib';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false, // Allow sending large files back
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
    console.log("1. Starting Unlock Request...");

    const form = formidable({
      maxFileSize: 20 * 1024 * 1024, // 20MB Limit
      keepExtensions: true
    });

    const [fields, files] = await form.parse(req);

    // Securely extract data
    const password = Array.isArray(fields.password) ? fields.password[0] : fields.password;
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!uploadedFile) throw new Error("File not received");
    if (!password) throw new Error("Password not received");

    console.log(`2. File Received: ${uploadedFile.originalFilename}, Size: ${uploadedFile.size}`);

    const fileBuffer = fs.readFileSync(uploadedFile.filepath);

    // --- DECRYPTION LOGIC ---
    let pdfDoc;
    try {
      // Load PDF with password
      pdfDoc = await PDFDocument.load(fileBuffer, { 
        password: password,
        ignoreEncryption: false 
      });
      console.log("3. PDF Loaded & Decrypted Successfully");
    } catch (e) {
      console.error("Decryption Failed:", e.message);
      if (e.message.includes('password')) {
        return res.status(401).json({ error: 'INCORRECT_PASSWORD' });
      }
      if (e.message.includes('supported') || e.message.includes('Encryption')) {
        return res.status(422).json({ error: 'UNSUPPORTED_ENCRYPTION' });
      }
      throw e; // Throw other errors to main catch
    }

    // Save as clean PDF (Removes protection)
    const pdfBytes = await pdfDoc.save();
    const outputBuffer = Buffer.from(pdfBytes);

    console.log("4. PDF Saved & Ready to Send");

    // Send Response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="unlocked-${uploadedFile.originalFilename}"`);
    res.setHeader('Content-Length', outputBuffer.length);
    
    return res.status(200).send(outputBuffer);

  } catch (error) {
    console.error('CRITICAL SERVER ERROR:', error);
    return res.status(500).json({ 
      error: 'SERVER_ERROR', 
      details: error.message 
    });
  }
}