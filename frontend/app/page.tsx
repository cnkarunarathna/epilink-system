import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Activity,
  BarChart3,
  Bell,
  CheckCircle2,
  Cloud,
  FileText,
  MapPin,
  Shield,
  Users,
  Zap,
  Database,
  TrendingUp,
  ClipboardCheck,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-linear-to-b from-primary/5 via-background to-background py-24 md:py-40">
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-grid-pattern opacity-40" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

        <div className="container relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <Badge
              variant="secondary"
              className="mb-6 animate-fade-in px-4 py-1.5 text-sm font-medium shadow-sm"
            >
              🦟 Dengue Risk Monitoring System
            </Badge>
            <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl animate-slide-up">
              <span className="bg-linear-to-r from-foreground via-foreground to-foreground/80 bg-clip-text text-transparent">
                Predict. Coordinate.
              </span>{" "}
              <span className="bg-linear-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
                Protect.
              </span>
            </h1>
            <p className="mb-10 text-lg text-muted-foreground sm:text-xl md:text-2xl leading-relaxed max-w-3xl mx-auto animate-slide-up text-balance">
              A full-stack, role-based platform designed for Sri Lankan health
              authorities to predict short-term dengue risk, coordinate cleanup
              operations, and monitor field-level progress.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-scale-in">
              <Button
                size="lg"
                className="group shadow-lg hover:shadow-xl transition-all duration-300"
                asChild
              >
                <Link href="/register">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="shadow-md hover:shadow-lg transition-all duration-300"
                asChild
              >
                <Link href="#features">Learn More</Link>
              </Button>
            </div>

            {/* Stats row */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto animate-fade-in">
              <div className="text-center p-4 rounded-lg bg-background/50 backdrop-blur">
                <div className="text-3xl md:text-4xl font-bold text-primary">
                  25+
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Districts
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-background/50 backdrop-blur">
                <div className="text-3xl md:text-4xl font-bold text-primary">
                  99%
                </div>
                <div className="text-sm text-muted-foreground mt-1">Uptime</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-background/50 backdrop-blur">
                <div className="text-3xl md:text-4xl font-bold text-primary">
                  500+
                </div>
                <div className="text-sm text-muted-foreground mt-1">Users</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-background/50 backdrop-blur">
                <div className="text-3xl md:text-4xl font-bold text-primary">
                  &lt;3s
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Load Time
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 md:py-32 bg-muted/30">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-balance">
              About EpiLink
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              EpiLink automates epidemiological data ingestion, generates
              explainable ML-driven risk levels, and supports operational
              workflows for PHIs and supervisors.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-10">
            <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-xl group">
              <CardHeader className="pb-4">
                <div className="mb-4 inline-flex p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                  <TrendingUp className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">
                  Automated Data Processing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  Automatic ingestion and processing of weekly dengue case PDFs
                  and live weather data with validation and deduplication.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-xl group">
              <CardHeader className="pb-4">
                <div className="mb-4 inline-flex p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                  <BarChart3 className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">ML-Driven Predictions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  Predict next-week dengue risk (Low / Medium / High) for each
                  district/MOH with explainable AI insights.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-xl group">
              <CardHeader className="pb-4">
                <div className="mb-4 inline-flex p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                  <ClipboardCheck className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Field Operations</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  Enable task assignment, field reporting, and evidence tracking
                  for cleanup and fogging operations.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Core Objectives */}
      <section className="py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Core Objectives
            </h2>
            <p className="text-lg text-muted-foreground">
              Our mission is to support rapid response and save lives through
              technology
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="flex gap-4">
              <div className="shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Database className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Data Automation</h3>
                <p className="text-sm text-muted-foreground">
                  Automate ingestion and processing of weekly dengue case PDFs
                  and live weather data
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Risk Prediction</h3>
                <p className="text-sm text-muted-foreground">
                  Predict next-week dengue risk for each district and MOH area
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Interactive Dashboards</h3>
                <p className="text-sm text-muted-foreground">
                  Provide national, district, and field-level decision-making
                  dashboards
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Task Management</h3>
                <p className="text-sm text-muted-foreground">
                  Enable task assignment, field reporting, and evidence tracking
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Weekly Reports</h3>
                <p className="text-sm text-muted-foreground">
                  Deliver weekly reports and alerts to support rapid response in
                  high-risk regions
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Evidence Tracking</h3>
                <p className="text-sm text-muted-foreground">
                  Geo-tagged photo uploads and field-level progress monitoring
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* User Roles */}
      <section className="py-20 bg-muted/40">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              User Roles
            </h2>
            <p className="text-lg text-muted-foreground">
              Role-based access control for different stakeholders
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <Shield className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Admin</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">
                  System-wide management
                </p>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Manage districts/MOH boundaries</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Create and manage users</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>View national analytics</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Supervisor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">
                  District-level operations
                </p>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Access district dashboards</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Create and assign tasks</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Verify evidence and close tasks</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Activity className="h-10 w-10 text-primary mb-2" />
                <CardTitle>PHI</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">
                  Field officer operations
                </p>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>View assigned tasks</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Update status and upload evidence</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Work offline and sync</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Viewer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">
                  Read-only access
                </p>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Public dashboard access</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>View non-sensitive data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>Organization-level insights</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              System Features
            </h2>
            <p className="text-lg text-muted-foreground">
              Comprehensive modules for end-to-end dengue risk management
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <Database className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Data Ingestion</CardTitle>
                <CardDescription>
                  Automated data processing pipeline
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Weekly epidemiological PDF scraping</li>
                  <li>• Data cleaning and validation</li>
                  <li>• Weather data integration</li>
                  <li>• Centralized database storage</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Zap className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">ML Risk Prediction</CardTitle>
                <CardDescription>
                  Intelligent forecasting system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Next-week risk predictions</li>
                  <li>• Explainable AI (SHAP)</li>
                  <li>• District/MOH level granularity</li>
                  <li>• Microservice API integration</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Dashboards</CardTitle>
                <CardDescription>
                  Real-time insights and analytics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• National risk heatmap</li>
                  <li>• District analytics and trends</li>
                  <li>• PHI task management view</li>
                  <li>• Interactive visualizations</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <ClipboardCheck className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Task Management</CardTitle>
                <CardDescription>Field operations coordination</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Task assignment workflow</li>
                  <li>• Evidence upload with geo-tags</li>
                  <li>• Verification and approval</li>
                  <li>• Full audit trail</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Bell className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Alerts & Reporting</CardTitle>
                <CardDescription>Automated notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Weekly PDF reports</li>
                  <li>• Email/SMS alerts</li>
                  <li>• High-risk area notifications</li>
                  <li>• Scheduled automation</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Security</CardTitle>
                <CardDescription>Enterprise-grade protection</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• JWT authentication</li>
                  <li>• Role-based access control</li>
                  <li>• Activity logs and audit</li>
                  <li>• HTTPS enforced</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-muted/40">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground">
              A streamlined workflow from data to action
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex gap-4">
              <div className="shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  1
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Data Collection</h3>
                <p className="text-muted-foreground">
                  System automatically scrapes weekly dengue case reports and
                  integrates live weather data from trusted sources
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  2
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Risk Prediction</h3>
                <p className="text-muted-foreground">
                  Machine learning models analyze historical patterns and
                  current conditions to predict next-week dengue risk levels for
                  each district
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  3
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Task Assignment</h3>
                <p className="text-muted-foreground">
                  Supervisors review risk predictions and assign cleanup,
                  fogging, and inspection tasks to field officers (PHIs) in
                  high-risk areas
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  4
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Field Operations</h3>
                <p className="text-muted-foreground">
                  PHIs execute tasks, upload geo-tagged evidence (photos,
                  notes), and update status through web or mobile interface
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                  5
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  Verification & Reporting
                </h3>
                <p className="text-muted-foreground">
                  Supervisors verify evidence, close tasks, and system generates
                  automated weekly reports with alerts for high-risk regions
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Technology Stack
            </h2>
            <p className="text-lg text-muted-foreground">
              Built with modern, scalable technologies
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-primary" />
                  Frontend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• React / Next.js for web dashboards</li>
                  <li>• Responsive and mobile-optimized</li>
                  <li>• Real-time data visualization</li>
                  <li>• Progressive Web App capabilities</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Backend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Microservices (Node/FastAPI)</li>
                  <li>• PostgreSQL primary database</li>
                  <li>• Redis for caching (optional)</li>
                  <li>• Cloud object storage for files</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  ML Service
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• XGBoost/Prophet models</li>
                  <li>• Explainable AI (SHAP)</li>
                  <li>• High availability (≥99%)</li>
                  <li>• Automated weekly training</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Security & Scale
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Horizontal scalability (500+ users)</li>
                  <li>• ≤3s dashboard load times</li>
                  <li>• HTTPS and JWT authentication</li>
                  <li>• Comprehensive audit logging</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-muted/40">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>Who can use EpiLink?</AccordionTrigger>
                <AccordionContent>
                  EpiLink is designed for Sri Lankan health authorities
                  including Admins, District Supervisors, Public Health
                  Inspectors (PHIs), and authorized viewers from health
                  organizations.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2">
                <AccordionTrigger>
                  How accurate are the predictions?
                </AccordionTrigger>
                <AccordionContent>
                  Our ML models use historical dengue case data, weather
                  patterns, and other epidemiological factors to generate
                  next-week risk predictions. The system provides explainable AI
                  insights (SHAP values) to show which factors contribute most
                  to each prediction.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3">
                <AccordionTrigger>
                  Can PHIs use the system offline?
                </AccordionTrigger>
                <AccordionContent>
                  Yes, the mobile application (optional enhancement) supports
                  offline-first functionality, allowing PHIs to update tasks and
                  capture evidence without internet connectivity. Data syncs
                  automatically when connection is restored.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4">
                <AccordionTrigger>
                  How is data security maintained?
                </AccordionTrigger>
                <AccordionContent>
                  EpiLink implements enterprise-grade security including
                  JWT-based authentication, role-based access control (RBAC),
                  HTTPS encryption, comprehensive activity logging, and secure
                  cloud storage for all evidence uploads.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5">
                <AccordionTrigger>
                  What data sources does the system use?
                </AccordionTrigger>
                <AccordionContent>
                  The system automatically ingests weekly epidemiological
                  reports (PDFs) from official sources and integrates live
                  weather data. All data is cleaned, validated, and deduplicated
                  before storage and analysis.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6">
                <AccordionTrigger>How are alerts delivered?</AccordionTrigger>
                <AccordionContent>
                  The system sends automated alerts via email and SMS for
                  high-risk areas, overdue tasks, and weekly prediction updates.
                  Alerts are role-based and configurable.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        id="contact"
        className="py-20 bg-primary text-primary-foreground"
      >
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Ready to Transform Dengue Prevention?
            </h2>
            <p className="text-lg mb-8 opacity-90">
              Join health authorities across Sri Lanka using EpiLink to predict
              risk, coordinate operations, and protect communities.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/register">Start Free Trial</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="bg-transparent text-primary-foreground border-primary-foreground hover:bg-primary-foreground/10"
                asChild
              >
                <Link href="/contact">Contact Sales</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
