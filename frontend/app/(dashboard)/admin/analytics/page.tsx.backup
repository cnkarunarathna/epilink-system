"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart3,
  RefreshCw,
  Loader2,
  AlertCircle,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import SriLankaMap from "@/components/dashboard/maps/SriLankaMap";
import dengueService, { BulkPredictionInput } from "@/services/dengue.service";

interface DistrictPrediction {
  district: string;
  predicted_cases: number;
}

export default function AnalyticsPage() {
  const [predictions, setPredictions] = useState<DistrictPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [mlServiceStatus, setMlServiceStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

  // Form state for prediction parameters
  const [predictionParams, setPredictionParams] = useState<BulkPredictionInput>(
    {
      cases_lag1: 150,
      cases_lag2: 140,
      cases_lag3: 130,
      cases_mean_4w: 140,
      temperature_2m_mean: 28.5,
      precipitation_sum: 125.5,
    }
  );

  // Check ML service status on mount
  useEffect(() => {
    checkMLServiceStatus();
  }, []);

  const checkMLServiceStatus = async () => {
    try {
      setMlServiceStatus("checking");
      await dengueService.healthCheck();
      setMlServiceStatus("online");
      // Auto-fetch predictions when service is online
      fetchPredictions();
    } catch (error) {
      setMlServiceStatus("offline");
      toast.error("ML Service Offline", {
        description: "Could not connect to the prediction service on port 8000",
      });
    }
  };

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      const result = await dengueService.predictAllDistricts(predictionParams);
      setPredictions(result.predictions);
      toast.success("Predictions Updated", {
        description: `Loaded predictions for ${result.total_districts} districts`,
      });
    } catch (error: any) {
      toast.error("Failed to fetch predictions", {
        description: error.response?.data?.detail || error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDistrictClick = (district: string) => {
    setSelectedDistrict(district);
    const districtData = predictions.find((p) => p.district === district);
    if (districtData) {
      toast.info(district, {
        description: `Predicted cases: ${districtData.predicted_cases}`,
      });
    }
  };

  const handleParamChange = (
    field: keyof BulkPredictionInput,
    value: number
  ) => {
    setPredictionParams((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getDistrictColor = (district: string): string => {
    const districtData = predictions.find((d) => d.district === district);
    if (!districtData) return "#e5e7eb";
    const cases = districtData.predicted_cases;
    if (cases >= 1000) return "#7f1d1d";
    if (cases >= 500) return "#dc2626";
    if (cases >= 200) return "#f59e0b";
    if (cases >= 50) return "#facc15";
    return "#4ade80";
  };

  // Get top 5 highest risk districts
  const topRiskDistricts = predictions.slice(0, 5);

  // Calculate total predicted cases
  const totalPredictedCases = predictions.reduce(
    (sum, p) => sum + p.predicted_cases,
    0
  );

  // Get risk level
  const getRiskLevel = (cases: number): { level: string; color: string } => {
    if (cases >= 1000) return { level: "Very High", color: "destructive" };
    if (cases >= 500) return { level: "High", color: "destructive" };
    if (cases >= 200) return { level: "Medium", color: "warning" };
    if (cases >= 50) return { level: "Low", color: "secondary" };
    return { level: "Very Low", color: "default" };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Analytics & Predictions
          </h2>
          <p className="text-muted-foreground">
            District-wise dengue outbreak predictions powered by ML
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={checkMLServiceStatus}
            disabled={mlServiceStatus === "checking"}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                mlServiceStatus === "checking" ? "animate-spin" : ""
              }`}
            />
            Check ML Service
          </Button>
          <Button
            onClick={fetchPredictions}
            disabled={loading || mlServiceStatus === "offline"}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <BarChart3 className="mr-2 h-4 w-4" />
            )}
            Generate Predictions
          </Button>
        </div>
      </div>

      {/* ML Service Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {mlServiceStatus === "checking" ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              ) : mlServiceStatus === "online" ? (
                <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
              <div>
                <p className="font-medium">
                  ML Prediction Service{" "}
                  {mlServiceStatus === "online"
                    ? "Online"
                    : mlServiceStatus === "checking"
                    ? "Checking..."
                    : "Offline"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {mlServiceStatus === "online"
                    ? "Connected to http://localhost:8000"
                    : mlServiceStatus === "checking"
                    ? "Verifying connection..."
                    : "Unable to connect to prediction service"}
                </p>
              </div>
            </div>
            {mlServiceStatus === "online" && (
              <Badge variant="outline" className="bg-green-50">
                ✓ Ready
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Prediction Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Prediction Parameters</CardTitle>
          <CardDescription>
            Adjust the input parameters for dengue outbreak prediction
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lag1">Cases Lag 1 Week</Label>
              <Input
                id="lag1"
                type="number"
                value={predictionParams.cases_lag1}
                onChange={(e) =>
                  handleParamChange("cases_lag1", parseFloat(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lag2">Cases Lag 2 Weeks</Label>
              <Input
                id="lag2"
                type="number"
                value={predictionParams.cases_lag2}
                onChange={(e) =>
                  handleParamChange("cases_lag2", parseFloat(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lag3">Cases Lag 3 Weeks</Label>
              <Input
                id="lag3"
                type="number"
                value={predictionParams.cases_lag3}
                onChange={(e) =>
                  handleParamChange("cases_lag3", parseFloat(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mean">4-Week Mean Cases</Label>
              <Input
                id="mean"
                type="number"
                value={predictionParams.cases_mean_4w}
                onChange={(e) =>
                  handleParamChange("cases_mean_4w", parseFloat(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="temp">Temperature (°C)</Label>
              <Input
                id="temp"
                type="number"
                step="0.1"
                value={predictionParams.temperature_2m_mean}
                onChange={(e) =>
                  handleParamChange(
                    "temperature_2m_mean",
                    parseFloat(e.target.value)
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="precip">Precipitation (mm)</Label>
              <Input
                id="precip"
                type="number"
                step="0.1"
                value={predictionParams.precipitation_sum}
                onChange={(e) =>
                  handleParamChange(
                    "precipitation_sum",
                    parseFloat(e.target.value)
                  )
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {predictions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Predicted Cases
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalPredictedCases.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all districts
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Highest Risk District
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {topRiskDistricts[0]?.district}
              </div>
              <p className="text-xs text-destructive">
                {topRiskDistricts[0]?.predicted_cases.toLocaleString()} cases
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Districts Analyzed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{predictions.length}</div>
              <p className="text-xs text-muted-foreground">Complete coverage</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average per District
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(totalPredictedCases / predictions.length)}
              </div>
              <p className="text-xs text-muted-foreground">
                Mean predicted cases
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Interactive Map */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              District-wise Risk Map
            </CardTitle>
            <CardDescription>
              Click on a district to view detailed predictions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              </div>
            ) : predictions.length > 0 ? (
              <div className="h-[600px] w-full">
                <SriLankaMap
                  data={predictions}
                  onDistrictClick={handleDistrictClick}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                <MapPin className="h-12 w-12 mb-4" />
                <p>
                  Click &quot;Generate Predictions&quot; to view the risk map
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Risk Districts */}
        {predictions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top Risk Districts</CardTitle>
              <CardDescription>
                Districts with highest predicted cases
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topRiskDistricts.map((district, index) => {
                  const risk = getRiskLevel(district.predicted_cases);
                  return (
                    <div
                      key={district.district}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => handleDistrictClick(district.district)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{district.district}</p>
                          <p className="text-sm text-muted-foreground">
                            {district.predicted_cases.toLocaleString()} cases
                          </p>
                        </div>
                      </div>
                      <Badge variant={risk.color as any}>{risk.level}</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Districts Table */}
        {predictions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>All Districts</CardTitle>
              <CardDescription>Complete prediction breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {predictions.map((district) => {
                  const risk = getRiskLevel(district.predicted_cases);
                  return (
                    <div
                      key={district.district}
                      className="flex items-center justify-between p-2 rounded hover:bg-accent cursor-pointer"
                      onClick={() => handleDistrictClick(district.district)}
                    >
                      <span className="text-sm font-medium">
                        {district.district}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {district.predicted_cases.toLocaleString()}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {risk.level}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
