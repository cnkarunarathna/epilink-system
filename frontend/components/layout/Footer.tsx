import Link from "next/link";
import { Activity, Mail, Phone, MapPin } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t bg-muted/30 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-16 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Column */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-linear-to-br from-primary to-primary/80 shadow-md group-hover:shadow-lg transition-shadow">
                <Activity className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">
                Epi<span className="text-primary">Link</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Dengue risk monitoring and cleanup management system for Sri
              Lankan health authorities.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Quick Links</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="#about"
                  className="hover:text-primary transition-colors"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="#features"
                  className="hover:text-primary transition-colors"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="#how-it-works"
                  className="hover:text-primary transition-colors"
                >
                  How It Works
                </Link>
              </li>
              <li>
                <Link
                  href="/documentation"
                  className="hover:text-primary transition-colors"
                >
                  Documentation
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Resources</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-primary transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="hover:text-primary transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/support"
                  className="hover:text-primary transition-colors"
                >
                  Support
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="hover:text-primary transition-colors"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Contact</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center space-x-2">
                <Mail className="h-4 w-4" />
                <a
                  href="mailto:info@epilink.lk"
                  className="hover:text-primary transition-colors"
                >
                  info@epilink.lk
                </a>
              </li>
              <li className="flex items-center space-x-2">
                <Phone className="h-4 w-4" />
                <a
                  href="tel:+94112345678"
                  className="hover:text-primary transition-colors"
                >
                  +94 11 234 5678
                </a>
              </li>
              <li className="flex items-start space-x-2">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Ministry of Health
                  <br />
                  Colombo, Sri Lanka
                </span>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 text-center md:text-left">
          <p className="text-sm text-muted-foreground">
            © {currentYear} EpiLink. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Developed for Sri Lankan Health Authorities
          </p>
        </div>
      </div>
    </footer>
  );
}
