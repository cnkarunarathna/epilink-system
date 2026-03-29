import axios from "axios";
import { ACCESS_TOKEN_KEY } from "@/lib/tokenUtils";

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_BASE = RAW_BASE.endsWith("/api") ? RAW_BASE : `${RAW_BASE}/api`;

function getAuthHeaders() {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem(ACCESS_TOKEN_KEY)
      : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface DistrictLatest {
  district: string;
  predicted_cases: number;
  year: number;
  week: number;
  latitude: number;
  longitude: number;
  temperature: number | null;
  precipitation: number | null;
}

export async function fetchLatestPerDistrict(): Promise<DistrictLatest[]> {
  const res = await axios.get(`${API_BASE}/analytics/districts/latest`, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function fetchTimeseries(district: string) {
  const res = await axios.get(
    `${API_BASE}/analytics/districts/${encodeURIComponent(district)}/timeseries`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function fetchBulkPredictions() {
  const res = await axios.get(`${API_BASE}/analytics/predict/bulk`, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function fetchDashboardSummary() {
  const res = await axios.get(`${API_BASE}/analytics/summary`, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function fetchTrends(weeks: number = 12) {
  const res = await axios.get(`${API_BASE}/analytics/trends?weeks=${weeks}`, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function fetchHistoricalRange(
  startYear?: number,
  startWeek?: number,
  endYear?: number,
  endWeek?: number,
) {
  const params = new URLSearchParams();
  if (startYear) params.append("startYear", startYear.toString());
  if (startWeek) params.append("startWeek", startWeek.toString());
  if (endYear) params.append("endYear", endYear.toString());
  if (endWeek) params.append("endWeek", endWeek.toString());

  const res = await axios.get(
    `${API_BASE}/analytics/historical/range?${params.toString()}`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function fetchCompareDistricts(districts?: string[]) {
  const params =
    districts && districts.length > 0
      ? `?districts=${districts.join(",")}`
      : "";
  const res = await axios.get(
    `${API_BASE}/analytics/historical/districts/compare${params}`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function fetchYearlySummary(year?: number) {
  const params = year ? `?year=${year}` : "";
  const res = await axios.get(
    `${API_BASE}/analytics/historical/yearly-summary${params}`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function fetchWeatherCorrelation() {
  const res = await axios.get(
    `${API_BASE}/analytics/advanced/weather-correlation`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function fetchGrowthRate(weeks: number = 4) {
  const res = await axios.get(
    `${API_BASE}/analytics/advanced/growth-rate?weeks=${weeks}`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function fetchHotspots() {
  const res = await axios.get(`${API_BASE}/analytics/advanced/hotspots`, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function fetchOutbreakAlerts() {
  const res = await axios.get(
    `${API_BASE}/analytics/advanced/outbreak-alerts`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function fetchWeeklyForecast() {
  const res = await axios.get(
    `${API_BASE}/analytics/advanced/weekly-forecast`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export interface DocumentReference {
  title: string;
  source: string;
  published_date: string | null;
  excerpt: string;
  relevance_score: number | null;
}

export interface ExplainInsightResponse {
  district: string;
  risk_level: "low" | "moderate" | "high" | "critical";
  summary: string;
  key_drivers: string[];
  recommendations: string[];
  caveats: string[];
  references: string[];
  document_references?: DocumentReference[];
  implementation_phase: string;
  /** @deprecated Use data_completeness_score instead */
  confidence_score: number;
  // ── Enhancement 6: split confidence into two distinct dimensions ──
  /** Signal completeness (0-100): 30 base + 12 pts per filled optional field */
  data_completeness_score?: number;
  /** Model certainty (0-100) from ensemble uncertainty interval width */
  prediction_confidence?: number;
  /** True when the latest surveillance data is more than 7 days old */
  data_freshness_warning?: boolean;
  // ── Enhancement 5 ─────────────────────────────────────────────────
  /** True when a high-burden neighbour or 3+ rising neighbours detected */
  spillover_risk?: boolean;
  trend_direction: "rising" | "falling" | "stable";
  follow_up_answer?: string | null;
  _fallback?: boolean;
  _error?: string;
  error?: string;
}

// ── Enhancement 3: National Summary & Batch ────────────────────────

export interface DistrictHighlight {
  district: string;
  risk_level: "low" | "moderate" | "high" | "critical";
  recent_case_count: number;
  wow_pct: number | null;
  trend: "rising" | "falling" | "stable";
  is_urgent: boolean;
}

export interface NationalSummaryResponse {
  situation_report: string;
  urgent_districts: string[];
  district_highlights: DistrictHighlight[];
  total_districts_analysed: number;
  total_national_cases: number;
  by_risk_level: Record<string, number>;
  prediction_week: string | null;
  generated_at: string;
  implementation_phase: string;
  _error?: string;
}

export interface BatchExplainResult extends ExplainInsightResponse {}

export interface BatchExplainResponse {
  results: BatchExplainResult[];
  total: number;
  urgent_districts: string[];
  by_risk_level: Record<string, number>;
  prediction_week: string | null;
  generated_at: string;
  error?: string;
}

// ── Enhancement 2: RAG Corpus Management ──────────────────────────

export interface RagStatus {
  rag_enabled: boolean;
  pgvector_configured: boolean;
  embedding_model: string | null;
  top_k: number;
  document_count: number;
  _error?: string;
}

export interface RagIngestDocument {
  title: string;
  source: string;
  published_date?: string | null;
  content: string;
}

export interface RagIngestResponse {
  ingested: number;
  message: string;
  error?: string;
}

export async function fetchExplainableInsight(
  district: string,
): Promise<ExplainInsightResponse> {
  const res = await axios.get(
    `${API_BASE}/analytics/explain/${encodeURIComponent(district)}`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function fetchExplainFollowUp(
  district: string,
  question: string,
): Promise<ExplainInsightResponse> {
  const res = await axios.get(
    `${API_BASE}/analytics/explain/${encodeURIComponent(district)}/ask?question=${encodeURIComponent(question)}`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

// ── Chat (Phase 3 + Enhancement 7) ────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tool_calls?: string[];
}

export interface ChatResponse {
  reply: string;
  tool_calls_used: string[];
  session_id: string;
  /** Total user turns stored in the session (Enhancement 7) */
  turn_count?: number;
  /** True when older messages were compressed in this cycle (Enhancement 7) */
  context_compressed?: boolean;
}

/** Enhancement 7: full session history returned by the history endpoint */
export interface ChatSessionHistoryResponse {
  session_id: string;
  messages: ChatMessage[];
  message_count: number;
  turn_count: number;
}

/**
 * Send a single new user message to the agentic chat.
 * Enhancement 7: only the new message text + session_id are sent;
 * full history is managed server-side in Redis.
 */
export async function chatWithAgent(
  district: string,
  message: string,
  sessionId?: string,
): Promise<ChatResponse> {
  const res = await axios.post(
    `${API_BASE}/analytics/explain/${encodeURIComponent(district)}/chat`,
    { message, sessionId },
    { headers: getAuthHeaders() },
  );
  return res.data;
}

/** Enhancement 7: retrieve all stored messages for a session. */
export async function getChatHistory(
  sessionId: string,
): Promise<ChatSessionHistoryResponse> {
  const res = await axios.get(
    `${API_BASE}/analytics/chat/${encodeURIComponent(sessionId)}/history`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

/** Enhancement 7: explicitly end a session and remove its Redis key. */
export async function deleteChatSession(
  sessionId: string,
): Promise<{ session_id: string; deleted: boolean; message: string }> {
  const res = await axios.delete(
    `${API_BASE}/analytics/chat/${encodeURIComponent(sessionId)}`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

// ── Enhancement 3: National Summary & Batch Explain ───────────────

export async function fetchNationalSummary(
  week?: string,
): Promise<NationalSummaryResponse> {
  const params = week ? `?week=${encodeURIComponent(week)}` : "";
  const res = await axios.get(
    `${API_BASE}/analytics/national-summary${params}`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function batchExplain(
  requests: ExplainInsightResponse[],
): Promise<BatchExplainResponse> {
  const res = await axios.post(
    `${API_BASE}/analytics/batch-explain`,
    { requests },
    { headers: getAuthHeaders(), timeout: 120000 },
  );
  return res.data;
}

// ── Enhancement 2: RAG Corpus Management ─────────────────────────

export async function fetchRagStatus(): Promise<RagStatus> {
  const res = await axios.get(`${API_BASE}/analytics/rag/status`, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function ingestRagDocuments(
  documents: RagIngestDocument[],
): Promise<RagIngestResponse> {
  const res = await axios.post(
    `${API_BASE}/analytics/rag/ingest`,
    { documents },
    { headers: getAuthHeaders(), timeout: 300000 },
  );
  return res.data;
}

// ── Enhancement 4: Direct tool endpoints ──────────────────────────

export interface SeasonalPatternResponse {
  district: string;
  years_analysed: number;
  weekly_averages: Record<string, number>;
  peak_weeks: number[];
  peak_season_windows: { start_week: number; end_week: number }[];
  absolute_peak_week: number | null;
  absolute_peak_avg_cases: number;
  current_week: number;
  current_cases: number;
  seasonal_baseline_this_week: number;
  vs_baseline_pct: number | null;
  in_peak_season: boolean;
  narrative: string;
  error?: string;
}

export interface SpilloverNeighbour {
  district: string;
  is_focal: boolean;
  current_cases: number;
  wow_change_pct: number | null;
  risk_level: string;
  is_rising: boolean;
}

export interface SpilloverResponse {
  focal_district: string;
  focal_stats: SpilloverNeighbour | null;
  neighbours: SpilloverNeighbour[];
  rising_neighbours: SpilloverNeighbour[];
  high_risk_neighbours: SpilloverNeighbour[];
  spillover_risk: "low" | "moderate" | "high";
  narrative: string;
  adjacency_known: boolean;
  error?: string;
}

export interface ResponseEvent {
  peak_year: number;
  peak_week: number;
  peak_cases: number;
  trough_year: number;
  trough_week: number;
  trough_cases: number;
  decline_pct: number;
  weeks_to_recovery: number;
  response_effectiveness: "rapid" | "moderate" | "slow";
  inferred_action: string;
}

export interface InterventionHistoryResponse {
  district: string;
  response_events: ResponseEvent[];
  total_events_detected: number;
  average_weeks_to_recovery: number | null;
  most_recent_event: ResponseEvent | null;
  narrative: string;
  data_note: string;
  error?: string;
}

export interface ModelPerformanceResponse {
  district: string;
  actual_week: string | null;
  actual_cases: number;
  predicted_cases: number | null;
  prediction_week: string | null;
  absolute_error: number | null;
  percentage_error_pct: number | null;
  accuracy_class: "excellent" | "good" | "moderate" | "poor" | "unavailable";
  observed_trend: string;
  naive_persistence_mae_8w: number | null;
  narrative: string;
  error?: string;
}

export interface ZoneHotspot {
  zone: string;
  type: string;
  relative_risk: "high" | "moderate" | "low";
  estimated_cases: number;
  context_flags: string[];
  intervention_priority: "immediate" | "high" | "moderate" | "routine";
}

export interface DemographicHotspotsResponse {
  district: string;
  total_district_cases: number;
  district_risk_level: string;
  zone_breakdown: ZoneHotspot[];
  top_priority_zones: string[];
  temperature_c: number | null;
  precipitation_mm: number | null;
  narrative: string;
  data_note: string;
  error?: string;
}

export async function fetchSeasonalPattern(
  district: string,
  years?: number,
): Promise<SeasonalPatternResponse> {
  const q = years ? `?years=${years}` : "";
  const res = await axios.get(
    `${API_BASE}/analytics/tools/seasonal-pattern/${encodeURIComponent(district)}${q}`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function fetchSpilloverRisk(
  district: string,
): Promise<SpilloverResponse> {
  const res = await axios.get(
    `${API_BASE}/analytics/tools/spillover/${encodeURIComponent(district)}`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function fetchInterventionHistory(
  district: string,
): Promise<InterventionHistoryResponse> {
  const res = await axios.get(
    `${API_BASE}/analytics/tools/intervention-history/${encodeURIComponent(district)}`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function fetchModelPerformance(
  district: string,
): Promise<ModelPerformanceResponse> {
  const res = await axios.get(
    `${API_BASE}/analytics/tools/model-performance/${encodeURIComponent(district)}`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}

export async function fetchDemographicHotspots(
  district: string,
): Promise<DemographicHotspotsResponse> {
  const res = await axios.get(
    `${API_BASE}/analytics/tools/demographic-hotspots/${encodeURIComponent(district)}`,
    { headers: getAuthHeaders() },
  );
  return res.data;
}
