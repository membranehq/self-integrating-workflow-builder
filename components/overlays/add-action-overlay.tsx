"use client";

import { AlertTriangle, Check, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { useIntegrationApp } from "@membranehq/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAgentSession } from "@/hooks/use-agent-session";
import { useMembraneIntegrations } from "@/hooks/use-membrane-integrations";
import { openMembraneConnection } from "@/lib/membrane-connect";
import { Overlay } from "./overlay";
import { useOverlay } from "./overlay-provider";

type AddActionOverlayProps = {
  overlayId: string;
  serviceId: string;
  serviceName: string;
  externalAppId: string;
  connectorId: string;
  connectionId: string;
};

export function AddActionOverlay({
  overlayId,
  serviceId,
  serviceName,
  externalAppId,
  connectorId,
  connectionId: initialConnectionId,
}: AddActionOverlayProps) {
  const { closeAll } = useOverlay();
  const { startAddActionSession, isBuilding } = useAgentSession();
  const { refetch } = useMembraneIntegrations();
  const integrationApp = useIntegrationApp();
  const [description, setDescription] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeConnectionId, setActiveConnectionId] = useState(initialConnectionId);

  const isConnected = !!activeConnectionId;

  const handleConnect = useCallback(async () => {
    if (!connectorId || !integrationApp) return;
    setIsConnecting(true);
    try {
      const result = await openMembraneConnection(integrationApp, connectorId);
      if (result?.connectionId) {
        setActiveConnectionId(result.connectionId);
        // Persist to DB
        await fetch("/api/membrane/integrations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: serviceId,
            connectionId: result.connectionId,
          }),
        });
        await refetch();
      }
    } catch (err) {
      console.error("[AddActionOverlay] Connect error:", err);
    } finally {
      setIsConnecting(false);
    }
  }, [connectorId, integrationApp, serviceId, refetch]);

  const handleGenerate = () => {
    startAddActionSession(
      serviceName,
      externalAppId,
      connectorId,
      activeConnectionId,
      description.trim()
    );
    closeAll();
  };

  return (
    <Overlay
      actions={
        isConnected
          ? [
              {
                label: "Generate",
                onClick: handleGenerate,
                disabled: !description.trim() || isBuilding,
              },
            ]
          : undefined
      }
      overlayId={overlayId}
      title={`Add Action to ${serviceName}`}
    >
      <div className="flex flex-col gap-6">
        {/* Connection section */}
        {!isConnected ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Connect your {serviceName} account first so the AI Agent can
              discover available API endpoints.
            </p>
            <Button
              className="w-full justify-start gap-2 border-orange-500/50 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20"
              disabled={isConnecting || !connectorId || !integrationApp}
              onClick={handleConnect}
              variant="outline"
            >
              <AlertTriangle className="size-4" />
              <span>
                {isConnecting
                  ? "Connecting..."
                  : `Connect ${serviceName} account`}
              </span>
              <Plus className="ml-auto size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <Check className="size-4 text-green-600" />
            <span className="text-sm">Connected to {serviceName}</span>
          </div>
        )}

        {/* Action description — only shown after connecting */}
        {isConnected && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="action-description">
                What should this action do?
              </Label>
              <Input
                autoFocus
                id="action-description"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Send a message to a channel"
                value={description}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              An AI Agent will create the action based on your description. This
              usually takes a couple of minutes.
            </p>
          </>
        )}
      </div>
    </Overlay>
  );
}
