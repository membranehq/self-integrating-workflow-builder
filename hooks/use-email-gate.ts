"use client";

import { useCallback, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { EmailCollectionOverlay } from "@/components/overlays/email-collection-overlay";
import { useOverlay } from "@/components/overlays/overlay-provider";

function hasRealEmail(email?: string | null): boolean {
  if (!email) return false;
  if (email.startsWith("temp-") && email.endsWith("@local")) return false;
  return true;
}

export function useEmailGate() {
  const { open } = useOverlay();
  const collectedRef = useRef(false);

  const ensureEmail = useCallback(async (): Promise<void> => {
    if (collectedRef.current) return;

    // Fetch fresh session from the server to avoid stale closure issues
    const { data: session } = await authClient.getSession();
    if (hasRealEmail(session?.user?.email)) {
      collectedRef.current = true;
      return;
    }

    return new Promise<void>((resolve) => {
      open(
        EmailCollectionOverlay,
        {
          onComplete: () => {
            collectedRef.current = true;
            resolve();
          },
        },
        {
          closeOnBackdropClick: false,
          closeOnEscape: false,
        },
      );
    });
  }, [open]);

  return { ensureEmail };
}
