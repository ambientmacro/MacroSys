# Manual da Segurança do Trabalho — MACRO AMBIENTAL

> Versão Fev/2026 · 1 página · foco em templates e vistorias.

---

## O que você faz no sistema

- Cria/edita os **Templates de Checklist** (1 por tipo de equipamento).
- Aprova/reprova a **Vistoria do fluxo** de cada Requerimento de veículo.
- Faz a **Revisão semestral** dos templates (6 meses).

---

## Suas telas

### ?? Templates de Checklist (`/templates`)
Novo template ? define **nome** (= tipo do equipamento) ? adiciona itens:
- **Texto** ("Verificar nível de óleo")
- **Tipo**: Conforme/Não Conforme · Texto · Número · Foto
- **Obrigatório** (sim/não)
- **Habilitado por padrão** (já vem marcado como Conforme para o motorista)
- **Permitir foto** (motorista pode anexar)

> Só **1 template por tipo** — o sistema bloqueia duplicatas.

### ? Vistorias do fluxo (`/vistorias`)
Requerimentos aprovados pelo DP aparecem aqui. Abra o item ? vincula template ? preenche itens documentais/técnicos ? **Aprova** (vai para Frota) ou **Reprova** (veículo não entra).

### ?? Revisão de Templates (`/templates/revisao`)
A cada 6 meses aparece alerta para você revisar o template — confirme os itens e a versão fica registrada em `templateRevision`.

---

## Regras que você precisa saber

| Regra | Por quê |
|---|---|
| **Vistoria do fluxo ? Vistoria de Entrada**. Você faz a documental; a Frota faz a operacional (1ª execução). | Momentos diferentes do fluxo. |
| Sem template vinculado ao equipamento, motorista não consegue lançar checklist. | Prevenção operacional. |
| Legendas (VD/AZ/AM/VM) podem ser vinculadas por item. | Item crítico bloqueia veículo automaticamente. |

---

## FAQ rápido

**Consigo copiar um template existente?**
Ainda não — na versão atual, criar novo do zero. No roadmap: função "clonar template".

**Como sei se algum motorista marcou item crítico como Não Conforme?**
Veja `/checklists/painel` — contador de "Não-conformes" e o card mostra em vermelho. Detalhe do checklist expõe o alerta.

**Item de foto opcional deve virar obrigatório?**
Sim para itens de risco alto (freio, iluminação). Ajuste na edição do template e faça revisão semestral.
