import { PDFDocument } from 'pdf-lib';
import formidable from 'formidable';
import fs from 'fs';

// Body Parser Disable (Zaruri hai)
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
      maxFileSize: 10 * 1024 * 1024, // 10MB Limit set kar rahe hain
      keepExtensions: true
    });

    const [fields, files] = await form.parse(req);

    // FIX: Formidable kabhi Array deta hai kabhi Object, dono handle karenge
    const password = Array.isArray(fields.password) ? fields.password[0] : fields.password;
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;

    // Debugging ke liye check
    if (!uploadedFile) {
      throw new Error(`File not received. Received files keys: ${Object.keys(files).join(',')}`);
    }
    if (!password) {
      throw new Error("Password not received.");
    }

    // File Read
    const fileBuffer = fs.readFileSync(uploadedFile.filepath);

    // PDF Process
    const pdfDoc = await PDFDocument.load(fileBuffer);
    pdfDoc.encrypt({
      userPassword: password,
      ownerPassword: password,
      permissions: { printing: 'highResolution', modifying: false, copying: false, annotating: false },
    });

    const pdfBytes = await pdfDoc.save();
    const outputBuffer = Buffer.from(pdfBytes);

    // Send Response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="protected-${uploadedFile.originalFilename}"`);
    return res.status(200).send(outputBuffer);

  } catch (error) {
    console.error('SERVER ERROR:', error);
    // Yaha hum ASLI Error bhejenge taaki frontend par dikhe
    return res.status(500).json({ 
      error: 'Processing Failed', 
      details: error.message // <--- Ye asli error hai
    });
  }
}