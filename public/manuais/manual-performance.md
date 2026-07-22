# Manual do Perfil Performance — MACRO AMBIENTAL

> Versão Fev/2026 · 1 página · foco em equipes e cargos.

---

## O que você faz no sistema

- Gerencia o **catálogo de Funções / Cargos** (o Wizard puxa as funções ativas).
- Estrutura organizacional das **Equipes** (junto com o DP).

---

## Suas telas

### 🧾 Funções / Cargos (`/funcoes`)
CRUD do catálogo:
- **Nome** ("Operador de Retroescavadeira", "Motorista Caminhão Muck", "Ajudante de Obras")
- **Descrição** opcional
- **Ativo** (sim/não)

> Quando o Encarregado abre a Indicação ou o Frota abre o Requerimento de motorista, o campo **Função** vira um `<select>` puxando as funções ativas daqui. Nada de digitar cargo em texto livre.

### 👥 Equipes (`/teams`)
Acesso compartilhado com o DP. Você cuida da parte organizacional (definir encarregado + motoristas que a compõem).

### 📊 Frota Custos (`/frota/custos`)
Visualização em modo consulta — para você acompanhar os custos por equipe/tipo.

### 📊 Relatórios (`/frota/relatorios`)
KPIs gerais em consulta.

---

## Regras que você precisa saber

| Regra | Por quê |
|---|---|
| Função inativa some do combo do Wizard. | Evita cadastrar motorista em cargo obsoleto. |
| Excluir função não deleta motoristas com aquele cargo. | Preserva histórico. |
| Você **não** aprova Requerimentos — quem aprova é DP + Segurança. | Papéis separados. |

---

## FAQ rápido

**Preciso renomear um cargo (ex.: "Operador Retro" → "Operador Retroescavadeira").**
Edite direto — a alteração aparece em novos requerimentos. Motoristas antigos mantêm o nome que foi gravado no snapshot.

**Consigo ver a produtividade por cargo?**
Ainda não — no roadmap. Hoje você acompanha via `/frota/custos` e `/frota/relatorios`.

**Quero criar uma nova equipe.**
Vá em `/teams` → **Nova Equipe** → nome + encarregado + membros. `teamId` propaga automaticamente.
