import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMovingAverage(patientId: string, windowDays: number = 7) {
    const measurements = await this.getMeasurements(patientId, 90);
    if (measurements.length === 0) return [];

    const result: Array<{ date: string; avgSystolic: number; avgDiastolic: number }> = [];

    for (let i = windowDays - 1; i < measurements.length; i++) {
      const window = measurements.slice(Math.max(0, i - windowDays + 1), i + 1);
      const avgSys = Math.round(window.reduce((s, m) => s + m.systolic, 0) / window.length);
      const avgDia = Math.round(window.reduce((s, m) => s + m.diastolic, 0) / window.length);
      result.push({
        date: measurements[i].measuredAt.toISOString().split('T')[0],
        avgSystolic: avgSys,
        avgDiastolic: avgDia,
      });
    }
    return result;
  }

  async getVariability(patientId: string, days: number = 30) {
    const measurements = await this.getMeasurements(patientId, days);
    if (measurements.length < 2) return null;

    const systolics = measurements.map((m) => m.systolic);
    const diastolics = measurements.map((m) => m.diastolic);

    return {
      systolic: {
        mean: this.mean(systolics),
        stdDev: this.stdDev(systolics),
        cv: this.coefficientOfVariation(systolics),
      },
      diastolic: {
        mean: this.mean(diastolics),
        stdDev: this.stdDev(diastolics),
        cv: this.coefficientOfVariation(diastolics),
      },
      measurementCount: measurements.length,
    };
  }

  async getMorningEveningComparison(patientId: string, days: number = 30) {
    const measurements = await this.getMeasurements(patientId, days);

    const morning = measurements.filter((m) => {
      const hour = m.measuredAt.getHours();
      return hour >= 5 && hour < 12;
    });

    const evening = measurements.filter((m) => {
      const hour = m.measuredAt.getHours();
      return hour >= 17 && hour < 23;
    });

    return {
      morning: morning.length > 0 ? {
        count: morning.length,
        avgSystolic: this.mean(morning.map((m) => m.systolic)),
        avgDiastolic: this.mean(morning.map((m) => m.diastolic)),
      } : null,
      evening: evening.length > 0 ? {
        count: evening.length,
        avgSystolic: this.mean(evening.map((m) => m.systolic)),
        avgDiastolic: this.mean(evening.map((m) => m.diastolic)),
      } : null,
    };
  }

  async getTrends(patientId: string, days: number = 30) {
    const measurements = await this.getMeasurements(patientId, days);
    if (measurements.length < 3) return null;

    const systolics = measurements.map((m) => m.systolic);
    const diastolics = measurements.map((m) => m.diastolic);
    const pulses = measurements.filter((m) => m.pulse != null).map((m) => m.pulse!);

    const sysTrend = this.calculateTrend(systolics);
    const diaTrend = this.calculateTrend(diastolics);
    const pulseTrend = pulses.length >= 3 ? this.calculateTrend(pulses) : null;

    return {
      systolic: { direction: sysTrend > 0.5 ? 'rising' : sysTrend < -0.5 ? 'falling' : 'stable', slope: sysTrend },
      diastolic: { direction: diaTrend > 0.3 ? 'rising' : diaTrend < -0.3 ? 'falling' : 'stable', slope: diaTrend },
      pulse: pulseTrend !== null ? { direction: pulseTrend > 0.5 ? 'rising' : pulseTrend < -0.5 ? 'falling' : 'stable', slope: pulseTrend } : null,
      period: { days, measurementCount: measurements.length },
    };
  }

  async getChartData(patientId: string, days: number = 30) {
    const measurements = await this.getMeasurements(patientId, days);
    return measurements.map((m) => ({
      date: m.measuredAt.toISOString(),
      systolic: m.systolic,
      diastolic: m.diastolic,
      pulse: m.pulse,
      riskLevel: m.riskLevel,
    }));
  }

  private async getMeasurements(patientId: string, days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return this.prisma.bpMeasurement.findMany({
      where: { patientId, measuredAt: { gte: since } },
      orderBy: { measuredAt: 'asc' },
    });
  }

  private mean(arr: number[]): number {
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }

  private stdDev(arr: number[]): number {
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / arr.length;
    return Math.round(Math.sqrt(variance) * 10) / 10;
  }

  private coefficientOfVariation(arr: number[]): number {
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sd = this.stdDev(arr);
    return Math.round((sd / avg) * 100 * 10) / 10;
  }

  private calculateTrend(values: number[]): number {
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - yMean);
      denominator += (i - xMean) * (i - xMean);
    }
    return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100) / 100;
  }
}
