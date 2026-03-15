import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import * as path from 'path';

interface ReportData {
  patientName: string;
  patientAge: number | null;
  periodStart: string;
  periodEnd: string;
  measurements: Array<{ date: string; systolic: number; diastolic: number; pulse?: number }>;
  stats: { systolicAvg: number; diastolicAvg: number; count: number };
  aiSummaryPatient?: string;
  aiSummaryDoctor?: string;
  riskLevel?: string;
  doctorNotes?: string;
  doctorName?: string;
  reportType?: string;
}

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);
  private regularFontBytes: Uint8Array | null = null;
  private boldFontBytes: Uint8Array | null = null;

  constructor() {
    this.loadFonts();
  }

  private loadFonts() {
    try {
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
      this.logger.warn('Polices Roboto non trouvees — fallback StandardFonts + sanitization');
    } catch (err) {
      this.logger.warn(`Erreur chargement polices: ${err.message}`);
    }
  }

  /**
   * Sanitize text for WinAnsi-safe rendering (fallback when Roboto not available).
   * Replaces Unicode chars unsupported by StandardFonts with ASCII equivalents.
   */
  private sanitizeText(text: string): string {
    if (!text) return '';
    return text
      .replace(/≥/g, '>=')
      .replace(/≤/g, '<=')
      .replace(/→/g, '->')
      .replace(/←/g, '<-')
      .replace(/↑/g, '^')
      .replace(/↓/g, 'v')
      .replace(/•/g, '-')
      .replace(/…/g, '...')
      .replace(/–/g, '-')
      .replace(/—/g, '-')
      .replace(/'/g, "'")
      .replace(/'/g, "'")
      .replace(/"/g, '"')
      .replace(/"/g, '"')
      .replace(/\u00a0/g, ' ')
      .replace(/±/g, '+/-')
      .replace(/°/g, 'deg')
      .replace(/µ/g, 'u')
      .replace(/²/g, '2')
      .replace(/³/g, '3')
      .replace(/½/g, '1/2')
      .replace(/¼/g, '1/4')
      .replace(/¾/g, '3/4');
  }

  /**
   * Safe text for PDF rendering: if custom fonts loaded, pass through;
   * if using StandardFonts, sanitize to WinAnsi-safe chars.
   */
  private safeText(text: string, useCustomFonts: boolean): string {
    if (!text) return '';
    return useCustomFonts ? text : this.sanitizeText(text);
  }

  async generateReport(data: ReportData): Promise<Buffer> {
    const doc = await PDFDocument.create();

    let font: PDFFont;
    let boldFont: PDFFont;
    const useCustomFonts = !!(this.regularFontBytes && this.boldFontBytes);

    if (useCustomFonts) {
      doc.registerFontkit(fontkit);
      font = await doc.embedFont(this.regularFontBytes!);
      boldFont = await doc.embedFont(this.boldFontBytes!);
    } else {
      font = await doc.embedFont(StandardFonts.Helvetica);
      boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    }

    let page = doc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    let y = height - 40;
    let pageNum = 1;

    // Helper for new pages
    const addNewPage = () => {
      // Add page number to current page
      page.drawText(`Page ${pageNum}`, {
        x: width - 80, y: 20, size: 8, font, color: rgb(0.5, 0.5, 0.5),
      });
      pageNum++;
      page = doc.addPage([595, 842]);
      y = height - 40;
      return page;
    };

    const checkPageBreak = (needed: number = 80) => {
      if (y < needed) {
        addNewPage();
      }
    };

    // ========== HEADER ==========
    // Blue header bar
    page.drawRectangle({
      x: 0, y: height - 70, width, height: 70,
      color: rgb(0.1, 0.3, 0.6),
    });

    page.drawText('T-Cardio Pro', {
      x: 50, y: height - 35, size: 20, font: boldFont, color: rgb(1, 1, 1),
    });
    page.drawText('Rapport Medical', {
      x: 50, y: height - 55, size: 12, font, color: rgb(0.8, 0.85, 1),
    });

    if (data.reportType) {
      page.drawText(data.reportType, {
        x: width - 150, y: height - 45, size: 10, font: boldFont, color: rgb(1, 1, 1),
      });
    }

    y = height - 90;

    // Generated date
    const sf = (t: string) => this.safeText(t, useCustomFonts);
    page.drawText(sf(`Genere le: ${new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })}`), {
      x: 50, y, size: 9, font, color: rgb(0.5, 0.5, 0.5),
    });
    y -= 25;

    // ========== PATIENT INFO ==========
    // Section separator
    page.drawRectangle({ x: 50, y: y + 5, width: width - 100, height: 1, color: rgb(0.85, 0.85, 0.85) });
    y -= 5;

    page.drawText('Identite Patient', { x: 50, y, size: 13, font: boldFont, color: rgb(0.1, 0.3, 0.6) });
    y -= 18;
    page.drawText(sf(`Nom: ${data.patientName}`), { x: 50, y, size: 10, font });
    y -= 14;
    page.drawText(sf(`Age: ${data.patientAge ? data.patientAge + ' ans' : 'Non renseigne'}`), { x: 50, y, size: 10, font });
    y -= 14;

    const periodStartFr = new Date(data.periodStart).toLocaleDateString('fr-FR');
    const periodEndFr = new Date(data.periodEnd).toLocaleDateString('fr-FR');
    page.drawText(sf(`Periode: ${periodStartFr} au ${periodEndFr}`), { x: 50, y, size: 10, font });
    y -= 25;

    // ========== STATISTICS ==========
    page.drawRectangle({ x: 50, y: y + 5, width: width - 100, height: 1, color: rgb(0.85, 0.85, 0.85) });
    y -= 5;

    page.drawText('Statistiques', { x: 50, y, size: 13, font: boldFont, color: rgb(0.1, 0.3, 0.6) });
    y -= 18;
    page.drawText(`Nombre de mesures: ${data.stats.count}`, { x: 50, y, size: 10, font });
    y -= 14;
    page.drawText(`Tension systolique moyenne: ${data.stats.systolicAvg} mmHg`, { x: 50, y, size: 10, font });
    y -= 14;
    page.drawText(`Tension diastolique moyenne: ${data.stats.diastolicAvg} mmHg`, { x: 50, y, size: 10, font });
    y -= 14;
    if (data.riskLevel) {
      const riskColors: Record<string, [number, number, number]> = {
        FAIBLE: [0.1, 0.6, 0.2],
        MODERE: [0.8, 0.6, 0],
        ELEVE: [0.8, 0.2, 0.1],
        CRITIQUE: [0.7, 0, 0],
      };
      const rColor = riskColors[data.riskLevel] || [0.3, 0.3, 0.3];
      page.drawText(sf(`Niveau de risque IA: ${data.riskLevel}`), {
        x: 50, y, size: 10, font: boldFont, color: rgb(rColor[0], rColor[1], rColor[2]),
      });
      y -= 14;
    }
    y -= 15;

    // ========== MINI BAR CHART (systolic values) ==========
    if (data.measurements.length > 0) {
      checkPageBreak(120);
      page.drawRectangle({ x: 50, y: y + 5, width: width - 100, height: 1, color: rgb(0.85, 0.85, 0.85) });
      y -= 5;
      page.drawText('Tendance de Tension (derniers releves)', { x: 50, y, size: 13, font: boldFont, color: rgb(0.1, 0.3, 0.6) });
      y -= 25;

      // Draw simple horizontal bar chart for last 10 measurements
      const chartMeasurements = data.measurements.slice(-10);
      const maxSys = Math.max(...chartMeasurements.map(m => m.systolic), 180);
      const barHeight = 8;
      const barMaxWidth = 300;

      for (const m of chartMeasurements) {
        if (y < 100) break;
        const barWidth = (m.systolic / maxSys) * barMaxWidth;
        const barColor = m.systolic >= 140 ? rgb(0.8, 0.2, 0.1) : m.systolic >= 120 ? rgb(0.9, 0.6, 0.1) : rgb(0.2, 0.6, 0.3);

        // Date label
        const dateStr = new Date(m.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        page.drawText(dateStr, { x: 50, y: y - 1, size: 7, font, color: rgb(0.4, 0.4, 0.4) });

        // Bar
        page.drawRectangle({ x: 100, y: y - 2, width: barWidth, height: barHeight, color: barColor });

        // Value
        page.drawText(`${m.systolic}/${m.diastolic}`, {
          x: 105 + barWidth, y: y - 1, size: 7, font, color: rgb(0.3, 0.3, 0.3),
        });

        y -= 14;
      }
      y -= 10;
    }

    // ========== MEASUREMENTS TABLE ==========
    if (data.measurements.length > 0) {
      checkPageBreak(100);
      page.drawRectangle({ x: 50, y: y + 5, width: width - 100, height: 1, color: rgb(0.85, 0.85, 0.85) });
      y -= 5;
      page.drawText('Dernieres Mesures', { x: 50, y, size: 13, font: boldFont, color: rgb(0.1, 0.3, 0.6) });
      y -= 20;

      // Table header
      const cols = [50, 160, 240, 320, 400];
      const headers = ['Date', 'Systolique', 'Diastolique', 'Pouls', 'Risque'];

      page.drawRectangle({ x: 45, y: y - 4, width: width - 90, height: 18, color: rgb(0.93, 0.93, 0.95) });
      headers.forEach((h, i) => {
        page.drawText(h, { x: cols[i], y, size: 8, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
      });
      y -= 18;

      // Table rows (last 10)
      const tableRows = data.measurements.slice(-10);
      tableRows.forEach((m, idx) => {
        checkPageBreak(30);

        // Alternating row bg
        if (idx % 2 === 0) {
          page.drawRectangle({ x: 45, y: y - 4, width: width - 90, height: 16, color: rgb(0.97, 0.97, 0.99) });
        }

        const dateStr = new Date(m.date).toLocaleDateString('fr-FR', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        });
        page.drawText(dateStr, { x: cols[0], y, size: 8, font });
        page.drawText(`${m.systolic} mmHg`, { x: cols[1], y, size: 8, font });
        page.drawText(`${m.diastolic} mmHg`, { x: cols[2], y, size: 8, font });
        page.drawText(m.pulse ? `${m.pulse} bpm` : '-', { x: cols[3], y, size: 8, font });

        // Risk indicator based on values
        let risk = 'Normal';
        let rColor = rgb(0.2, 0.6, 0.3);
        if (m.systolic >= 180 || m.diastolic >= 120) { risk = 'Critique'; rColor = rgb(0.7, 0, 0); }
        else if (m.systolic >= 140 || m.diastolic >= 90) { risk = 'Eleve'; rColor = rgb(0.8, 0.2, 0.1); }
        else if (m.systolic >= 120 || m.diastolic >= 80) { risk = 'Modere'; rColor = rgb(0.8, 0.6, 0); }

        page.drawText(risk, { x: cols[4], y, size: 8, font, color: rColor });
        y -= 16;
      });
      y -= 15;
    }

    // ========== AI SUMMARIES ==========
    if (data.aiSummaryDoctor) {
      checkPageBreak(80);
      page.drawRectangle({ x: 50, y: y + 5, width: width - 100, height: 1, color: rgb(0.85, 0.85, 0.85) });
      y -= 5;
      page.drawText('Synthese IA (Medecin)', { x: 50, y, size: 13, font: boldFont, color: rgb(0.1, 0.3, 0.6) });
      y -= 18;
      const lines = this.wrapText(sf(data.aiSummaryDoctor), 85);
      for (const line of lines) {
        checkPageBreak(30);
        page.drawText(line, { x: 50, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
        y -= 13;
      }
      y -= 15;
    }

    if (data.aiSummaryPatient) {
      checkPageBreak(80);
      page.drawRectangle({ x: 50, y: y + 5, width: width - 100, height: 1, color: rgb(0.85, 0.85, 0.85) });
      y -= 5;
      page.drawText('Synthese IA (Patient)', { x: 50, y, size: 13, font: boldFont, color: rgb(0.1, 0.3, 0.6) });
      y -= 18;
      const lines = this.wrapText(sf(data.aiSummaryPatient), 85);
      for (const line of lines) {
        checkPageBreak(30);
        page.drawText(line, { x: 50, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
        y -= 13;
      }
      y -= 15;
    }

    // ========== DOCTOR NOTES ==========
    if (data.doctorNotes) {
      checkPageBreak(80);
      page.drawRectangle({ x: 50, y: y + 5, width: width - 100, height: 1, color: rgb(0.85, 0.85, 0.85) });
      y -= 5;
      page.drawText('Notes du Medecin', { x: 50, y, size: 13, font: boldFont, color: rgb(0.1, 0.3, 0.6) });
      y -= 18;
      const lines = this.wrapText(sf(data.doctorNotes), 85);
      for (const line of lines) {
        checkPageBreak(30);
        page.drawText(line, { x: 50, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
        y -= 13;
      }
    }

    // ========== FOOTER on last page ==========
    page.drawRectangle({ x: 50, y: 45, width: width - 100, height: 1, color: rgb(0.85, 0.85, 0.85) });
    page.drawText(
      'Ce rapport est genere automatiquement par T-Cardio Pro. Il ne remplace pas une consultation medicale.',
      { x: 50, y: 30, size: 7, font, color: rgb(0.5, 0.5, 0.5) },
    );
    page.drawText(`Page ${pageNum}`, {
      x: width - 80, y: 20, size: 8, font, color: rgb(0.5, 0.5, 0.5),
    });

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }

  async addSignature(pdfBuffer: Buffer, doctorName: string, signedAt: Date): Promise<Buffer> {
    const doc = await PDFDocument.load(pdfBuffer);

    let font: PDFFont;
    let boldFont: PDFFont;
    const useCustomFonts = !!(this.regularFontBytes && this.boldFontBytes);

    if (useCustomFonts) {
      doc.registerFontkit(fontkit);
      font = await doc.embedFont(this.regularFontBytes!);
      boldFont = await doc.embedFont(this.boldFontBytes!);
    } else {
      font = await doc.embedFont(StandardFonts.Helvetica);
      boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    }

    const sf = (t: string) => this.safeText(t, useCustomFonts);
    const pages = doc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width } = lastPage.getSize();

    const signDateStr = signedAt.toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    // Draw signature box
    const boxY = 55;
    lastPage.drawRectangle({
      x: width - 260, y: boxY, width: 220, height: 45,
      borderColor: rgb(0.1, 0.3, 0.6), borderWidth: 1,
      color: rgb(0.95, 0.97, 1),
    });

    lastPage.drawText(sf('Signe electroniquement par:'), {
      x: width - 250, y: boxY + 32, size: 7, font, color: rgb(0.4, 0.4, 0.4),
    });

    lastPage.drawText(sf(doctorName), {
      x: width - 250, y: boxY + 18, size: 10, font: boldFont, color: rgb(0.1, 0.3, 0.6),
    });

    lastPage.drawText(sf(`Le ${signDateStr}`), {
      x: width - 250, y: boxY + 5, size: 7, font, color: rgb(0.4, 0.4, 0.4),
    });

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Generate a complete medical file PDF with all patient data.
   */
  async generateCompleteMedicalFile(data: {
    patientName: string;
    patientAge: number | null;
    patientEmail?: string;
    patientGender?: string;
    patientHeight?: number | null;
    patientWeight?: number | null;
    medicalStatus?: string;
    generatedAt: string;
    measurements: Array<{ date: string; systolic: number; diastolic: number; pulse?: number; context?: string; riskLevel?: string }>;
    stats: { systolicAvg: number; diastolicAvg: number; count: number };
    teleconsultations: Array<{ date: string; status: string; reason?: string; summary?: string; doctorName: string }>;
    medications: Array<{ name: string; dosage?: string; frequency?: string; startDate: string; endDate?: string; isActive: boolean }>;
    examResults: Array<{ type: string; title?: string; date: string; notes?: string; doctorComment?: string }>;
    riskScores: Array<{ score: number; riskLevel: string; algorithm: string; date: string }>;
    prescriptions: Array<{ date: string; medications: any; doctorName: string; notes?: string }>;
    aiSummary?: string;
    riskLevel?: string;
  }): Promise<Buffer> {
    const doc = await PDFDocument.create();

    let font: PDFFont;
    let boldFont: PDFFont;
    const useCustomFonts = !!(this.regularFontBytes && this.boldFontBytes);

    if (useCustomFonts) {
      doc.registerFontkit(fontkit);
      font = await doc.embedFont(this.regularFontBytes!);
      boldFont = await doc.embedFont(this.boldFontBytes!);
    } else {
      font = await doc.embedFont(StandardFonts.Helvetica);
      boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    }

    const sf = (t: string) => this.safeText(t, useCustomFonts);
    const W = 595;
    const H = 842;
    let page = doc.addPage([W, H]);
    let y = H - 40;
    let pageNum = 1;

    const addNewPage = () => {
      page.drawText(`Page ${pageNum}`, { x: W - 80, y: 20, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
      pageNum++;
      page = doc.addPage([W, H]);
      y = H - 40;
      return page;
    };

    const checkBreak = (needed = 80) => { if (y < needed) addNewPage(); };

    const drawSectionTitle = (title: string) => {
      checkBreak(60);
      page.drawRectangle({ x: 50, y: y + 5, width: W - 100, height: 1, color: rgb(0.85, 0.85, 0.85) });
      y -= 5;
      page.drawText(sf(title), { x: 50, y, size: 13, font: boldFont, color: rgb(0.1, 0.3, 0.6) });
      y -= 20;
    };

    const drawLine = (label: string, value: string) => {
      checkBreak(20);
      page.drawText(sf(`${label}: ${value}`), { x: 50, y, size: 10, font });
      y -= 14;
    };

    const drawWrapped = (text: string) => {
      const lines = this.wrapText(sf(text), 85);
      for (const line of lines) {
        checkBreak(20);
        page.drawText(line, { x: 50, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
        y -= 13;
      }
    };

    // ========== HEADER ==========
    page.drawRectangle({ x: 0, y: H - 80, width: W, height: 80, color: rgb(0.1, 0.3, 0.6) });
    page.drawText('T-Cardio Pro', { x: 50, y: H - 35, size: 22, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText(sf('Dossier Medical Complet'), { x: 50, y: H - 55, size: 14, font, color: rgb(0.8, 0.85, 1) });
    page.drawText(sf(`Genere le ${new Date(data.generatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`), {
      x: 50, y: H - 72, size: 9, font, color: rgb(0.7, 0.75, 0.9),
    });
    y = H - 100;

    // ========== PATIENT IDENTITY ==========
    drawSectionTitle('Identite du Patient');
    drawLine('Nom', data.patientName);
    if (data.patientAge) drawLine('Age', `${data.patientAge} ans`);
    if (data.patientGender) drawLine('Genre', data.patientGender === 'MALE' ? 'Homme' : data.patientGender === 'FEMALE' ? 'Femme' : data.patientGender);
    if (data.patientEmail) drawLine('Email', data.patientEmail);
    if (data.patientHeight) drawLine('Taille', `${data.patientHeight} cm`);
    if (data.patientWeight) drawLine('Poids', `${data.patientWeight} kg`);
    if (data.patientHeight && data.patientWeight) {
      const bmi = data.patientWeight / Math.pow(data.patientHeight / 100, 2);
      drawLine('IMC', bmi.toFixed(1));
    }
    if (data.medicalStatus) drawLine('Statut medical', data.medicalStatus);
    y -= 10;

    // ========== AI SUMMARY ==========
    if (data.aiSummary) {
      drawSectionTitle('Synthese IA');
      if (data.riskLevel) {
        const rColors: Record<string, [number, number, number]> = {
          FAIBLE: [0.1, 0.6, 0.2], MODERE: [0.8, 0.6, 0], ELEVE: [0.8, 0.2, 0.1], CRITIQUE: [0.7, 0, 0],
        };
        const rc = rColors[data.riskLevel] || [0.3, 0.3, 0.3];
        page.drawText(sf(`Niveau de risque: ${data.riskLevel}`), { x: 50, y, size: 10, font: boldFont, color: rgb(rc[0], rc[1], rc[2]) });
        y -= 16;
      }
      drawWrapped(data.aiSummary);
      y -= 10;
    }

    // ========== MEASUREMENTS ==========
    if (data.measurements.length > 0) {
      drawSectionTitle(`Mesures Tensionnelles (${data.stats.count} mesures)`);
      drawLine('Systolique moyenne', `${data.stats.systolicAvg} mmHg`);
      drawLine('Diastolique moyenne', `${data.stats.diastolicAvg} mmHg`);
      y -= 10;

      // Table header
      const cols = [50, 155, 225, 295, 355, 420];
      const headers = ['Date', 'Systolique', 'Diastolique', 'Pouls', 'Contexte', 'Risque'];
      checkBreak(30);
      page.drawRectangle({ x: 45, y: y - 4, width: W - 90, height: 18, color: rgb(0.93, 0.93, 0.95) });
      headers.forEach((h, i) => page.drawText(h, { x: cols[i], y, size: 7, font: boldFont, color: rgb(0.3, 0.3, 0.3) }));
      y -= 18;

      const rows = data.measurements.slice(0, 50);
      rows.forEach((m, idx) => {
        checkBreak(20);
        if (idx % 2 === 0) page.drawRectangle({ x: 45, y: y - 4, width: W - 90, height: 14, color: rgb(0.97, 0.97, 0.99) });
        const d = new Date(m.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
        page.drawText(d, { x: cols[0], y, size: 7, font });
        page.drawText(`${m.systolic}`, { x: cols[1], y, size: 7, font });
        page.drawText(`${m.diastolic}`, { x: cols[2], y, size: 7, font });
        page.drawText(m.pulse ? `${m.pulse}` : '-', { x: cols[3], y, size: 7, font });
        page.drawText(sf(m.context || '-'), { x: cols[4], y, size: 7, font });
        const rl = m.riskLevel || '-';
        const rlColor = rl === 'ELEVE' || rl === 'CRITIQUE' ? rgb(0.8, 0.1, 0.1) : rl === 'MODERE' ? rgb(0.8, 0.6, 0) : rgb(0.3, 0.3, 0.3);
        page.drawText(sf(rl), { x: cols[5], y, size: 7, font, color: rlColor });
        y -= 14;
      });
      if (data.measurements.length > 50) {
        y -= 5;
        page.drawText(sf(`... et ${data.measurements.length - 50} mesures supplementaires`), { x: 50, y, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
        y -= 14;
      }
      y -= 10;
    }

    // ========== MEDICATIONS ==========
    if (data.medications.length > 0) {
      drawSectionTitle(`Traitements (${data.medications.length})`);
      for (const med of data.medications) {
        checkBreak(40);
        const status = med.isActive ? '[Actif]' : '[Termine]';
        const statusColor = med.isActive ? rgb(0.1, 0.6, 0.2) : rgb(0.5, 0.5, 0.5);
        page.drawText(sf(`${med.name} ${status}`), { x: 50, y, size: 10, font: boldFont, color: statusColor });
        y -= 14;
        const details: string[] = [];
        if (med.dosage) details.push(`Posologie: ${med.dosage}`);
        if (med.frequency) details.push(`Frequence: ${med.frequency}`);
        details.push(`Debut: ${new Date(med.startDate).toLocaleDateString('fr-FR')}`);
        if (med.endDate) details.push(`Fin: ${new Date(med.endDate).toLocaleDateString('fr-FR')}`);
        page.drawText(sf(details.join('  |  ')), { x: 60, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
        y -= 16;
      }
      y -= 5;
    }

    // ========== TELECONSULTATIONS ==========
    if (data.teleconsultations.length > 0) {
      drawSectionTitle(`Teleconsultations (${data.teleconsultations.length})`);
      for (const tc of data.teleconsultations) {
        checkBreak(45);
        const d = new Date(tc.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
        page.drawText(sf(`${d} - ${tc.doctorName} [${tc.status}]`), { x: 50, y, size: 9, font: boldFont });
        y -= 14;
        if (tc.reason) {
          page.drawText(sf(`Motif: ${tc.reason}`), { x: 60, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
          y -= 12;
        }
        if (tc.summary) {
          const lines = this.wrapText(sf(tc.summary), 80);
          for (const line of lines.slice(0, 3)) {
            checkBreak(15);
            page.drawText(line, { x: 60, y, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
            y -= 12;
          }
        }
        y -= 6;
      }
      y -= 5;
    }

    // ========== EXAM RESULTS ==========
    if (data.examResults.length > 0) {
      drawSectionTitle(`Resultats d'Examens (${data.examResults.length})`);
      for (const ex of data.examResults) {
        checkBreak(35);
        const d = new Date(ex.date).toLocaleDateString('fr-FR');
        page.drawText(sf(`${d} - ${ex.type}${ex.title ? ': ' + ex.title : ''}`), { x: 50, y, size: 9, font: boldFont });
        y -= 14;
        if (ex.notes) {
          page.drawText(sf(`Notes: ${ex.notes}`), { x: 60, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
          y -= 12;
        }
        if (ex.doctorComment) {
          page.drawText(sf(`Commentaire medecin: ${ex.doctorComment}`), { x: 60, y, size: 8, font, color: rgb(0.2, 0.4, 0.6) });
          y -= 12;
        }
        y -= 4;
      }
      y -= 5;
    }

    // ========== RISK SCORES ==========
    if (data.riskScores.length > 0) {
      drawSectionTitle('Historique Score de Risque Cardiovasculaire');
      for (const rs of data.riskScores) {
        checkBreak(25);
        const d = new Date(rs.date).toLocaleDateString('fr-FR');
        const rColors: Record<string, [number, number, number]> = {
          FAIBLE: [0.1, 0.6, 0.2], MODERE: [0.8, 0.6, 0], ELEVE: [0.8, 0.2, 0.1], CRITIQUE: [0.7, 0, 0],
        };
        const rc = rColors[rs.riskLevel] || [0.3, 0.3, 0.3];
        page.drawText(sf(`${d} - ${rs.algorithm}: ${rs.score.toFixed(1)}% (${rs.riskLevel})`), {
          x: 50, y, size: 9, font: boldFont, color: rgb(rc[0], rc[1], rc[2]),
        });
        y -= 16;
      }
      y -= 5;
    }

    // ========== PRESCRIPTIONS ==========
    if (data.prescriptions.length > 0) {
      drawSectionTitle(`Ordonnances (${data.prescriptions.length})`);
      for (const p of data.prescriptions) {
        checkBreak(35);
        const d = new Date(p.date).toLocaleDateString('fr-FR');
        page.drawText(sf(`${d} - ${p.doctorName}`), { x: 50, y, size: 9, font: boldFont });
        y -= 14;
        if (p.medications) {
          const medStr = typeof p.medications === 'string' ? p.medications : JSON.stringify(p.medications);
          const lines = this.wrapText(sf(medStr), 80);
          for (const line of lines.slice(0, 3)) {
            checkBreak(15);
            page.drawText(line, { x: 60, y, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
            y -= 12;
          }
        }
        if (p.notes) {
          page.drawText(sf(`Notes: ${p.notes}`), { x: 60, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
          y -= 12;
        }
        y -= 6;
      }
    }

    // ========== FOOTER ==========
    page.drawRectangle({ x: 50, y: 45, width: W - 100, height: 1, color: rgb(0.85, 0.85, 0.85) });
    page.drawText(sf('Ce dossier est genere automatiquement par T-Cardio Pro. Il ne remplace pas une consultation medicale.'), {
      x: 50, y: 30, size: 7, font, color: rgb(0.5, 0.5, 0.5),
    });
    page.drawText(`Page ${pageNum}`, { x: W - 80, y: 20, size: 8, font, color: rgb(0.5, 0.5, 0.5) });

    const pdfBytes = await doc.save();
    return Buffer.from(pdfBytes);
  }

  private wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      if ((current + ' ' + word).length > maxChars) {
        lines.push(current.trim());
        current = word;
      } else {
        current += ' ' + word;
      }
    }
    if (current.trim()) lines.push(current.trim());
    return lines;
  }
}
