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
import { AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";

declare global {
  interface Window {
    google?: any;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  const handleCredentialResponse = async (response: any) => {
    setError(null);
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
        router.push("/consent");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Login failed. Please try again.");
    }
  };

  useEffect(() => {
    const initGoogle = () => {
      if (window.google && buttonRef.current) {
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
          callback: handleCredentialResponse,
        });

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
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md border border-border">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>
            Sign in with your university account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex justify-center py-4">
            <div ref={buttonRef} />
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Your first login will take you through our consent process to enable
            AI-powered photo discovery.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
