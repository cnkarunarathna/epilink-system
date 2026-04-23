import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

export interface ForecastRow {
  district: string;
  reported_cases: number | null;
  prior_cases?: number | null;    // historical: prior week actual
  predicted_cases?: number;       // predicted: model output for target week
  avg_4week: number;
  trend: 'Rising' | 'Stable' | 'Falling';
  confidence: 'actual' | 'medium';
}

export interface OutbreakAlert {
  district: string;
  severity: 'critical' | 'high' | 'moderate';
  current_cases?: number;
  message?: string;
  recommendation?: string;
}

export interface ReportPdfData {
  title: string;
  year: number;
  weekNumber: number;
  startDate: string;
  endDate: string;
  reportType: 'historical' | 'predicted';
  /** For predicted: SUM(forecast per district). For historical: SUM(actual_cases). */
  totalPredictedCases: number;
  /** Predicted reports only: SUM(current_cases) = actual recorded cases this week (matches analytics page). */
  totalCurrentCases?: number;
  totalDistricts: number;
  highRiskDistricts: number;
  generatedAt: string;
  approvedBy?: string;
  forecast: ForecastRow[];
  alerts: OutbreakAlert[];
  nationalSummary: string;
}

@Injectable()
export class ReportPdfGenerator {
  private readonly logger = new Logger(ReportPdfGenerator.name);

  async generate(data: ReportPdfData): Promise<Buffer> {
    const html = this.buildHtml(data);

    let browser: puppeteer.Browser | null = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      if (browser) await browser.close();
    }
  }

  private buildHtml(data: ReportPdfData): string {
    const isHistorical = data.reportType === 'historical';
    const primaryVal = (row: ForecastRow) =>
      isHistorical ? (row.reported_cases ?? 0) : (row.predicted_cases ?? 0);
    const top10 = [...data.forecast]
      .sort((a, b) => primaryVal(b) - primaryVal(a))
      .slice(0, 10);
    const maxForecast = Math.max(...top10.map(primaryVal), 1);

    const barChart = this.buildBarChart(top10, maxForecast, isHistorical);
    const forecastTable = this.buildForecastTable(data.forecast, isHistorical);
    const alertCards = this.buildAlertCards(data.alerts);

    const nationalText =
      typeof data.nationalSummary === 'string'
        ? data.nationalSummary
        : (data.nationalSummary as any)?.situation_report ??
          'National summary not available.';

    const generatedDate = new Date(data.generatedAt).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11px;
    color: #1a1a2e;
    background: #fff;
  }

  /* ── Header ─────────────────────────────────── */
  .header {
    background: linear-gradient(135deg, #0f3460 0%, #16213e 100%);
    color: #fff;
    padding: 18px 24px 14px;
    border-bottom: 3px solid #e94560;
  }
  .header-top { display: flex; align-items: center; gap: 14px; }
  .header-logo {
    width: 40px; height: 40px;
    background: #e94560;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 800; color: #fff;
    flex-shrink: 0;
  }
  .header-org { flex: 1; }
  .header-org h1 { font-size: 15px; font-weight: 700; letter-spacing: 0.4px; }
  .header-org p { font-size: 10px; opacity: 0.8; margin-top: 1px; }
  .header-meta {
    text-align: right; font-size: 10px; opacity: 0.85; line-height: 1.6;
  }
  .report-title {
    margin-top: 10px;
    font-size: 13px;
    font-weight: 600;
    opacity: 0.95;
    letter-spacing: 0.2px;
  }

  /* ── Section ─────────────────────────────────── */
  .section {
    padding: 14px 24px 0;
  }
  .section-title {
    font-size: 12px;
    font-weight: 700;
    color: #0f3460;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-bottom: 2px solid #e94560;
    padding-bottom: 4px;
    margin-bottom: 10px;
  }

  /* ── Stats Grid ──────────────────────────────── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    padding: 14px 24px 0;
  }
  .stat-card {
    background: #f8faff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 12px;
    border-top: 3px solid #0f3460;
  }
  .stat-card.red  { border-top-color: #e94560; }
  .stat-card.amber{ border-top-color: #f59e0b; }
  .stat-card.green{ border-top-color: #10b981; }
  .stat-label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.6px; }
  .stat-value { font-size: 22px; font-weight: 800; color: #0f3460; line-height: 1.2; margin-top: 2px; }
  .stat-sub   { font-size: 9px; color: #94a3b8; margin-top: 1px; }

  /* ── Bar Chart ───────────────────────────────── */
  .chart-wrap { padding: 0 24px; margin-top: 14px; }
  .chart-row  { display: flex; align-items: center; margin-bottom: 5px; }
  .chart-label{ width: 90px; font-size: 9.5px; color: #334155; text-align: right; padding-right: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chart-bar-bg { flex: 1; background: #f1f5f9; border-radius: 3px; height: 16px; position: relative; }
  .chart-bar  { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #0f3460, #1a5276); }
  .chart-bar.rising { background: linear-gradient(90deg, #e94560, #c0392b); }
  .chart-bar.stable { background: linear-gradient(90deg, #0f3460, #1a5276); }
  .chart-bar.falling{ background: linear-gradient(90deg, #10b981, #059669); }
  .chart-val  { width: 42px; font-size: 9px; font-weight: 600; color: #475569; text-align: right; padding-left: 5px; }

  /* ── Forecast Table ──────────────────────────── */
  table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  th {
    background: #0f3460;
    color: #fff;
    padding: 5px 8px;
    text-align: left;
    font-weight: 600;
    font-size: 9px;
    letter-spacing: 0.4px;
  }
  th:last-child, td:last-child { text-align: center; }
  td { padding: 4px 8px; border-bottom: 1px solid #f1f5f9; color: #334155; }
  tr:nth-child(even) td { background: #f8faff; }
  tr:hover td { background: #eff6ff; }

  .trend-badge {
    display: inline-flex; align-items: center; gap: 2px;
    padding: 1px 6px; border-radius: 10px; font-size: 8.5px; font-weight: 600;
  }
  .trend-rising  { background: #fee2e2; color: #dc2626; }
  .trend-falling { background: #d1fae5; color: #059669; }
  .trend-stable  { background: #e2e8f0; color: #475569; }

  .risk-badge {
    display: inline-block;
    padding: 1px 6px; border-radius: 10px; font-size: 8px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.3px;
  }
  .risk-high     { background: #fee2e2; color: #dc2626; }
  .risk-moderate { background: #fef3c7; color: #d97706; }
  .risk-low      { background: #d1fae5; color: #059669; }

  /* ── Alerts ──────────────────────────────────── */
  .alert-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 2px; }
  .alert-card {
    border-radius: 6px; padding: 8px 10px;
    border-left: 4px solid #e94560;
  }
  .alert-card.critical{ border-left-color: #dc2626; background: #fff5f5; }
  .alert-card.high    { border-left-color: #f59e0b; background: #fffbeb; }
  .alert-card.moderate{ border-left-color: #3b82f6; background: #eff6ff; }
  .alert-district { font-size: 10px; font-weight: 700; color: #1e293b; }
  .alert-severity { font-size: 8.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 1px; }
  .alert-severity.critical{ color: #dc2626; }
  .alert-severity.high    { color: #d97706; }
  .alert-severity.moderate{ color: #3b82f6; }
  .alert-msg { font-size: 9px; color: #475569; margin-top: 3px; line-height: 1.4; }

  /* ── National Summary ────────────────────────── */
  .summary-box {
    background: #f8faff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 10px;
    line-height: 1.6;
    color: #334155;
    margin-top: 2px;
  }

  /* ── No-data ─────────────────────────────────── */
  .no-data { color: #94a3b8; font-style: italic; font-size: 10px; padding: 8px 0; }

  /* ── Footer ──────────────────────────────────── */
  .footer {
    margin-top: 16px;
    border-top: 1px solid #e2e8f0;
    padding: 8px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8.5px;
    color: #94a3b8;
    background: #f8faff;
  }
  .footer strong { color: #64748b; }

  /* ── Spacer ──────────────────────────────────── */
  .spacer { height: 14px; }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="header-top">
    <div class="header-logo">E</div>
    <div class="header-org">
      <h1>Ministry of Health — Epidemiological Unit</h1>
      <p>EpiLink Dengue Surveillance System</p>
    </div>
    <div class="header-meta">
      <div><strong>Report ID:</strong> WR-${data.year}-W${String(data.weekNumber).padStart(2, '0')}</div>
      <div><strong>Period:</strong> ${data.startDate} to ${data.endDate}</div>
      <div><strong>Generated:</strong> ${generatedDate}</div>
      ${data.approvedBy ? `<div><strong>Approved by:</strong> ${this.escapeHtml(data.approvedBy)}</div>` : ''}
    </div>
  </div>
  <p class="report-title">Weekly Dengue ${isHistorical ? 'Historical' : 'Surveillance &amp; Prediction'} Report — Week ${data.weekNumber}, ${data.year}</p>
</div>

<!-- EXECUTIVE SUMMARY -->
<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-label">${isHistorical ? 'Total Reported Cases' : 'Predicted Cases (Next Week)'}</div>
    <div class="stat-value">${data.totalPredictedCases.toLocaleString()}</div>
    <div class="stat-sub">${isHistorical ? 'Actual recorded' : 'Model forecast'}</div>
  </div>
  ${!isHistorical && data.totalCurrentCases !== undefined ? `
  <div class="stat-card green">
    <div class="stat-label">Current Week (Actual)</div>
    <div class="stat-value">${data.totalCurrentCases.toLocaleString()}</div>
    <div class="stat-sub">Recorded this week</div>
  </div>` : `
  <div class="stat-card green">
    <div class="stat-label">Districts Reporting</div>
    <div class="stat-value">${data.totalDistricts}</div>
    <div class="stat-sub">Of 25 districts</div>
  </div>`}
  <div class="stat-card red">
    <div class="stat-label">High-Risk Districts</div>
    <div class="stat-value">${data.highRiskDistricts}</div>
    <div class="stat-sub">Rising trend</div>
  </div>
  <div class="stat-card amber">
    <div class="stat-label">Active Alerts</div>
    <div class="stat-value">${data.alerts.length}</div>
    <div class="stat-sub">Requiring action</div>
  </div>
</div>

<!-- BAR CHART -->
<div class="chart-wrap">
  <div class="section-title" style="margin-bottom:8px;">Top 10 Districts by ${isHistorical ? 'Reported' : 'Predicted'} Cases</div>
  ${barChart}
</div>

<!-- DISTRICT FORECAST TABLE -->
<div class="section">
  <div class="section-title">${isHistorical ? 'District-wise Historical Case Breakdown' : 'District-wise Forecast Breakdown'}</div>
  ${forecastTable}
</div>

<!-- OUTBREAK ALERTS -->
<div class="section" style="margin-top:12px;">
  <div class="section-title">Active Outbreak Alerts</div>
  ${alertCards}
</div>

<!-- NATIONAL SUMMARY -->
<div class="section" style="margin-top:12px;">
  <div class="section-title">National Situation Summary</div>
  <div class="summary-box">${this.escapeHtml(nationalText)}</div>
</div>

<!-- FOOTER -->
<div class="footer">
  <div>
    <strong>EpiLink</strong> — Dengue Surveillance &amp; Prediction Platform &nbsp;|&nbsp;
    Ministry of Health, Sri Lanka
  </div>
  <div>
    Generated ${generatedDate}
    ${data.approvedBy ? ` &nbsp;|&nbsp; Approved by <strong>${this.escapeHtml(data.approvedBy)}</strong>` : ' &nbsp;|&nbsp; <em>Pending Approval</em>'}
    &nbsp;|&nbsp; <strong>CONFIDENTIAL</strong>
  </div>
</div>

</body>
</html>`;
  }

  private buildBarChart(top10: ForecastRow[], maxForecast: number, isHistorical: boolean): string {
    const noDataLabel = isHistorical ? 'No historical data available.' : 'No forecast data available.';
    if (top10.length === 0) return `<p class="no-data">${noDataLabel}</p>`;

    return top10
      .map((row) => {
        const val = isHistorical ? (row.reported_cases ?? 0) : (row.predicted_cases ?? 0);
        const pct = Math.max(4, Math.round((val / maxForecast) * 100));
        const trendClass = row.trend.toLowerCase();
        return `
        <div class="chart-row">
          <div class="chart-label" title="${this.escapeHtml(row.district)}">${this.escapeHtml(row.district)}</div>
          <div class="chart-bar-bg">
            <div class="chart-bar ${trendClass}" style="width:${pct}%"></div>
          </div>
          <div class="chart-val">${val.toLocaleString()}</div>
        </div>`;
      })
      .join('');
  }

  private buildForecastTable(forecast: ForecastRow[], isHistorical: boolean): string {
    if (forecast.length === 0) return '<p class="no-data">No forecast data available.</p>';

    const primaryVal = (row: ForecastRow) =>
      isHistorical ? (row.reported_cases ?? 0) : (row.predicted_cases ?? 0);
    const secondaryVal = (row: ForecastRow) =>
      isHistorical ? (row.prior_cases ?? null) : (row.reported_cases ?? null);

    const sorted = [...forecast].sort((a, b) => primaryVal(b) - primaryVal(a));

    const rows = sorted
      .map((row) => {
        const trendClass = `trend-${row.trend.toLowerCase()}`;
        const trendIcon =
          row.trend === 'Rising' ? '↑' : row.trend === 'Falling' ? '↓' : '→';
        const pVal = primaryVal(row);
        const sVal = secondaryVal(row);

        const risk =
          row.trend === 'Rising' && pVal > 100
            ? 'high'
            : row.trend === 'Rising'
            ? 'moderate'
            : 'low';
        const riskLabel =
          risk === 'high' ? 'High' : risk === 'moderate' ? 'Moderate' : 'Low';

        return `
        <tr>
          <td style="font-weight:600;">${this.escapeHtml(row.district)}</td>
          <td style="text-align:right;">${pVal.toLocaleString()}</td>
          <td style="text-align:right;font-weight:600;">${sVal !== null ? sVal.toLocaleString() : '—'}</td>
          <td style="text-align:right;">${Math.round(row.avg_4week).toLocaleString()}</td>
          <td>
            <span class="trend-badge ${trendClass}">${trendIcon} ${row.trend}</span>
          </td>
          <td>
            <span class="risk-badge risk-${risk}">${riskLabel}</span>
          </td>
        </tr>`;
      })
      .join('');

    return `
    <table>
      <thead>
        <tr>
          <th>District</th>
          <th style="text-align:right;">${isHistorical ? 'Reported Cases' : 'Current (Actual)'}</th>
          <th style="text-align:right;">${isHistorical ? 'vs Prior Week' : 'Predicted (Next Wk)'}</th>
          <th style="text-align:right;">4-Wk Avg</th>
          <th>Trend</th>
          <th>Risk Level</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  private buildAlertCards(alerts: OutbreakAlert[]): string {
    if (alerts.length === 0) {
      return '<p class="no-data">No active outbreak alerts for this period.</p>';
    }

    const cards = alerts
      .map(
        (alert) => `
      <div class="alert-card ${alert.severity ?? 'moderate'}">
        <div class="alert-district">${this.escapeHtml(alert.district)}</div>
        <div class="alert-severity ${alert.severity ?? 'moderate'}">${(alert.severity ?? 'moderate').toUpperCase()}</div>
        ${alert.message ? `<div class="alert-msg">${this.escapeHtml(alert.message)}</div>` : ''}
        ${alert.recommendation ? `<div class="alert-msg" style="margin-top:2px;font-style:italic;">${this.escapeHtml(alert.recommendation)}</div>` : ''}
      </div>`,
      )
      .join('');

    return `<div class="alert-grid">${cards}</div>`;
  }

  private escapeHtml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
