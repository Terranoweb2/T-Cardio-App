import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

interface BpDataPoint {
  date: string;
  systolic: number;
  diastolic: number;
}

interface BpChartProps {
  data: BpDataPoint[];
  title?: string;
}

/**
 * Simple visual blood pressure chart component.
 * Since react-native-chart-kit is not installed, this renders a bar-style
 * visualization using native Views with systolic (blue) and diastolic (light blue) bars.
 */
export default function BpChart({ data, title = 'Evolution de la tension' }: BpChartProps) {
  if (!data || data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.empty}>Aucune donnee disponible</Text>
      </View>
    );
  }

  // Calculate scale
  const allValues = data.flatMap((d) => [d.systolic, d.diastolic]);
  const maxVal = Math.max(...allValues, 180);
  const minVal = Math.min(...allValues, 50);
  const range = maxVal - minVal || 1;

  // Chart height in points
  const CHART_HEIGHT = 180;

  const getBarHeight = (value: number): number => {
    return Math.max(((value - minVal) / range) * CHART_HEIGHT, 4);
  };

  // Reference lines
  const normalSystolicHigh = 140;
  const normalDiastolicHigh = 90;

  const getLinePosition = (value: number): number => {
    const ratio = (value - minVal) / range;
    return CHART_HEIGHT - ratio * CHART_HEIGHT;
  };

  // Take last 14 data points for readability
  const displayData = data.slice(-14);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#2563eb' }]} />
          <Text style={styles.legendText}>Systolique</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#93c5fd' }]} />
          <Text style={styles.legendText}>Diastolique</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ef444440' }]} />
          <Text style={styles.legendText}>Seuil</Text>
        </View>
      </View>

      <View style={styles.chartWrapper}>
        {/* Y-axis labels */}
        <View style={styles.yAxis}>
          <Text style={styles.yLabel}>{maxVal}</Text>
          <Text style={styles.yLabel}>{Math.round((maxVal + minVal) / 2)}</Text>
          <Text style={styles.yLabel}>{minVal}</Text>
        </View>

        {/* Chart area */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
          <View style={[styles.chartArea, { height: CHART_HEIGHT }]}>
            {/* Reference lines */}
            {normalSystolicHigh >= minVal && normalSystolicHigh <= maxVal && (
              <View style={[
                styles.referenceLine,
                { top: getLinePosition(normalSystolicHigh) },
              ]}>
                <Text style={styles.refLabel}>140</Text>
              </View>
            )}
            {normalDiastolicHigh >= minVal && normalDiastolicHigh <= maxVal && (
              <View style={[
                styles.referenceLine,
                styles.referenceLineDiastolic,
                { top: getLinePosition(normalDiastolicHigh) },
              ]}>
                <Text style={styles.refLabel}>90</Text>
              </View>
            )}

            {/* Bars */}
            <View style={styles.barsContainer}>
              {displayData.map((point, index) => {
                const dateStr = new Date(point.date).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                });
                return (
                  <View key={index} style={styles.barGroup}>
                    <View style={styles.barPair}>
                      {/* Systolic bar */}
                      <View style={styles.barWrapper}>
                        <Text style={styles.barValue}>{point.systolic}</Text>
                        <View
                          style={[
                            styles.bar,
                            styles.systolicBar,
                            { height: getBarHeight(point.systolic) },
                          ]}
                        />
                      </View>
                      {/* Diastolic bar */}
                      <View style={styles.barWrapper}>
                        <Text style={styles.barValue}>{point.diastolic}</Text>
                        <View
                          style={[
                            styles.bar,
                            styles.diastolicBar,
                            { height: getBarHeight(point.diastolic) },
                          ]}
                        />
                      </View>
                    </View>
                    <Text style={styles.xLabel}>{dateStr}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Summary stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Moy. Systolique</Text>
          <Text style={styles.statValue}>
            {Math.round(data.reduce((s, d) => s + d.systolic, 0) / data.length)}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Moy. Diastolique</Text>
          <Text style={styles.statValue}>
            {Math.round(data.reduce((s, d) => s + d.diastolic, 0) / data.length)}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Mesures</Text>
          <Text style={styles.statValue}>{data.length}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  empty: {
    textAlign: 'center',
    color: '#9ca3af',
    paddingVertical: 24,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: '#6b7280',
  },
  chartWrapper: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  yAxis: {
    width: 32,
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  yLabel: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'right',
  },
  chartScroll: {
    flex: 1,
  },
  chartArea: {
    position: 'relative',
    minWidth: '100%',
  },
  referenceLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#ef444440',
    zIndex: 1,
  },
  referenceLineDiastolic: {
    backgroundColor: '#f59e0b40',
  },
  refLabel: {
    position: 'absolute',
    right: 0,
    top: -8,
    fontSize: 9,
    color: '#ef4444',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
    paddingTop: 16,
    gap: 4,
  },
  barGroup: {
    alignItems: 'center',
    minWidth: 40,
  },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  barWrapper: {
    alignItems: 'center',
  },
  barValue: {
    fontSize: 8,
    color: '#6b7280',
    marginBottom: 2,
  },
  bar: {
    width: 14,
    borderRadius: 4,
    minHeight: 4,
  },
  systolicBar: {
    backgroundColor: '#2563eb',
  },
  diastolicBar: {
    backgroundColor: '#93c5fd',
  },
  xLabel: {
    fontSize: 9,
    color: '#9ca3af',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563eb',
  },
});
