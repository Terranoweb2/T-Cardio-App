import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument, rgb, PDFFont, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import * as path from 'path';

interface MedicationItem {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

interface PrescriptionData {
  doctorName: string;
  rppsNumber: string | null;
  doctorSpecialty: string;
  patientName: string;
  patientAge: number | null;
  medications: MedicationItem[];
  notes?: string;
  date: Date;
  signatureImage?: Buffer | null;
  stampImage?: Buffer | null;
}

@Injectable()
export class PrescriptionPdfService {
  private readonly logger = new Logger(PrescriptionPdfService.name);
  private regularFontBytes: Uint8Array | null = null;
  private boldFontBytes: Uint8Array | null = null;
  private logoBytes: Uint8Array | null = null;

  constructor() {
    this.loadFonts();
    this.loadLogo();
  }

  private loadFonts() {
    try {
      // Try multiple paths for font files (dev vs production Docker)
      const possiblePaths = [
        path.join(__dirname, '..', '..', '..', 'assets', 'fonts'),
        path.join(process.cwd(), 'assets', 'fonts'),
        path.join('/app', 'assets', 'fonts'),
      ];

      for (const fontsDir of possiblePaths) {
        const regularPath = path.join(fontsDir, 'Roboto-Regular.ttf');
        const boldPath = path.join(fontsDir, 'Roboto-Bold.ttf');
        if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
          this.regularFontBytes = fs.readFileSync(regularPath);
          this.boldFontBytes = fs.readFileSync(boldPath);
          this.logger.log(`Polices Roboto chargees depuis ${fontsDir}`);
          return;
        }
      }
      this.logger.warn('Polices Roboto non trouvees — utilisation des polices standard (pas de support accents)');
    } catch (err) {
      this.logger.warn(`Erreur chargement polices: ${err.message}`);
    }
  }

  private loadLogo() {
    try {
      const possiblePaths = [
        path.join(__dirname, '..', '..', '..', 'assets', 'logo-T-Cardio.png'),
        path.join(process.cwd(), 'assets', 'logo-T-Cardio.png'),
        path.join('/app', 'assets', 'logo-T-Cardio.png'),
      ];
      for (const logoPath of possiblePaths) {
        if (fs.existsSync(logoPath)) {
          this.logoBytes = fs.readFileSync(logoPath);
          this.logger.log(`Logo charge depuis ${logoPath}`);
          return;
        }
      }
      this.logger.warn('Logo T-Cardio non trouve');
    } catch (err) {
      this.logger.warn(`Erreur chargement logo: ${err.message}`);
    }
  }

  // Safe text rendering: replace characters that the font can't handle
  private safeText(text: string): string {
    if (!text) return '';
    return text.toString();
  }

  async generatePrescription(data: PrescriptionData): Promise<Buffer> {
    const doc = await PDFDocument.create();

    let font: PDFFont;
    let boldFont: PDFFont;

    // Use embedded Roboto fonts if available (supports French accents)
    if (this.regularFontBytes && this.boldFontBytes) {
      doc.registerFontkit(fontkit);
      font = await doc.embedFont(this.regularFontBytes);
      boldFont = await doc.embedFont(this.boldFontBytes);
    } else {
      // Fallback to standard fonts (no accent support)
      const { StandardFonts } = await import('pdf-lib');
      font = await doc.embedFont(StandardFonts.Helvetica);
      boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    }

    let page = doc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    let y = height - 40;

    // Embed logo if available
    let logoImage: any = null;
    if (this.logoBytes) {
      try {
        logoImage = await doc.embedPng(this.logoBytes);
      } catch {
        this.logger.warn('Failed to embed logo in PDF');
      }
    }

    // Helper to draw header on any page
    const drawHeader = (p: PDFPage) => {
      const pH = p.getSize().height;
      // Purple header bar
      p.drawRectangle({
        x: 0, y: pH - 80, width, height: 80,
        color: rgb(0.345, 0.11, 0.53),
      });
      // Logo
      if (logoImage) {
        const logoDim = logoImage.scale(40 / logoImage.height);
        p.drawImage(logoImage, {
          x: 20, y: pH - 60, width: logoDim.width, height: logoDim.height,
        });
      }
      const textX = logoImage ? 68 : 50;
      p.drawText('T-Cardio Pro', {
        x: textX, y: pH - 35, size: 22, font: boldFont, color: rgb(1, 1, 1),
      });
      p.drawText('ORDONNANCE MEDICALE', {
        x: textX, y: pH - 58, size: 12, font, color: rgb(0.8, 0.7, 1),
      });
      // Green ECG bar
      p.drawRectangle({
        x: 0, y: pH - 84, width, height: 4,
        color: rgb(0.133, 0.773, 0.369),
      });
    };

    // Helper to draw footer on any page
    const drawFooter = (p: PDFPage) => {
      p.drawText(this.safeText('Ordonnance g\u00e9n\u00e9r\u00e9e via T-Cardio Pro \u2014 Document \u00e0 usage m\u00e9dical uniquement'), {
        x: 50, y: 30, size: 8, font, color: rgb(0.6, 0.6, 0.7),
      });
    };

    // ===== HEADER =====
    drawHeader(page);

    y = height - 110;

    // ===== DOCTOR INFO =====
    page.drawText(this.safeText(data.doctorName.startsWith('Dr.') ? data.doctorName : `Dr. ${data.doctorName}`), {
      x: 50, y, size: 14, font: boldFont, color: rgb(0.1, 0.1, 0.2),
    });
    y -= 18;
    page.drawText(this.safeText(data.doctorSpecialty || 'M\u00e9decin'), {
      x: 50, y, size: 10, font, color: rgb(0.4, 0.4, 0.5),
    });
    y -= 16;
    if (data.rppsNumber) {
      page.drawText(this.safeText(`RPPS : ${data.rppsNumber}`), {
        x: 50, y, size: 10, font, color: rgb(0.4, 0.4, 0.5),
      });
      y -= 16;
    }

    // Date (right aligned)
    const dateStr = data.date.toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const dateTxt = this.safeText(`Date : ${dateStr}`);
    try {
      const dateWidth = font.widthOfTextAtSize(dateTxt, 10);
      page.drawText(dateTxt, {
        x: width - 50 - dateWidth, y: height - 110, size: 10, font, color: rgb(0.3, 0.3, 0.4),
      });
    } catch {
      // Fallback if date text has unsupported chars
      page.drawText(dateTxt, {
        x: width - 200, y: height - 110, size: 10, font, color: rgb(0.3, 0.3, 0.4),
      });
    }

    y -= 10;

    // Separator
    page.drawLine({
      start: { x: 50, y }, end: { x: width - 50, y },
      thickness: 1, color: rgb(0.8, 0.8, 0.9),
    });
    y -= 25;

    // ===== PATIENT INFO =====
    page.drawText('Patient :', {
      x: 50, y, size: 10, font: boldFont, color: rgb(0.3, 0.3, 0.4),
    });
    let patientInfo = this.safeText(data.patientName);
    if (data.patientAge) patientInfo += ` (${data.patientAge} ans)`;
    page.drawText(patientInfo, {
      x: 110, y, size: 11, font, color: rgb(0.1, 0.1, 0.2),
    });
    y -= 30;

    // ===== MEDICATIONS =====
    page.drawText('M\u00e9dicaments prescrits :', {
      x: 50, y, size: 12, font: boldFont, color: rgb(0.345, 0.11, 0.53),
    });
    y -= 25;

    for (let i = 0; i < data.medications.length; i++) {
      const med = data.medications[i];

      // Multi-page support: create new page if not enough space
      if (y < 140) {
        drawFooter(page);
        page = doc.addPage([595, 842]);
        drawHeader(page);
        y = page.getSize().height - 100;
        page.drawText('M\u00e9dicaments prescrits (suite) :', {
          x: 50, y, size: 10, font, color: rgb(0.4, 0.4, 0.5),
        });
        y -= 25;
      }

      // Medication box
      page.drawRectangle({
        x: 50, y: y - 10, width: width - 100, height: 65,
        color: rgb(0.97, 0.96, 1), borderColor: rgb(0.8, 0.7, 1),
        borderWidth: 1,
      });

      page.drawText(this.safeText(`${i + 1}. ${med.name}`), {
        x: 60, y: y + 35, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.2),
      });
      page.drawText(this.safeText(`Posologie : ${med.dosage}`), {
        x: 60, y: y + 20, size: 10, font, color: rgb(0.3, 0.3, 0.4),
      });
      page.drawText(this.safeText(`Fr\u00e9quence : ${med.frequency}   |   Dur\u00e9e : ${med.duration}`), {
        x: 60, y: y + 5, size: 10, font, color: rgb(0.3, 0.3, 0.4),
      });

      if (med.notes) {
        page.drawText(this.safeText(`Note : ${med.notes}`), {
          x: 60, y: y - 8, size: 9, font, color: rgb(0.5, 0.4, 0.6),
        });
      }

      y -= 80;
    }

    // ===== NOTES =====
    if (data.notes) {
      if (y < 120) {
        drawFooter(page);
        page = doc.addPage([595, 842]);
        drawHeader(page);
        y = page.getSize().height - 100;
      }

      y -= 10;
      page.drawText('Notes :', {
        x: 50, y, size: 11, font: boldFont, color: rgb(0.345, 0.11, 0.53),
      });
      y -= 18;

      // Simple text wrapping
      const words = data.notes.split(' ');
      let line = '';
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        try {
          if (font.widthOfTextAtSize(this.safeText(testLine), 10) > width - 120) {
            page.drawText(this.safeText(line), { x: 50, y, size: 10, font, color: rgb(0.3, 0.3, 0.4) });
            y -= 15;
            if (y < 60) {
              drawFooter(page);
              page = doc.addPage([595, 842]);
              drawHeader(page);
              y = page.getSize().height - 100;
            }
            line = word;
          } else {
            line = testLine;
          }
        } catch {
          line = testLine;
        }
      }
      if (line) {
        page.drawText(this.safeText(line), { x: 50, y, size: 10, font, color: rgb(0.3, 0.3, 0.4) });
        y -= 15;
      }
    }

    // ===== SIGNATURE & STAMP =====
    const signatureBlockHeight = 120;
    if (y < signatureBlockHeight + 50) {
      drawFooter(page);
      page = doc.addPage([595, 842]);
      drawHeader(page);
      y = page.getSize().height - 100;
    }

    y -= 20;

    // Stamp image (left side of signature area)
    const stampX = width - 300;
    if (data.stampImage) {
      try {
        let stampImg;
        const stampHeader = data.stampImage.slice(0, 4);
        if (stampHeader[0] === 0x89 && stampHeader[1] === 0x50) {
          stampImg = await doc.embedPng(data.stampImage);
        } else {
          stampImg = await doc.embedJpg(data.stampImage);
        }
        const stampScale = 80 / Math.max(stampImg.width, stampImg.height);
        const stampW = stampImg.width * stampScale;
        const stampH = stampImg.height * stampScale;
        page.drawImage(stampImg, {
          x: stampX, y: y - stampH, width: stampW, height: stampH,
        });
      } catch (err) {
        this.logger.warn(`Failed to embed stamp image: ${err.message}`);
      }
    }

    // Signature area (right side)
    const sigX = width - 200;

    // Signature image
    if (data.signatureImage) {
      try {
        let sigImg;
        const sigHeader = data.signatureImage.slice(0, 4);
        if (sigHeader[0] === 0x89 && sigHeader[1] === 0x50) {
          sigImg = await doc.embedPng(data.signatureImage);
        } else {
          sigImg = await doc.embedJpg(data.signatureImage);
        }
        const sigScale = Math.min(150 / sigImg.width, 60 / sigImg.height);
        const sigW = sigImg.width * sigScale;
        const sigH = sigImg.height * sigScale;
        page.drawImage(sigImg, {
          x: sigX, y: y - sigH, width: sigW, height: sigH,
        });
        y -= (Math.max(sigH, 60) + 10);
      } catch (err) {
        this.logger.warn(`Failed to embed signature image: ${err.message}`);
        // Fallback to text signature
        y -= 30;
      }
    } else {
      y -= 30;
    }

    // Signature line
    page.drawLine({
      start: { x: sigX - 10, y }, end: { x: width - 50, y },
      thickness: 1, color: rgb(0.6, 0.6, 0.7),
    });
    y -= 15;
    page.drawText(this.safeText(data.doctorName.startsWith('Dr.') ? data.doctorName : `Dr. ${data.doctorName}`), {
      x: sigX - 10, y, size: 10, font: boldFont, color: rgb(0.2, 0.2, 0.3),
    });
    y -= 14;
    if (!data.signatureImage) {
      page.drawText('Signature \u00e9lectronique T-Cardio Pro', {
        x: sigX - 10, y, size: 8, font, color: rgb(0.5, 0.5, 0.6),
      });
    } else {
      page.drawText(this.safeText(data.doctorSpecialty || 'M\u00e9decin'), {
        x: sigX - 10, y, size: 8, font, color: rgb(0.5, 0.5, 0.6),
      });
    }

    // ===== FOOTER =====
    drawFooter(page);

    const pdfBytes = await doc.save();
    this.logger.log(`PDF g\u00e9n\u00e9r\u00e9 : ${pdfBytes.length} octets, ${doc.getPageCount()} page(s)`);
    return Buffer.from(pdfBytes);
  }
}
