"use client";

import { ReactNode, useEffect, useState } from "react";
import { Icon } from "@/components/shared/Panel";

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Gates a 3D canvas behind a synchronous WebGL support check performed BEFORE the (heavy)
 * three.js/react-three-fiber chunk is even requested. All 3 visualizations in this app are
 * WebGL-only with no 2D fallback, so without this a browser/GPU lacking WebGL support (older lab
 * machines, some VMs/RDP sessions, hardware acceleration disabled) would otherwise show a
 * permanently blank canvas with zero explanation - and silently waste the three.js download too.
 */
export function WebGLGate({ children }: { children: ReactNode }) {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detectWebGL() touches `document`, so it can only run client-side after mount (this component itself is still server-rendered as part of the page)
    setSupported(detectWebGL());
  }, []);

  if (supported === null) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs text-on-surface-variant">
        Verificando suporte a WebGL…
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Icon name="visibility_off" className="text-[32px] text-on-surface-variant" />
        <p className="text-sm font-medium text-on-surface">WebGL não disponível</p>
        <p className="max-w-[280px] text-[12px] leading-relaxed text-on-surface-variant">
          Este navegador ou dispositivo não conseguiu iniciar renderização 3D. Tente atualizar o
          navegador, ativar aceleração de hardware nas configurações gráficas, ou abrir esta
          página em outro computador.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
