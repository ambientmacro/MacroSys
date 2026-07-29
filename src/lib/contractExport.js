import { REQ_TYPE_LABEL, EQUIPAMENTO_TIPOS, SUB_TIPOS_LABEL, ORIGEM_TIPOS } from "./constants";
import { formatCurrency } from "./vehicleTypes";

/**
 * Exportador de Contrato em Microsoft Word.
 *
 * Estratégia: gera um documento HTML com cabeçalho MS Office que o Word
 * abre nativamente como `.doc`. Vantagens vs lib externa:
 *  - zero dependências (0KB extra no bundle)
 *  - editável diretamente no Word
 *  - imprime/exporta PDF nativamente
 *
 * Limitação: o `.doc` é um HTML enriquecido, então recursos avançados
 * (sumário, índice, macros) não funcionam. Para o nosso caso — contrato
 * básico que o DP imprime, assina e arquiva — é suficiente.
 */

const escape = (s) => String(s ?? "—")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fmtDate = (s) => {
  if (!s) return "—";
  try {
    if (typeof s === "string" && s.length === 10) {
      const [y, m, d] = s.split("-");
      return `${d}/${m}/${y}`;
    }
    return new Date(s).toLocaleDateString("pt-BR");
  } catch { return String(s); }
};

const hoje = () => new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

/**
 * Monta o HTML do contrato a partir do requerimento.
 */
const buildContractHTML = (req) => {
  const d = req.data || {};
  const isVeiculo = req.type === "VEICULO" || req.type === "VEICULO_MOTORISTA";
  const isMotorista = req.type === "MOTORISTA" || req.type === "VEICULO_MOTORISTA";
  const origemLabel = ORIGEM_TIPOS.find((o) => o.id === d.origem)?.label || d.origem || "—";
  const equipLabel = EQUIPAMENTO_TIPOS.find((e) => e.id === d.equipamento_tipo)?.label || d.equipamento_tipo || "—";
  const subTipo = d.sub_tipo ? SUB_TIPOS_LABEL[d.sub_tipo] : null;
  const tipoSnap = d.tipoSnapshot || null;
  const respLegal = d.motorista_eh_responsavel_legal === false ? {
    nome: d.responsavel_legal_nome,
    cpfCnpj: d.responsavel_legal_cpf_cnpj,
    telefone: d.responsavel_legal_telefone,
    email: d.responsavel_legal_email,
    banco: d.responsavel_legal_banco,
    agencia: d.responsavel_legal_agencia,
    conta: d.responsavel_legal_conta,
    pix: d.responsavel_legal_pix,
  } : null;

  // CSS embutido — o Word interpreta margins, tabelas, fonts simples.
  const style = `
    body { font-family: 'Calibri', Arial, sans-serif; font-size: 11pt; color: #000; line-height: 1.5; }
    h1 { font-size: 16pt; text-align: center; margin: 0 0 6pt 0; }
    h2 { font-size: 12pt; margin-top: 14pt; border-bottom: 1px solid #888; padding-bottom: 2pt; }
    .header { text-align: center; margin-bottom: 18pt; }
    .header .sub { font-size: 10pt; color: #444; }
    table { border-collapse: collapse; width: 100%; margin-top: 4pt; }
    table.fields td { padding: 4pt 8pt; border: 1px solid #aaa; vertical-align: top; }
    table.fields td.label { background: #eee; font-weight: bold; width: 28%; }
    .clausula { text-align: justify; margin: 8pt 0; }
    .assinatura { margin-top: 36pt; display: table; width: 100%; }
    .assinatura .col { display: table-cell; width: 50%; text-align: center; vertical-align: bottom; padding: 0 12pt; }
    .linha { border-top: 1px solid #000; padding-top: 4pt; font-size: 9pt; }
    .protocolo { font-size: 9pt; color: #666; text-align: right; margin-top: 24pt; }
  `;

  const blocoVeiculo = isVeiculo ? `
    <h2>2. IDENTIFICAÇÃO DO EQUIPAMENTO</h2>
    <table class="fields">
      <tr><td class="label">TAG / Identificação</td><td>${escape(d.tag || "—")}</td></tr>
      <tr><td class="label">Placa</td><td>${escape(d.placa || "Sem placa (equipamento)")}</td></tr>
      <tr><td class="label">Categoria</td><td>${escape(equipLabel)}${subTipo ? " · " + escape(subTipo) : ""}</td></tr>
      <tr><td class="label">Marca / Modelo</td><td>${escape(d.marca)} ${escape(d.modelo)}</td></tr>
      <tr><td class="label">Ano de Fabricação</td><td>${escape(d.ano)}</td></tr>
      <tr><td class="label">Combustível</td><td>${escape(d.combustivel)}</td></tr>
      <tr><td class="label">Horímetro inicial</td><td>${escape(d.horimetro || "—")}</td></tr>
      <tr><td class="label">Quilometragem inicial</td><td>${escape(d.quilometragem || "—")}</td></tr>
      <tr><td class="label">Origem</td><td>${escape(origemLabel)}</td></tr>
      <tr><td class="label">Vencimento CRLV</td><td>${fmtDate(d.vencimento_crlv)}</td></tr>
      ${d.observacoes_veiculo ? `<tr><td class="label">Observações</td><td>${escape(d.observacoes_veiculo)}</td></tr>` : ""}
    </table>
  ` : "";

  const blocoMotorista = isMotorista ? `
    <h2>${isVeiculo ? "3" : "2"}. IDENTIFICAÇÃO DO MOTORISTA / OPERADOR</h2>
    <table class="fields">
      <tr><td class="label">Nome completo</td><td>${escape(d.motorista_nome)}</td></tr>
      <tr><td class="label">CPF / CNH</td><td>${escape(d.motorista_cnh)}</td></tr>
      <tr><td class="label">Categoria CNH</td><td>${escape(d.motorista_categoria)}</td></tr>
      <tr><td class="label">Validade CNH</td><td>${fmtDate(d.motorista_validade_cnh)}</td></tr>
      <tr><td class="label">Data de nascimento</td><td>${fmtDate(d.motorista_data_nasc)}</td></tr>
      <tr><td class="label">Telefone</td><td>${escape(d.motorista_telefone)}</td></tr>
      <tr><td class="label">E-mail</td><td>${escape(d.motorista_email || "—")}</td></tr>
      <tr><td class="label">Endereço</td><td>${escape(d.motorista_endereco || "—")}</td></tr>
      <tr><td class="label">Função / Cargo</td><td>${escape(d.motorista_funcao || "—")}</td></tr>
      <tr><td class="label">Validade do ASO</td><td>${fmtDate(d.motorista_aso_validade)}</td></tr>
    </table>
  ` : "";

  const blocoRespLegal = respLegal ? `
    <h2>${isVeiculo && isMotorista ? "4" : isVeiculo ? "3" : "3"}. RESPONSÁVEL LEGAL PELO EQUIPAMENTO</h2>
    <table class="fields">
      <tr><td class="label">Nome / Razão Social</td><td>${escape(respLegal.nome)}</td></tr>
      <tr><td class="label">CPF / CNPJ</td><td>${escape(respLegal.cpfCnpj)}</td></tr>
      <tr><td class="label">Telefone</td><td>${escape(respLegal.telefone)}</td></tr>
      <tr><td class="label">E-mail</td><td>${escape(respLegal.email)}</td></tr>
      <tr><td class="label">Dados bancários</td><td>
        Banco: ${escape(respLegal.banco)}<br/>
        Agência: ${escape(respLegal.agencia)}<br/>
        Conta: ${escape(respLegal.conta)}<br/>
        PIX: ${escape(respLegal.pix)}
      </td></tr>
    </table>
  ` : (isVeiculo && isMotorista ? `
    <h2>4. RESPONSÁVEL LEGAL</h2>
    <p>O próprio motorista identificado acima é, para todos os efeitos, o responsável legal pelo equipamento descrito.</p>
  ` : "");

  const blocoValores = tipoSnap ? `
    <h2>${[isVeiculo, isMotorista, respLegal].filter(Boolean).length + 2}. VALORES E CONDIÇÕES FINANCEIRAS</h2>
    <table class="fields">
      <tr><td class="label">Tipo de veículo (catálogo)</td><td>${escape(tipoSnap.nome)}</td></tr>
      <tr><td class="label">Valor mensal</td><td><strong>${escape(formatCurrency(tipoSnap.valorMensal))}</strong></td></tr>
      <tr><td class="label">Hora extra</td><td>${escape(formatCurrency(tipoSnap.valorHoraExtra))} / hora</td></tr>
      <tr><td class="label">Dia extra (fim de semana / feriado)</td><td>${escape(formatCurrency(tipoSnap.valorDiaExtra))} / dia</td></tr>
      <tr><td class="label">Horário normal</td><td>Segunda a Quinta: 7h às 17h · Sexta: 7h às 16h</td></tr>
    </table>
  ` : (isVeiculo && d.valor_aluguel ? `
    <h2>${[isVeiculo, isMotorista, respLegal].filter(Boolean).length + 2}. VALORES</h2>
    <table class="fields">
      <tr><td class="label">Valor mensal</td><td><strong>${escape(formatCurrency(d.valor_aluguel))}</strong></td></tr>
    </table>
  ` : "");

  return `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8" />
  <title>Contrato — ${escape(d.tag || d.placa || req.id)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotPromptForConvert/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>${style}</style>
</head>
<body>
  <div class="header">
    <h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS / LOCAÇÃO</h1>
    <div class="sub"><strong>MACRO AMBIENTAL</strong> — Gestão de Frota</div>
    <div class="sub">Protocolo nº ${escape(req.id?.slice(0, 10).toUpperCase())} — Emitido em ${escape(hoje())}</div>
  </div>

  <h2>1. PARTES</h2>
  <p class="clausula">
    <strong>CONTRATANTE:</strong> ${escape(d.empresa || "Macro Ambiental")}, inscrita no centro de custo
    <strong>${escape(d.centro_custo || "—")}</strong>, doravante denominada simplesmente CONTRATANTE.
  </p>
  <p class="clausula">
    <strong>CONTRATADO:</strong> ${escape(respLegal?.nome || d.motorista_nome || d.contrato || "—")}${respLegal?.cpfCnpj ? `, CPF/CNPJ ${escape(respLegal.cpfCnpj)}` : ""},
    doravante denominado simplesmente CONTRATADO.
  </p>

  ${blocoVeiculo}
  ${blocoMotorista}
  ${blocoRespLegal}
  ${blocoValores}

  <h2>CLÁUSULAS GERAIS</h2>
  <p class="clausula"><strong>1ª.</strong> O presente contrato tem por objeto a ${isMotorista && !isVeiculo ? "prestação de serviços do operador/motorista identificado" : "locação/prestação do equipamento identificado, juntamente com seu motorista, quando aplicável"} à CONTRATANTE, conforme dados acima.</p>
  <p class="clausula"><strong>2ª.</strong> O CONTRATADO declara estar ciente e de acordo com a política de checklist diário, vistoria de entrada e demais procedimentos operacionais da CONTRATANTE.</p>
  <p class="clausula"><strong>3ª.</strong> Os valores acordados serão pagos conforme dados bancários informados, mediante apresentação dos respectivos relatórios mensais.</p>
  <p class="clausula"><strong>4ª.</strong> Eventuais horas e dias extras serão remunerados conforme valores estabelecidos no Item 5, respeitando o calendário operacional da CONTRATANTE.</p>
  <p class="clausula"><strong>5ª.</strong> O presente contrato vigora a partir de sua assinatura e somente poderá ser rescindido conforme acordo das partes.</p>

  <div class="assinatura">
    <div class="col">
      <div class="linha">CONTRATANTE<br/>${escape(d.empresa || "Macro Ambiental")}</div>
    </div>
    <div class="col">
      <div class="linha">CONTRATADO<br/>${escape(respLegal?.nome || d.motorista_nome || d.contrato || "—")}</div>
    </div>
  </div>

  <div class="protocolo">
    Documento gerado automaticamente pelo sistema MACRO AMBIENTAL · ${escape(hoje())}
  </div>
</body>
</html>`;
};

/**
 * Dispara o download do contrato como `.doc` (Word abre nativamente).
 * Nome do arquivo: Contrato_<TAG ou Placa>_<DataISO>.doc
 */
export const exportContractDoc = (req) => {
  const d = req.data || {};
  const idTag = d.tag || d.placa || req.id?.slice(0, 8) || "requerimento";
  const dataIso = new Date().toISOString().slice(0, 10);
  const fileName = `Contrato_${String(idTag).replace(/[^\w-]/g, "_")}_${dataIso}.doc`;

  const html = buildContractHTML(req);
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
};
