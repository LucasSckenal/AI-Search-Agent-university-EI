import { GaConfig } from "@/lib/core/genetic";

/**
 * Named parameter presets used by the tutorial's prediction/comparison/challenge steps. Each
 * preset (besides "Padrão") changes exactly ONE knob relative to "Padrão" - isolating the effect
 * of that one parameter, the way the user's own instructions ask for ("testar de novo com
 * parâmetros diferentes"). All presets share the same fixed seed so every run faces the identical
 * sequence of random draws (initial population, tournament picks) - differences in outcome come
 * only from the parameter itself, never from lucky/unlucky randomness.
 */
export const GA_TUTORIAL_SEED = 87234561;
export const GA_TUTORIAL_GENERATIONS = 30;

export type GaPresetId = "baixa-mutacao" | "padrao" | "alta-mutacao" | "populacao-pequena";

export interface GaPreset {
  id: GaPresetId;
  label: string;
  populationSize: number;
  mutationRate: number;
  crossoverRate: number;
  eliteCount: number;
  tournamentSize: number;
}

export const GA_PRESETS: GaPreset[] = [
  { id: "baixa-mutacao", label: "Mutação baixa (2%)", populationSize: 40, mutationRate: 0.02, crossoverRate: 0.7, eliteCount: 3, tournamentSize: 4 },
  { id: "padrao", label: "Padrão (15%)", populationSize: 40, mutationRate: 0.15, crossoverRate: 0.7, eliteCount: 3, tournamentSize: 4 },
  { id: "alta-mutacao", label: "Mutação alta (50%)", populationSize: 40, mutationRate: 0.5, crossoverRate: 0.7, eliteCount: 3, tournamentSize: 4 },
  { id: "populacao-pequena", label: "População pequena (8)", populationSize: 8, mutationRate: 0.15, crossoverRate: 0.7, eliteCount: 1, tournamentSize: 3 },
];

export function presetToConfig(preset: GaPreset, generations = GA_TUTORIAL_GENERATIONS): GaConfig {
  return {
    populationSize: preset.populationSize,
    generations,
    eliteCount: preset.eliteCount,
    mutationRate: preset.mutationRate,
    crossoverRate: preset.crossoverRate,
    tournamentSize: preset.tournamentSize,
    seed: GA_TUTORIAL_SEED,
  };
}
