"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";

declare global {
  interface Window {
    google?: any;
    __google_gsi_initialized?: boolean;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  const handleCredentialResponse = async (response: any) => {
    setError(null);
    setIsLoading(true);
    try {
      const token = response.credential;
      const res = await apiClient.loginWithGoogle(token);

      if (res.error || !res.data) {
        throw new Error(res.error || "Login failed");
      }

      const { access_token, user } = res.data;

      localStorage.setItem("auth_token", access_token);
      localStorage.setItem("user_id", user.id);
      localStorage.setItem("user_data", JSON.stringify(user));
      localStorage.setItem("user_name", user.name);
      localStorage.setItem("user_email", user.email);
      localStorage.setItem("user_role", user.role.toLowerCase());

      if (user.role === "PHOTOGRAPHER") {
        router.push("/photographer");
      } else if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
        localStorage.setItem("admin_token", access_token);
        localStorage.setItem("admin_name", user.name);
        router.push("/admin/dashboard");
      } else {
        if (user.pdpaConsent) {
          router.push("/dashboard");
        } else {
          router.push("/consent");
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Login failed. Please try again.");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initGoogle = () => {
      if (window.google && buttonRef.current) {
        // Only initialize once globally to avoid [GSI_LOGGER] warning
        if (!window.__google_gsi_initialized) {
          window.google.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
            callback: handleCredentialResponse,
          });
          window.__google_gsi_initialized = true;
        }

        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
          locale: "en",
          width: 320,
        });
      }
    };

    // If script is already loaded
    if (window.google) {
      initGoogle();
      return;
    }

    // Otherwise wait for it
    const interval = setInterval(() => {
      if (window.google) {
        clearInterval(interval);
        initGoogle();
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        backgroundImage: 'url(/background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <Card className="relative z-10 w-full max-w-md bg-white/10 dark:bg-black/10 border-white/20 text-white animate-in fade-in-0 zoom-in-95 duration-500">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold">Sign In</CardTitle>
          <CardDescription className="text-white/80">
            Sign in with your Google account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="flex gap-3 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <div className="flex justify-center py-4 min-h-[60px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-white/80" />
                <span className="text-sm font-medium text-white/80">Signing you in...</span>
              </div>
            ) : (
              <div ref={buttonRef} />
            )}
          </div>

          <p className="text-xs text-white/60 text-center">
            Your first login will take you through our consent process to enable
            AI-powered photo discovery.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
