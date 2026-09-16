"use client";

import { AM_DATASHEET } from "@/lib/tutorial/am-datasheet";

export function AmDatasheet() {
  const d = AM_DATASHEET;
  const rows: [string, string][] = [
    ["Tipo", d.tipo],
    ["Estratégia", d.estrategia],
    ["Completo?", d.completo],
    ["Ótimo?", d.otimo],
    ["Complexidade temporal", d.complexidadeTemporal],
    ["Complexidade espacial", d.complexidadeEspacial],
    ["Requisitos", d.requisitos.join("; ")],
    ["Quando usar", d.quandoUsar],
    ["Limitações", d.limitacoes],
  ];
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-on-surface">{d.nome}</h3>
      <div className="lab-datasheet">
        {rows.map(([label, value]) => (
          <div key={label} className="lab-datasheet-row">
            <span className="lab-datasheet-label">{label}</span>
            <span className="lab-datasheet-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
