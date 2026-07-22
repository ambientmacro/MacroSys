# Manual do Administrador de Frota — MACRO AMBIENTAL

> Versão Fev/2026 · 1 página · foco em veículos, custos e vistoria de entrada.

---

## O que você faz no sistema

- Recebe **Indicações** dos Encarregados e converte em **Requerimentos** (Wizard).
- Aprova/configura veículos aprovados pelo DP.
- Lança a **Vistoria de Entrada** (1ª execução do checklist).
- Acompanha custos, relatórios da frota e importa dados do **GETRAK**.

---

## Suas telas

### 📩 Indicações (`/indicacoes`)
Lista das indicações abertas pelos Encarregados. Botão **"Converter em Requerimento"** abre o Wizard já com o contexto (`?fromIndicacao=<id>`).

### 🧙 Wizard de Requerimento (`/requerimentos/novo`)
7 etapas: Tipo → Dados → Adicionais → Documentos → Detalhes → Revisão → Conclusão. Fluxo **em cascata**: **Porte → Categoria → Subtipo → Tipo** (ex.: Pesado → Caminhões → Toco → Basculante). Regras críticas:
- Ano fabricação **sempre obrigatório**.
- Retroescavadeira, Escavadeira, Rolo Compactador → **Horímetro**. Demais → **Quilometragem**.
- Origem "Alugado *" → some o input manual de valor e aparece **Tipo de Veículo** (catálogo do Medição) que puxa valores e grava snapshot imutável.
- Dados bancários: **PIX** OU **Banco+Agência+Conta** (uma das duas combinações obrigatória).

### 🚗 Veículos (`/veiculos` e `/veiculos/:id`)
Lista com placa, TAG, alertas visuais de CRLV. Detalhe traz 3 blocos:
1. **Identificação** (TAG, placa, marca, modelo, ano).
2. **Custos e Gestão** — valor mensal, patrimônio, aquisição, CRLV, equipe responsável.
3. **Vínculos operacionais** — motorista titular + template de checklist.

### 📋 Vistoria de Entrada (`/checklist/manual`)
Quando o veículo estiver `PENDING_ACTIVATION`, você lança a **1ª execução** — banner azul confirma "1ª execução deste veículo — Vistoria de Entrada" e o botão vira "Registrar Vistoria de Entrada". A partir daí o motorista pode operar.

### 📊 Relatórios (`/frota/relatorios` e `/frota/custos`)
KPIs: total, patrimônio, custo mensal, idade média. Vencimentos críticos de CRLV. Alocação por equipe. Custos: agregados por porte, tipo, equipe.

### 🛰 Importação GETRAK (`/getrak`)
Faz upload do Excel do sistema terceiro (deslocamentos + paradas). Relaciona automaticamente pela placa, mostra hora total, ocioso, quilometragem, locais e coordenadas.

### 🧾 Painel de Checklists (`/checklists/painel`)
Contadores em tempo real de todos os veículos ativos.

---

## Regras que você precisa saber

| Regra | Por quê |
|---|---|
| Não altere **Origem** e **Valor de aluguel** após o veículo ativo — quem faz isso é o **Medição**. | Trilha de custo confiável. |
| Só você (ou Admin) pode lançar a **Vistoria de Entrada**. | Garante inspeção antes do uso. |
| Motorista titular deve estar aprovado pelo DP. | Fluxo formal de autorização. |

---

## FAQ rápido

**Vistoria de Entrada não aparece o botão certo.**
Confirme que o veículo está com status `PENDING_ACTIVATION` (aprovado pelo DP + Segurança).

**Custo do aluguel está vindo bloqueado.**
Se a origem é *Alugado*, o valor vem do catálogo do Medição — vá em `/tipos-veiculo` (visualização).

**GETRAK importou dados errados.**
Confirme se as placas do relatório existem cadastradas — placas não encontradas ficam como TAG.
