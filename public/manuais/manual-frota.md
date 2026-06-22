# Manual do Administrador de Frota — MACRO AMBIENTAL

> Guia rápido para quem gerencia veículos, custos e relatórios da frota.

---

## Visão geral do seu papel

Você é o **dono operacional dos veículos**. Recebe o equipamento, libera para uso e acompanha os custos.

Suas responsabilidades:

1. **Configurar o veículo** após a aprovação do DP e da Segurança.
2. **Fazer a Vistoria de Entrada** (1ª execução de checklist do veículo).
3. **Vincular motorista titular** e **template padrão** ao veículo.
4. **Acompanhar relatórios** de custo, patrimônio, idade da frota e vencimentos.
5. **Criar login** para motoristas da sua equipe (quando necessário).

> Você vê apenas os veículos e motoristas das suas equipes.

---

## 1. Lista de veículos

Menu **"Veículos"**.

Cada card mostra:
- **TAG · Placa** (chip azul-marinho quando há placa)
- Marca, modelo, ano
- **Valor mensal de aluguel** + origem (próprio / alugado / prestação)
- **Alerta de CRLV** (badge âmbar = vencendo em ?30 dias; badge vermelho = vencido)
- Status: PRÉ-CADASTRADO, AGUARDANDO ATIVAÇÃO, ATIVO, INATIVO

Toque em qualquer card para abrir o detalhe.

---

## 2. Configurar um veículo novo

Menu **"Veículos"** ? toque no card ? **"Editar"**.

Existem **3 blocos** para preencher:

### Bloco 1 — Identificação
- TAG (patrimonial)
- **Placa** (opcional — equipamentos sem emplacamento ficam vazios; quando preenchida, é única no sistema)
- Marca / Modelo / Ano

### Bloco 2 — Custos e Gestão (esta é a parte que alimenta os relatórios)
- **Origem:** próprio / alugado / prestação de serviço
- **Valor mensal de aluguel** (R$) — **OBRIGATÓRIO**, mesmo para veículos próprios (auto-aluguel interno para fins de relatório de custo).
- **Valor de patrimônio** (R$) — usado em depreciação dos próprios.
- **Data de aquisição** — usado para cálculo de idade da frota.
- **Vencimento do CRLV** — gera os alertas no Dashboard e nos Relatórios.
- **Equipe responsável** — combina com a estrutura criada pelo DP.

### Bloco 3 — Vínculos operacionais
- **Motorista titular** — quem é o "dono" desse equipamento no dia a dia. Quando ele logar, o veículo já vem auto-selecionado no checklist.
- **Template de checklist** — escolha o template criado pela Segurança do Trabalho (ex.: "Retroescavadeira", "Caminhão Toco").

**Salve.**

---

## 3. Fazer a Vistoria de Entrada (1ª execução)

Após configurar o veículo, você precisa fazer a **Vistoria de Entrada** — a primeira execução do checklist desse veículo.

> Só o Adm de Frota (ou Admin TI) pode fazer essa primeira execução. Motorista e Encarregado ficam bloqueados até você liberar.

Menu **"Lançar Checklist (papel)"**.

1. Selecione o veículo recém-configurado.
2. O sistema detecta automaticamente que é a 1ª execução e mostra:
   > ?? *"1ª execução deste veículo — Vistoria de Entrada. Esta é a única vez que o checklist é lançado pelo Adm de Frota..."*
3. Preencha os itens do template.
4. Clique em **"Registrar Vistoria de Entrada"**.

A partir desse momento, o veículo está liberado. Motorista e Encarregado podem lançar checklist diário normalmente.

---

## 4. Relatórios da Frota

Menu **"Relatórios Frota"**.

### KPIs no topo (4 cards):

- **Total de veículos** — separados por origem (próprios / alugados / prestação)
- **Patrimônio total (próprios)** — soma do valor de patrimônio dos veículos próprios
- **Custo mensal de aluguel** — terceiros + auto-aluguel interno (soma de tudo)
- **Idade média da frota** — calculada com base em ano de fabricação ou data de aquisição

### Seção "CRLV — Vencimentos críticos"

Lista os veículos com CRLV vencido (vermelho) ou vencendo em ?30 dias (âmbar). Cada item linka direto para o detalhe do veículo. Use isso para **gerar a fila de licenciamentos pendentes**.

### Seção "Alocação por equipe"

Mostra quantos veículos cada equipe tem e quanto custam por mês (soma do valor de aluguel). Útil para alocação de orçamento e conferência operacional.

---

## 5. Criar login de motorista (quando preciso)

Menu **"Criar Login Motorista"**.

Mesma lógica do Encarregado: vê motoristas **das suas equipes** que estão aprovados pelo DP mas sem login.

Clique em **"Criar login"** ? escolha **E-mail** ou **Matrícula 7 dígitos** ? defina senha ? entregue.

---

## 6. Imprimir relatório

A página de Relatórios não tem botão de exportação direta. Para gerar um documento:

1. Abra a página `/frota/relatorios`.
2. Use **Ctrl+P** (Windows) ou **Cmd+P** (Mac).
3. Salve como PDF na impressão do navegador.

> Exportação para Excel/CSV está no roadmap.

---

## 7. Quem é quem

| Situação | Quem procurar |
|---|---|
| Veículo recém-aprovado precisa de template | Pedir Segurança do Trabalho criar/vincular |
| Motorista não aparece no select de titular | Verificar com DP se foi aprovado e incluído na equipe |
| CRLV vencendo em massa | Você decide priorização do licenciamento |
| Equipe nova surgindo na operação | Pedir DP criar em `/teams` |
| Erros no sistema | Administrador TI |

---

**Bom trabalho e boa gestão da frota!**
