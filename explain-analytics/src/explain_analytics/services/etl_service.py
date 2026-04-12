from collections import defaultdict
from datetime import date, datetime, timezone

import httpx

from explain_analytics.config import settings
from explain_analytics.models import RagIngestDocument

_TIMEOUT = 20
_SOURCE_LABEL = "epilink-surveillance"


def _classify_risk(cases: int) -> str:
    if cases >= 100:
        return "critical"
    if cases >= 50:
        return "high"
    if cases >= 25:
        return "moderate"
    return "low"


def _week_to_date(year: int, week: int) -> str:
    """Return ISO date string for Monday of the given ISO week."""
    return date.fromisocalendar(year, week, 1).strftime("%Y-%m-%d")


class ETLService:
    """
    Weekly ETL that ingests live surveillance data from the NestJS backend
    into the Qdrant RAG corpus as embeddable district-week documents.

    Deterministic point IDs (keyed on title + source + published_date) ensure
    re-runs on the same week are idempotent upserts, not duplicates.
    """

    def __init__(self, rag_service) -> None:
        self._rag = rag_service
        self._last_run_at: str | None = None
        self._last_run_records: int = 0
        self._last_run_status: str = "never"
        self._last_run_error: str | None = None
        self._next_run_at: str | None = None
        self._is_running: bool = False

    # ── Public interface ────────────────────────────────────────────

    def run(self) -> dict:
        """Fetch all-district surveillance data, embed, and upsert into Qdrant."""
        if self._is_running:
            return {"skipped": True, "reason": "ETL already in progress"}
        if not self._rag.is_ready:
            return {"skipped": True, "reason": "RAG service is not ready"}

        self._is_running = True
        try:
            rows = self._fetch_district_data()
            if not rows:
                raise RuntimeError("No district data returned from backend")

            documents = self._transform(rows)
            upserted = self._rag.ingest(documents)

            self._last_run_at = datetime.now(timezone.utc).isoformat()
            self._last_run_records = upserted
            self._last_run_status = "success"
            self._last_run_error = None
            print(
                f"[ETLService] Upserted {upserted} district-week documents into Qdrant."
            )
            return {"upserted": upserted, "status": "success"}
        except Exception as exc:
            self._last_run_at = datetime.now(timezone.utc).isoformat()
            self._last_run_status = "failed"
            self._last_run_error = str(exc)
            print(f"[ETLService] Run failed: {exc}")
            return {"upserted": 0, "status": "failed", "error": str(exc)}
        finally:
            self._is_running = False

    @property
    def status(self) -> dict:
        return {
            "etl_enabled": settings.rag_etl_enabled,
            "last_run_at": self._last_run_at,
            "last_run_records": self._last_run_records,
            "last_run_status": self._last_run_status,
            "last_run_error": self._last_run_error,
            "next_run_at": self._next_run_at,
            "is_running": self._is_running,
        }

    def set_next_run(self, dt: datetime | None) -> None:
        self._next_run_at = dt.isoformat() if dt else None

    # ── Data fetching ───────────────────────────────────────────────

    def _fetch_district_data(self) -> list[dict]:
        compare_resp = httpx.get(
            f"{settings.backend_api_url}/analytics/historical/districts/compare",
            timeout=_TIMEOUT,
        )
        compare_resp.raise_for_status()
        compare_rows: list[dict] = compare_resp.json()
        if not isinstance(compare_rows, list):
            return []

        weather_by_district: dict[str, dict] = {}
        try:
            latest_resp = httpx.get(
                f"{settings.backend_api_url}/analytics/districts/latest",
                timeout=_TIMEOUT,
            )
            if latest_resp.status_code == 200:
                for row in latest_resp.json():
                    weather_by_district[row.get("district", "")] = row
        except Exception:
            pass

        return self._merge(compare_rows, weather_by_district)

    # ── Data transformation ─────────────────────────────────────────

    def _merge(self, compare_rows: list[dict], weather: dict[str, dict]) -> list[dict]:
        district_rows: dict[str, list[dict]] = defaultdict(list)
        for row in compare_rows:
            district_rows[row.get("district", "Unknown")].append(row)

        merged: list[dict] = []
        for district, rows in district_rows.items():
            rows.sort(key=lambda r: (r.get("year", 0), r.get("week", 0)))
            latest = rows[-1]
            cases = latest.get("cases", 0) or 0
            week = latest.get("week", 0)
            year = latest.get("year", 0)

            wow: float | None = None
            if len(rows) >= 2:
                prev = rows[-2].get("cases", 0) or 0
                if prev > 0:
                    wow = round(((cases - prev) / prev) * 100, 1)

            w = weather.get(district, {})
            merged.append(
                {
                    "district": district,
                    "cases": cases,
                    "week": week,
                    "year": year,
                    "wow_pct": wow,
                    "temperature": w.get("temperature"),
                    "precipitation": w.get("precipitation"),
                }
            )
        return merged

    def _transform(self, rows: list[dict]) -> list[RagIngestDocument]:
        docs: list[RagIngestDocument] = []
        for row in rows:
            district = row["district"]
            cases = row["cases"]
            week = row["week"]
            year = row["year"]
            wow_pct: float | None = row.get("wow_pct")
            temp: float | None = row.get("temperature")
            precip: float | None = row.get("precipitation")

            risk = _classify_risk(cases)
            wow_str = (
                f"{'+' if wow_pct >= 0 else ''}{wow_pct:.1f}% WoW"
                if wow_pct is not None
                else "WoW N/A"
            )
            temp_str = f"{temp:.1f}°C" if temp is not None else "temp unavailable"
            precip_str = (
                f"{precip:.0f}mm precipitation"
                if precip is not None
                else "precip unavailable"
            )

            content = (
                f"Week {week} {year} | {district} | {cases} cases | "
                f"{wow_str} | {precip_str} | {temp_str}\n"
                f"Risk: {risk}."
            )
            docs.append(
                RagIngestDocument(
                    title=f"Surveillance Week {week} {year} — {district}",
                    source=_SOURCE_LABEL,
                    published_date=_week_to_date(year, week) if week and year else None,
                    content=content,
                )
            )
        return docs
