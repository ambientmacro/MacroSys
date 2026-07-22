# Manual do Encarregado — MACRO AMBIENTAL

> Versão Fev/2026 · 1 página · foco na gestão da equipe.

---

## O que você faz no sistema

- Abre **Indicações** de necessidade (motorista/veículo) — o Frota converte em Requerimento formal.
- Acompanha os **checklists da sua equipe**.
- Lança checklist manual quando o motorista respondeu no papel.
- Cria login para motoristas da sua equipe já aprovados pelo DP.

---

## Suas telas

### ?? Indicações (`/indicacoes` e `/indicacoes/nova`)
Você **não cria Requerimento diretamente** — abre uma **Indicação de necessidade** contando o que precisa (novo motorista, veículo específico, etc.). O Adm de Frota recebe e converte em Requerimento formal. Status: ABERTA / CONVERTIDA / DESCARTADA.

### ?? Meus Checklists (`/checklists`)
Aparecem automaticamente **só os da sua equipe** (banner azul confirma "Filtrando pela sua equipe: <nome> · N membros"). Toque em qualquer para ver detalhes + imprimir PDF.

### ?? Painel de Checklists (`/checklists/painel`)
Contadores em tempo real: **Total ativo · OK · Pendentes · Não-conformes** — só dos veículos da sua equipe.

### ?? Checklist Manual (`/checklist/manual`)
Quando o motorista preencheu no papel:
1. Selecione o motorista da sua equipe.
2. Veículo padrão vem sugerido.
3. Preencha item a item.
4. Salvar.

### ?? Usuários (`/users`) — criar login de motorista
No bloco **"Aprovados pelo DP · sem login"**, encontre o motorista da sua equipe ? **Criar login** ? escolha *E-mail* ou *Matrícula 7 dígitos* ? defina senha ? 6 caracteres ? entregue ao motorista.

> Você só vê motoristas da **sua equipe** — o DP monta a equipe em `/teams`.

---

## Regras que você precisa saber

| Regra | Por quê |
|---|---|
| Não é possível ver dados de outras equipes. | Cada Encarregado gere só a própria. |
| Só cria login para motoristas **já aprovados pelo DP**. | Garante autorização formal antes do acesso. |
| Indicação ? Requerimento. | Você indica; Frota formaliza no fluxo. |

---

## FAQ rápido

**Motorista aprovado não aparece em "Criar Login".**
Confirma com o DP se ele foi vinculado à sua equipe (`/teams`).

**Foto do checklist sumiu ao imprimir.**
Fotos ficam em Base64 no doc — imprime direto do sistema (Ctrl+P) que aparece.

**Quero exportar em Excel a lista de checklists.**
Peça ao TI (BackupAdmin) — ele exporta com filtros por role e formato XLSX+ZIP (com mídias).
