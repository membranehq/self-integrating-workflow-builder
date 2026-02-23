"use client";

import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, useSession } from "@/lib/auth-client";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hasRealEmail(email?: string | null): boolean {
  if (!email) return false;
  if (email.startsWith("temp-") && email.endsWith("@local")) return false;
  return true;
}

function EmailForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isValid = EMAIL_REGEX.test(email.trim());

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      setError("Please enter a valid email address");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      // Create anonymous session if needed
      const { data: session } = await authClient.getSession();
      if (!session) {
        await authClient.signIn.anonymous();
        // Wait briefly for session to propagate
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const response = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to save email");
        setIsLoading(false);
        return;
      }

      // Force session refresh so useSession picks up the new email
      await authClient.getSession({ query: { disableCookieCache: true } });
    } catch {
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-6">
        <div className="space-y-1.5">
          <h2 className="font-semibold text-lg leading-none tracking-tight">
            Get Started
          </h2>
          <p className="text-muted-foreground text-sm">
            Enter your email to start building workflows
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email-gate">Email</Label>
          <Input
            autoFocus
            id="email-gate"
            type="email"
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isValid && !isLoading) handleSubmit();
            }}
            placeholder="you@example.com"
            value={email}
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <Button
          className="w-full"
          disabled={!isValid || isLoading}
          onClick={handleSubmit}
        >
          {isLoading ? "Continuing..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}

export function EmailGate({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();

  // Still loading session — show nothing to avoid flash
  if (isPending) return null;

  // No session yet, or session has no real email — show the form
  if (!session || !hasRealEmail(session.user?.email)) {
    return <EmailForm />;
  }

  return <>{children}</>;
}
