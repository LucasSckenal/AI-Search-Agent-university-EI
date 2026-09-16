import Link from "next/link";
import { Icon } from "@/components/shared/Panel";

export const metadata = {
  title: "Tutorial — Agentes de Busca",
};

interface Family {
  href: string | null;
  icon: string;
  title: string;
  desc: string;
}

const FAMILIES: Family[] = [
  {
    href: "/tutorial/busca",
    icon: "hub",
    title: "Busca em Grafo",
    desc: "BFS, DFS, Custo Uniforme, Gulosa e A* resolvendo o mesmo labirinto - preveja, execute de verdade e entenda cada decisão.",
  },
  {
    href: "/tutorial/adversarial",
    icon: "sports_esports",
    title: "Busca Adversarial",
    desc: "Minimax e poda Alfa-Beta pensando nas jogadas de um oponente - preveja a jogada, execute a busca real e entenda cada nó da árvore.",
  },
  {
    href: "/tutorial/csp",
    icon: "rule",
    title: "Restrições (CSP)",
    desc: "Backtracking e Forward Checking podando candidatos inválidos antes de testá-los - preveja os retrocessos, execute a busca real e entenda cada coluna.",
  },
  {
    href: "/tutorial/reforco",
    icon: "psychology",
    title: "Aprendizado por Reforço",
    desc: "Um agente aprendendo por tentativa e erro, sem conhecer o mapa de antemão - preveja se ele vai aprender a tempo, execute o treino real e entenda cada episódio.",
  },
  {
    href: "/tutorial/genetico",
    icon: "biotech",
    title: "Otimização (Algoritmo Genético)",
    desc: "Uma população inteira de soluções evoluindo por seleção, cruzamento e mutação - preveja, execute de verdade e entenda cada geração.",
  },
  {
    href: "/tutorial/probabilisticos",
    icon: "insights",
    title: "Probabilísticos",
    desc: "Decisões sob incerteza, guiadas por estimativas e heurísticas - preveja o que acontece quando a lógica trava, execute a inferência real e entenda cada célula.",
  },
];

export default function TutorialPage() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-6">
      <div className="content-head">
        <div>
          <div className="content-kicker">
            <span>Tutorial</span>
          </div>
          <h1 className="content-title">Escolha uma família de algoritmos</h1>
          <p className="content-sub">
            Um laboratório interativo de verdade: você prevê, executa o algoritmo real e entende por que ele decidiu o
            que decidiu - nunca uma animação encenada.
          </p>
        </div>
      </div>

      <div className="lab-family-grid">
        {FAMILIES.map((f) =>
          f.href ? (
            <Link key={f.title} href={f.href} className="lab-family-card">
              <span className="lab-family-card-icon">
                <Icon name={f.icon} className="text-[20px]" />
              </span>
              <span className="lab-family-card-title">{f.title}</span>
              <p className="lab-family-card-desc">{f.desc}</p>
              <span className="lab-family-card-badge ready">Disponível</span>
            </Link>
          ) : (
            <div key={f.title} className="lab-family-card disabled">
              <span className="lab-family-card-icon">
                <Icon name={f.icon} className="text-[20px]" />
              </span>
              <span className="lab-family-card-title">{f.title}</span>
              <p className="lab-family-card-desc">{f.desc}</p>
              <span className="lab-family-card-badge soon">Em breve</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
