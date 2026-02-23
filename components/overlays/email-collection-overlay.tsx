"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OverlayHeader } from "./overlay-header";
import { OverlayFooter } from "./overlay-footer";
import { useOverlay } from "./overlay-provider";

type EmailCollectionOverlayProps = {
  overlayId: string;
  onComplete: () => void;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailCollectionOverlay({
  overlayId,
  onComplete,
}: EmailCollectionOverlayProps) {
  const { closeAll } = useOverlay();
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

      closeAll();
      onComplete();
    } catch {
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col">
      <OverlayHeader
        overlayId={overlayId}
        title="Get Started"
        description="Enter your email to start building workflows"
        showCloseButton={false}
      />
      <div className="flex-1 p-6">
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
          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}
        </div>
      </div>
      <OverlayFooter
        actions={[
          {
            label: "Continue",
            onClick: handleSubmit,
            disabled: !isValid || isLoading,
            loading: isLoading,
          },
        ]}
      />
    </div>
  );
}
