"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAgentSession } from "@/hooks/use-agent-session";
import { Overlay } from "./overlay";
import { useOverlay } from "./overlay-provider";

type BuildIntegrationOverlayProps = {
  overlayId: string;
  initialAppName: string;
};

export function BuildIntegrationOverlay({
  overlayId,
  initialAppName,
}: BuildIntegrationOverlayProps) {
  const { closeAll } = useOverlay();
  const { startBuildSession, isBuilding } = useAgentSession();
  const [appName, setAppName] = useState(initialAppName);
  const [appUrl, setAppUrl] = useState("");

  const handleGenerate = () => {
    startBuildSession(appName.trim(), appUrl.trim());
    closeAll();
  };

  return (
    <Overlay
      actions={[
        {
          label: "Generate",
          onClick: handleGenerate,
          disabled: !appName.trim() || isBuilding,
        },
      ]}
      overlayId={overlayId}
      title="Build Integration"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="app-name">App Name</Label>
          <Input
            autoFocus
            id="app-name"
            onChange={(e) => setAppName(e.target.value)}
            placeholder="Enter app name"
            value={appName}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="app-url">App URL (optional)</Label>
          <Input
            id="app-url"
            onChange={(e) => setAppUrl(e.target.value)}
            placeholder="https://example.com"
            value={appUrl}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          Clicking Generate will launch an AI Agent session that will build the
          integration for you.
        </p>
      </div>
    </Overlay>
  );
}
