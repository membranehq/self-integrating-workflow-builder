"use client";

import { useCallback, useRef } from "react";
import { useSession } from "@/lib/auth-client";
import { EmailCollectionOverlay } from "@/components/overlays/email-collection-overlay";
import { useOverlay } from "@/components/overlays/overlay-provider";

function hasRealEmail(email?: string | null): boolean {
  if (!email) return false;
  if (email.startsWith("temp-") && email.endsWith("@local")) return false;
  return true;
}

export function useEmailGate() {
  const { data: session } = useSession();
  const { open } = useOverlay();
  const collectedRef = useRef(false);

  const ensureEmail = useCallback((): Promise<void> => {
    if (collectedRef.current) return Promise.resolve();
    if (hasRealEmail(session?.user?.email)) {
      collectedRef.current = true;
      return Promise.resolve();
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
  }, [session, open]);

  return { ensureEmail };
}
