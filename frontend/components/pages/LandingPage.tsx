"use client";

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
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Scroll reveal component
function ScrollReveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-linear-to-b from-primary/5 via-background to-background py-24 md:py-40">
        {/* Animated decorative background elements */}
        <div className="absolute inset-0 bg-grid-pattern opacity-40" />
        <motion.div
          className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-20 left-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl"
          animate={{
            rotate: [0, 360],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        <div className="container mx-auto px-4 relative z-10 max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge
                variant="secondary"
                className="mb-6 px-4 py-1.5 text-sm font-medium shadow-sm"
              >
                <Sparkles className="w-4 h-4 inline mr-2" />
                🦟 Dengue Risk Monitoring System
              </Badge>
            </motion.div>

            <motion.h1
              className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              <span className="bg-linear-to-r from-foreground via-foreground to-foreground/80 bg-clip-text text-transparent">
                Predict. Coordinate.
              </span>{" "}
              <span className="bg-linear-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
                Protect.
              </span>
            </motion.h1>

            <motion.p
              className="mb-10 text-lg text-muted-foreground sm:text-xl md:text-2xl leading-relaxed max-w-3xl mx-auto text-balance"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
            >
              A full-stack, role-based platform designed for Sri Lankan health
              authorities to predict short-term dengue risk, coordinate cleanup
              operations, and monitor field-level progress.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
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
            </motion.div>

            {/* Stats row */}
            <motion.div
              className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto"
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
              transition={{ delay: 0.8 }}
            >
              {[
                { value: "25+", label: "Districts" },
                { value: "99%", label: "Uptime" },
                { value: "500+", label: "Users" },
                { value: "<3s", label: "Load Time" },
              ].map((stat, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="text-center p-4 rounded-lg bg-background/50 backdrop-blur hover:bg-background/70 transition-colors duration-300"
                >
                  <motion.div
                    className="text-3xl md:text-4xl font-bold text-primary"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    {stat.value}
                  </motion.div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4 max-w-7xl">
          <ScrollReveal>
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
          </ScrollReveal>

          <motion.div
            className="grid md:grid-cols-3 gap-8 lg:gap-10"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            {[
              {
                icon: TrendingUp,
                title: "Automated Data Processing",
                description:
                  "Automatic ingestion and processing of weekly dengue case PDFs and live weather data with validation and deduplication.",
              },
              {
                icon: BarChart3,
                title: "ML-Driven Predictions",
                description:
                  "Predict next-week dengue risk (Low / Medium / High) for each district/MOH with explainable AI insights.",
              },
              {
                icon: ClipboardCheck,
                title: "Field Operations",
                description:
                  "Enable task assignment, field reporting, and evidence tracking for cleanup and fogging operations.",
              },
            ].map((item, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-xl group h-full">
                  <CardHeader className="pb-4">
                    <motion.div
                      className="mb-4 inline-flex p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <item.icon className="h-8 w-8 text-primary" />
                    </motion.div>
                    <CardTitle className="text-xl">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Core Objectives */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-7xl">
          <ScrollReveal>
            <div className="mx-auto max-w-3xl text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                Core Objectives
              </h2>
              <p className="text-lg text-muted-foreground">
                Our mission is to support rapid response and save lives through
                technology
              </p>
            </div>
          </ScrollReveal>

          <motion.div
            className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            {[
              {
                icon: Database,
                title: "Data Automation",
                description:
                  "Automate ingestion and processing of weekly dengue case PDFs and live weather data",
              },
              {
                icon: AlertTriangle,
                title: "Risk Prediction",
                description:
                  "Predict next-week dengue risk for each district and MOH area",
              },
              {
                icon: BarChart3,
                title: "Interactive Dashboards",
                description:
                  "Provide national, district, and field-level decision-making dashboards",
              },
              {
                icon: ClipboardCheck,
                title: "Task Management",
                description:
                  "Enable task assignment, field reporting, and evidence tracking",
              },
              {
                icon: FileText,
                title: "Weekly Reports",
                description:
                  "Deliver weekly reports and alerts to support rapid response in high-risk regions",
              },
              {
                icon: MapPin,
                title: "Evidence Tracking",
                description:
                  "Geo-tagged photo uploads and field-level progress monitoring",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="flex gap-4 p-4 rounded-lg hover:bg-muted/50 transition-colors duration-300"
              >
                <div className="shrink-0">
                  <motion.div
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <item.icon className="h-5 w-5 text-primary" />
                  </motion.div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* User Roles */}
      <section className="py-20 bg-muted/40">
        <div className="container mx-auto px-4 max-w-7xl">
          <ScrollReveal>
            <div className="mx-auto max-w-3xl text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                User Roles
              </h2>
              <p className="text-lg text-muted-foreground">
                Tailored dashboards for each stakeholder
              </p>
            </div>
          </ScrollReveal>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            {[
              {
                icon: Shield,
                title: "Admin",
                description: "Full system control",
                features: [
                  "Manage users and roles",
                  "Configure system parameters",
                  "View all dashboards",
                ],
              },
              {
                icon: Users,
                title: "Supervisor (MOOH)",
                description: "District coordination",
                features: [
                  "Access district dashboards",
                  "Create and assign tasks",
                  "Verify evidence and close tasks",
                ],
              },
              {
                icon: Activity,
                title: "PHI",
                description: "Field officer operations",
                features: [
                  "View assigned tasks",
                  "Update status and upload evidence",
                  "Work offline and sync",
                ],
              },
              {
                icon: BarChart3,
                title: "Viewer",
                description: "Read-only access",
                features: [
                  "Public dashboard access",
                  "View non-sensitive data",
                  "Organization-level insights",
                ],
              },
            ].map((role, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <role.icon className="h-10 w-10 text-primary mb-2" />
                    </motion.div>
                    <CardTitle>{role.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-3">
                      {role.description}
                    </p>
                    <ul className="space-y-1 text-sm">
                      {role.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="container mx-auto px-4 max-w-7xl">
          <ScrollReveal>
            <div className="mx-auto max-w-3xl text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                System Features
              </h2>
              <p className="text-lg text-muted-foreground">
                Comprehensive modules for end-to-end dengue risk management
              </p>
            </div>
          </ScrollReveal>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            {[
              {
                icon: Database,
                title: "Data Ingestion",
                description: "Automated data processing pipeline",
                features: [
                  "Weekly epidemiological PDF scraping",
                  "Data cleaning and validation",
                  "Weather data integration",
                  "Centralized database storage",
                ],
              },
              {
                icon: Zap,
                title: "ML Risk Prediction",
                description: "Intelligent forecasting system",
                features: [
                  "Next-week risk predictions",
                  "Explainable AI (SHAP)",
                  "District/MOH level granularity",
                  "Microservice API integration",
                ],
              },
              {
                icon: BarChart3,
                title: "Dashboards",
                description: "Real-time insights and analytics",
                features: [
                  "National risk heatmap",
                  "District analytics and trends",
                  "PHI task management view",
                  "Interactive visualizations",
                ],
              },
              {
                icon: ClipboardCheck,
                title: "Task Management",
                description: "Field operations coordination",
                features: [
                  "Task assignment workflow",
                  "Evidence upload with geo-tags",
                  "Verification and approval",
                  "Full audit trail",
                ],
              },
              {
                icon: Bell,
                title: "Alerts & Reporting",
                description: "Automated notifications",
                features: [
                  "Weekly PDF reports",
                  "Email/SMS alerts",
                  "High-risk area notifications",
                  "Scheduled automation",
                ],
              },
              {
                icon: Shield,
                title: "Security",
                description: "Enterprise-grade protection",
                features: [
                  "JWT authentication",
                  "Role-based access control",
                  "Activity logs and audit",
                  "HTTPS enforced",
                ],
              },
            ].map((feature, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <feature.icon className="h-8 w-8 text-primary mb-2" />
                    </motion.div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {feature.features.map((item, idx) => (
                        <li key={idx}>• {item}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-muted/40">
        <div className="container mx-auto px-4 max-w-7xl">
          <ScrollReveal>
            <div className="mx-auto max-w-3xl text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                How It Works
              </h2>
              <p className="text-lg text-muted-foreground">
                A streamlined workflow from data to action
              </p>
            </div>
          </ScrollReveal>

          <motion.div
            className="max-w-3xl mx-auto space-y-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            {[
              {
                step: 1,
                title: "Data Collection",
                description:
                  "System automatically scrapes weekly dengue case reports and integrates live weather data from trusted sources",
              },
              {
                step: 2,
                title: "Risk Prediction",
                description:
                  "Machine learning models analyze historical patterns and current conditions to predict next-week dengue risk levels for each district",
              },
              {
                step: 3,
                title: "Task Assignment",
                description:
                  "Supervisors review risk predictions and assign cleanup, fogging, and inspection tasks to field officers (PHIs) in high-risk areas",
              },
              {
                step: 4,
                title: "Field Execution",
                description:
                  "PHIs complete tasks, upload geo-tagged evidence photos, and update status in real-time or offline mode",
              },
              {
                step: 5,
                title: "Reporting & Alerts",
                description:
                  "Weekly reports are generated automatically and distributed to stakeholders. Real-time alerts notify decision-makers of critical situations",
              },
            ].map((item, index) => (
              <motion.div key={index} variants={fadeInUp} className="flex gap-4">
                <div className="shrink-0">
                  <motion.div
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold"
                    whileHover={{ scale: 1.2, rotate: 360 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    {item.step}
                  </motion.div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-7xl">
          <ScrollReveal>
            <div className="mx-auto max-w-3xl text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                Technology Stack
              </h2>
              <p className="text-lg text-muted-foreground">
                Built with modern, scalable technologies
              </p>
            </div>
          </ScrollReveal>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            {[
              {
                category: "Frontend",
                items: ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS"],
              },
              {
                category: "Backend",
                items: ["NestJS", "TypeORM", "PostgreSQL", "JWT Auth"],
              },
              {
                category: "ML & Data",
                items: ["Python", "Scikit-learn", "FastAPI", "Pandas"],
              },
              {
                category: "Cloud & DevOps",
                items: ["Docker", "Nginx", "CI/CD", "Linux"],
              },
              {
                category: "Integrations",
                items: [
                  "Weather API",
                  "PDF Scraping",
                  "Email/SMS",
                  "Geo-tagging",
                ],
              },
              {
                category: "Monitoring",
                items: [
                  "Health checks",
                  "Activity logs",
                  "Error tracking",
                  "Analytics",
                ],
              },
            ].map((tech, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="hover:shadow-lg transition-shadow h-full">
                  <CardHeader>
                    <CardTitle className="text-lg">{tech.category}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {tech.items.map((item, idx) => (
                        <li
                          key={idx}
                          className="text-sm text-muted-foreground flex items-center gap-2"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-muted/40">
        <div className="container mx-auto px-4 max-w-7xl">
          <ScrollReveal>
            <div className="mx-auto max-w-3xl text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-lg text-muted-foreground">
                Find answers to common questions about EpiLink
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="max-w-3xl mx-auto">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>
                    How accurate are the risk predictions?
                  </AccordionTrigger>
                  <AccordionContent>
                    Our ML models are trained on historical dengue case data
                    combined with weather patterns. While predictions provide
                    valuable guidance for resource allocation, they should be
                    used alongside field expertise and local knowledge for
                    decision-making.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>
                    Can PHIs use the system offline?
                  </AccordionTrigger>
                  <AccordionContent>
                    Yes, the mobile interface supports offline task viewing and
                    evidence collection. Data automatically syncs when
                    connectivity is restored, ensuring field work is never
                    interrupted.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>
                    How is data security ensured?
                  </AccordionTrigger>
                  <AccordionContent>
                    EpiLink implements JWT-based authentication, role-based
                    access control, HTTPS encryption, and comprehensive activity
                    logging. All user actions are audited and sensitive data is
                    protected according to best practices.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-4">
                  <AccordionTrigger>
                    What data sources are used?
                  </AccordionTrigger>
                  <AccordionContent>
                    The system integrates weekly epidemiological reports from
                    the Department of Health, live weather data from authorized
                    APIs, and field-level task completion evidence uploaded by
                    PHIs. All sources are validated and deduplicated.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-5">
                  <AccordionTrigger>
                    How often are predictions updated?
                  </AccordionTrigger>
                  <AccordionContent>
                    Risk predictions are refreshed weekly, aligned with new
                    epidemiological data releases. The system also provides
                    real-time dashboard updates as field tasks are completed and
                    weather conditions change.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* CTA Section */}
      <section id="contact" className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 max-w-7xl">
          <ScrollReveal>
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                Ready to Get Started?
              </h2>
              <p className="text-lg mb-8 text-primary-foreground/90">
                Join the fight against dengue. Contact us to learn more about
                implementing EpiLink for your district.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  variant="secondary"
                  className="shadow-lg hover:shadow-xl"
                  asChild
                >
                  <Link href="/register">Get Started</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10"
                  asChild
                >
                  <Link href="mailto:info@epilink.lk">Contact Us</Link>
                </Button>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
}
