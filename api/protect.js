import { PDFDocument } from 'pdf-lib';
import formidable from 'formidable';
import fs from 'fs';

// Vercel को बोल रहे हैं कि फाइल को ऑटोमैटिक Parse मत करो, हम खुद करेंगे
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // सिर्फ POST request को ही allow करेंगे
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. फाइल और पासवर्ड को फॉर्म से निकालना
    const form = formidable({});
    
    const [fields, files] = await form.parse(req);

    // Formidable v3 data ko array me deta hai, isliye [0] lagana padta hai
    const password = fields.password?.[0];
    const uploadedFile = files.file?.[0];

    // Check karna ki user ne dono cheeze bheji hai ya nahi
    if (!password || !uploadedFile) {
      return res.status(400).json({ error: 'File and password are required' });
    }

    // 2. Upload hui file ko read karna
    const fileBuffer = fs.readFileSync(uploadedFile.filepath);

    // 3. PDF Load karna aur Password lagana
    const pdfDoc = await PDFDocument.load(fileBuffer);

    pdfDoc.encrypt({
      userPassword: password,
      ownerPassword: password,
      permissions: {
        printing: 'highResolution',
        modifying: false,
        copying: false,
        annotating: false,
      },
    });

    // 4. File ko wapas Save karna
    const pdfBytes = await pdfDoc.save();
    const outputBuffer = Buffer.from(pdfBytes);

    // 5. User ko wapas bhejna (Download)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="protected-${uploadedFile.originalFilename}"`);
    
    return res.status(200).send(outputBuffer);

  } catch (error) {
    console.error('Protect API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to protect PDF', 
      details: error.message 
    });
  }
}