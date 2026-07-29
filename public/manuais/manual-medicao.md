# Manual do Perfil Medição — MACRO AMBIENTAL

> Versão Fev/2026 · 1 página · foco no catálogo de tipos e custos.

---

## O que você faz no sistema

- Gerencia o **catálogo de Tipos de Veículo** (valores mensais, hora extra, dia extra).
- Acompanha os **custos** consolidados da frota (agregados).
- É o único perfil que altera valores de aluguel para os veículos alugados (após ativação).

---

## Suas telas

### ?? Tipos de Veículo (`/tipos-veiculo`)
CRUD do catálogo. Cada tipo tem:
- **Nome** (ex.: "Caminhão Basculante Toco")
- **Categoria / Sub-tipo** (Toco / Truck / 3/4 / Cavalinho / Basculante / Prancha)
- **Porte** (Pesado / Leve)
- **Medição** (KM / Horímetro)
- **Valor mensal** (R$)
- **Hora extra** (R$/h)
- **Dia extra** (R$/dia)
- **Ativo** (sim/não)
- **`historicoValores[]`** — snapshot imutável de cada alteração (auditoria de preços)

> Quando o Frota cria um Requerimento com origem "Alugado *", o campo de valor manual **some** e aparece um `<select>` puxando deste catálogo. O Wizard grava um `tipoSnapshot` no requerimento (imutável) — mesmo que você atualize o valor depois, o veículo já criado mantém o valor original.

### ?? Frota Custos (`/frota/custos`)
Você vê os agregados: custo mensal por Tipo, por Equipe, por Porte. Comparativos entre períodos.

### ?? Relatórios (`/frota/relatorios`)
KPIs gerais da frota — em modo consulta.

---

## Regras que você precisa saber

| Regra | Por quê |
|---|---|
| Alterar valor gera **snapshot imutável** em `historicoValores`. | Trilha de auditoria de preços. |
| Veículos já ativos mantêm o `tipoSnapshot` do momento da aprovação. | Contrato não muda retroativamente. |
| Você não altera **origem** do veículo (isso é Frota). | Separação de responsabilidades. |

---

## FAQ rápido

**Corrigi um valor errado — os veículos ativos vão ser recalculados?**
Não. O contrato do veículo carrega o `tipoSnapshot` original. Novos requerimentos usam o valor atualizado.

**Preciso desativar um tipo obsoleto.**
Marque **Ativo: Não** — ele some das opções nos novos Requerimentos, mas continua visível nos veículos que já o usaram.

**Como exporto o histórico de preços?**
Peça ao TI ? BackupAdmin ? coleção `vehicleTypes` no JSON (contém `historicoValores[]`).
