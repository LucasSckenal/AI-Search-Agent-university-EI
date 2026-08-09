"use client";

import SceneEditor from "@/components/goose/SceneEditor";

// Internal dev tool, not linked from the sidebar/command palette - reached by URL only
// (see SceneEditor.tsx for why: it's a config-authoring aid, not a runtime feature).
export default function GooseEditorPage() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Goose</span>
            <span>/</span>
            <span className="accent">Editor de Cenário</span>
          </div>
          <h1 className="content-title">Editor de Cenário</h1>
          <p className="content-sub">
            Monte o fundo do Goose escolhendo tiles diretamente das planilhas do Kenney, como num
            editor de cena do Godot. Quando estiver satisfeito, copie a configuração e cole em{" "}
            <code>src/lib/goose/scenery.ts</code>.
          </p>
        </div>
      </div>

      <div className="rounded-[32px] border border-white/[0.08] bg-surface-container-lowest p-4 shadow-[inset_0_2px_20px_rgba(0,0,0,0.15)]">
        <SceneEditor />
      </div>
    </div>
  );
}
