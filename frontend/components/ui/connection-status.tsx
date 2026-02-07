"use client";

import { useSocket } from "@/contexts/SocketContext";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ConnectionStatus() {
  const { connectionStatus, reconnect } = useSocket();

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case "connected":
        return {
          icon: Wifi,
          color: "text-green-500",
          bgColor: "bg-green-500/10",
          label: "Connected",
          description: "Real-time updates are active",
        };
      case "connecting":
        return {
          icon: Loader2,
          color: "text-yellow-500",
          bgColor: "bg-yellow-500/10",
          label: "Connecting...",
          description: "Establishing connection",
          animate: true,
        };
      case "error":
        return {
          icon: WifiOff,
          color: "text-red-500",
          bgColor: "bg-red-500/10",
          label: "Connection Error",
          description: "Click to retry connection",
          clickable: true,
        };
      case "disconnected":
      default:
        return {
          icon: WifiOff,
          color: "text-muted-foreground",
          bgColor: "bg-muted",
          label: "Disconnected",
          description: "Real-time updates inactive",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={config.clickable ? reconnect : undefined}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
              transition-colors duration-200
              ${config.bgColor} ${config.color}
              ${
                config.clickable
                  ? "cursor-pointer hover:opacity-80"
                  : "cursor-default"
              }
            `}
          >
            <Icon
              className={`h-3.5 w-3.5 ${config.animate ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">{config.label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
