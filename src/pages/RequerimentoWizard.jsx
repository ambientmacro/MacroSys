import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { addDoc, collection, serverTimestamp, getDocs, query, where, doc, updateDoc, getDoc, arrayUnion, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  REQ_TYPE, REQ_TYPE_LABEL, REQ_STATUS, VEHICLE_STATUS, DRIVER_STATUS, WIZARD_STEPS,
  EQUIPAMENTO_TIPOS, ORIGEM_TIPOS, ORIGENS_ALUGADAS, COMBUSTIVEIS, PORTE_VEICULO, CATEGORIAS_CNH,
  SUB_TIPOS_CAMINHAO, SUB_TIPOS_LABEL, getEquipamentoTipo,
} from "../lib/constants";
import { snapshotVehicleType, formatCurrency } from "../lib/vehicleTypes";
import { notifyWhatsApp } from "../lib/whatsapp";
import { toast } from "sonner";
import {
  CheckCircle, ArrowRight, ArrowLeft, FloppyDisk, Truck, User, UserCircle, FileText,
  Info, FileArrowUp, ArrowsLeftRight, X, House, CurrencyCircleDollar,
} from "@phosphor-icons/react";

const empty = {
  tipo: "",
  // Regime contratual: CLT (DP) vs NAO_CLT (Frota = terceirizados, alugados).
  // Default depende do perfil de quem cria — definido no useEffect inicial.
  regime: "",
  // veiculo
  porte: "",
  equipamento_tipo: "",
  equipamento_tipo_outro: "",
  // Sub-tipo aplicável a caminhões (toco/truck/3_4). Vazio para outros.
  sub_tipo: "",
  // Tipo de Veículo (do catálogo gerenciado pelo Medição) — selecionado
  // em veículos ALUGADOS. Puxa automaticamente o valor mensal/H.E./D.E.
  vehicleTypeId: "",
  tipoSnapshot: null,
  possui_tag: "sim",
  tag: "",
  placa: "",
  origem: "proprio",
  contrato: "",
  empresa: "Macro Ambiental",
  centro_custo: "",
  unidade: "",
  marca: "",
  modelo: "",
  ano: "",
  combustivel: "",
  // capacidade/potência removido conforme reunião 20/06/2026
  horimetro: "",
  quilometragem: "",
  valor_aquisicao: "",
  valor_aluguel: "",
  data_aquisicao: "",
  vencimento_crlv: "",
  observacoes_veiculo: "",
  motorista_eh_responsavel_legal: true,
  responsavel_legal_nome: "",
  responsavel_legal_cpf_cnpj: "",
  responsavel_legal_telefone: "",
  responsavel_legal_email: "",
  // Dados bancários do responsável legal (PIX OU Agência+Conta obrigatório).
  responsavel_legal_banco: "",
  responsavel_legal_agencia: "",
  responsavel_legal_conta: "",
  responsavel_legal_pix: "",
  // motorista
  motorista_nome: "",
  motorista_data_nasc: "",
  motorista_cnh: "",
  motorista_categoria: "",
  motorista_validade_cnh: "",
  motorista_funcao: "",
  motorista_telefone: "",
  motorista_email: "",
  motorista_endereco: "",
  motorista_aso_validade: "",
  motorista_observacoes: "",
  // shared
  documentos: [],
  crlv_anexo: null,
  cnh_anexo: null,
};

export default function RequerimentoWizard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [data, setData] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [createdReqId, setCreatedReqId] = useState(null);
  const [draftId, setDraftId] = useState(null);

  // Regime padrão por perfil: Frota cria NÃO-CLT (terceirizados); DP cria CLT.
  useEffect(() => {
    if (!data.regime && profile?.role) {
      const def = profile.role === "dp" ? "CLT" : "NAO_CLT";
      setData((p) => ({ ...p, regime: def }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.role]);

  // Carrega rascunho via ?draft={id} OU pre-seleciona tipo via ?tipo=
  useEffect(() => {
    const draft = searchParams.get("draft");
    const tipo = searchParams.get("tipo");
    if (draft) {
      (async () => {
        const snap = await getDoc(doc(db, "requerimentos", draft));
        if (snap.exists()) {
          const d = snap.data();
          if (d.status !== "RASCUNHO") {
            toast.error("Este requerimento já foi enviado e não pode mais ser editado como rascunho.");
            navigate(`/requerimentos/${draft}`);
            return;
          }
          if (d.createdByUserId !== profile.id) {
            toast.error("Somente quem criou o rascunho pode editá-lo.");
            navigate("/requerimentos");
            return;
          }
          setData({ ...empty, ...d.data, tipo: d.type });
          setDraftId(draft);
          setStep(2);
          toast.info("Rascunho carregado — continue de onde parou.");
        } else {
          toast.error("Rascunho não encontrado.");
          navigate("/requerimentos");
        }
      })();
    } else if (tipo && Object.values(REQ_TYPE).includes(tipo)) {
      setData((p) => ({ ...p, tipo }));
      setStep(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSteps = 7;
  const progress = useMemo(() => Math.round(((step - 1) / (totalSteps - 1)) * 100), [step]);

  const set = (k, v) => setData((p) => ({ ...p, [k]: v }));

  const hasVeiculo = data.tipo === REQ_TYPE.VEICULO || data.tipo === REQ_TYPE.VEICULO_MOTORISTA;
  const hasMotorista = data.tipo === REQ_TYPE.MOTORISTA || data.tipo === REQ_TYPE.VEICULO_MOTORISTA;
  const isAlugado = ORIGENS_ALUGADAS.includes(data.origem);
  const isProprio = data.origem === "proprio";

  // Catálogos do Medição (vehicleTypes) e Performance (funcoes) carregados em tempo real.
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [funcoes, setFuncoes] = useState([]);
  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "vehicleTypes"), where("ativo", "==", true)), (s) => {
      setVehicleTypes(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nome || "").localeCompare(b.nome || "")));
    });
    const u2 = onSnapshot(query(collection(db, "funcoes"), where("ativo", "==", true)), (s) => {
      setFuncoes(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nome || "").localeCompare(b.nome || "")));
    });
    return () => { u1(); u2(); };
  }, []);

  // Cfg do equipamento selecionado (porte, medição horímetro/km, sub-tipos).
  const equipCfg = useMemo(() => getEquipamentoTipo(data.equipamento_tipo), [data.equipamento_tipo]);
  const subTiposDisponiveis = equipCfg?.subTipos
    ? SUB_TIPOS_CAMINHAO.filter((s) => equipCfg.subTipos.includes(s.id))
    : [];
  const useHorimetro = equipCfg?.medicao === "horimetro";
  const useKm = equipCfg?.medicao === "km";

  // Tipos do catálogo aplicáveis ao equipamento + sub-tipo escolhido.
  const vehicleTypesAplicaveis = useMemo(() => {
    if (!data.equipamento_tipo) return vehicleTypes;
    return vehicleTypes.filter((vt) => {
      if (vt.categoria !== data.equipamento_tipo) return false;
      if (data.sub_tipo && vt.subTipo && vt.subTipo !== data.sub_tipo) return false;
      return true;
    });
  }, [vehicleTypes, data.equipamento_tipo, data.sub_tipo]);

  const validateCurrent = () => {
    if (step === 1 && !data.tipo) return "Selecione um tipo de requerimento.";
    if (step === 2) {
      if (hasVeiculo && !data.porte) return "Selecione o porte do veículo.";
      if (hasVeiculo && !data.equipamento_tipo) return "Selecione o tipo de equipamento.";
      if (hasVeiculo && data.equipamento_tipo === "outro" && !data.equipamento_tipo_outro) return "Especifique o tipo de equipamento.";
      if (hasVeiculo && subTiposDisponiveis.length > 0 && !data.sub_tipo) return "Selecione o sub-tipo (Toco / Truck / 3⁄4).";
      if (hasMotorista && !data.motorista_nome) return "Informe o nome do motorista.";
      if (hasMotorista && !data.motorista_cnh) return "Informe a CNH do motorista.";
    }
    if (step === 3) {
      if (hasVeiculo && data.possui_tag === "sim" && !data.tag.trim()) return "Informe o número da TAG.";
      if (hasMotorista && !data.motorista_telefone) return "Informe o telefone do motorista.";
    }
    if (step === 5) {
      if (hasVeiculo && (!data.marca || !data.modelo)) return "Marca e modelo são obrigatórios.";
      // Ano de fabricação OBRIGATÓRIO sempre (próprio ou alugado).
      if (hasVeiculo && (!data.ano || String(data.ano).length < 4)) return "Ano de fabricação é obrigatório.";
      // Horímetro / KM conforme tipo do equipamento.
      if (hasVeiculo && useHorimetro && !String(data.horimetro || "").trim()) return "Horímetro é obrigatório para este equipamento.";
      if (hasVeiculo && useKm && !String(data.quilometragem || "").trim()) return "Quilometragem é obrigatória para este equipamento.";
      if (hasVeiculo && isProprio) {
        if (!data.valor_aquisicao || Number(data.valor_aquisicao) <= 0) return "Valor de aquisição é obrigatório para veículo próprio.";
        if (!data.data_aquisicao) return "Data de aquisição é obrigatória para veículo próprio.";
      }
      if (hasVeiculo && isAlugado) {
        if (!data.vehicleTypeId) return "Selecione o Tipo de Veículo (definido pelo Medição) para puxar os valores.";
      }
      if (hasVeiculo && hasMotorista) {
        // Quando o motorista NÃO é o responsável legal, exigimos os dados
        // identificadores do terceiro (nome + telefone).
        if (data.motorista_eh_responsavel_legal === false) {
          if (!data.responsavel_legal_nome) return "Informe o nome do responsável legal pelo equipamento.";
          if (!data.responsavel_legal_telefone) return "Informe o telefone do responsável legal.";
        }
        // Dados bancários do responsável legal — regra de pagamento:
        //  OPÇÃO A: Banco + Agência + Conta (os 3 obrigatórios juntos), PIX opcional;
        //  OPÇÃO B: Só PIX (banco/ag/conta vazios).
        // Pelo menos UMA das opções precisa estar completa. NÃO pode haver
        // preenchimento parcial da conta (ex.: agência sem banco) — isso é erro.
        const banco = String(data.responsavel_legal_banco || "").trim();
        const ag = String(data.responsavel_legal_agencia || "").trim();
        const ct = String(data.responsavel_legal_conta || "").trim();
        const temPix = !!String(data.responsavel_legal_pix || "").trim();
        const contaCompleta = !!(banco && ag && ct);
        const contaParcial = !contaCompleta && (banco || ag || ct);
        if (contaParcial) return "Preencha Banco + Agência + Conta (os três juntos) — ou deixe todos em branco e use apenas o PIX.";
        if (!temPix && !contaCompleta) return "Informe os dados bancários do responsável legal: Banco+Agência+Conta OU PIX.";
      }
    }
    return null;
  };

  const handleNext = async () => {
    const err = validateCurrent();
    if (err) { toast.error(err); return; }
    // Bloqueios de duplicidade na etapa de identificação do equipamento:
    if (step === 3 && hasVeiculo && data.possui_tag === "sim" && data.tag.trim()) {
      const snap = await getDocs(query(collection(db, "vehicles"), where("tag", "==", data.tag.trim())));
      if (!snap.empty) { toast.error("Já existe veículo com essa TAG."); return; }
    }
    if (step === 3 && hasVeiculo && data.placa.trim()) {
      // Uniqueness de placa (case/formato-insensitive). Só checa se foi
      // preenchida — equipamentos sem emplacamento podem ficar em branco.
      const placaNorm = data.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      const snap = await getDocs(query(collection(db, "vehicles"), where("placaNormalizada", "==", placaNorm)));
      if (!snap.empty) { toast.error("Já existe veículo cadastrado com essa placa."); return; }
    }
    if (step < totalSteps) setStep(step + 1);
  };

  const prev = () => setStep((s) => Math.max(1, s - 1));

  const submit = async (asDraft = false) => {
    setSaving(true);
    try {
      let reqRef;
      // Status inicial depende do tipo:
      //   • VEÍCULO / VEÍCULO+MOTORISTA → vai DIRETO para a Segurança do
      //     Trabalho (`EM_ANALISE_SEGURANCA`). Lá o checklist é amarrado e
      //     a Vistoria de Entrada é realizada; só depois o DP arquiva o
      //     contrato. Pula a aprovação prévia do DP.
      //   • APENAS MOTORISTA → vai DIRETO para o DP finalizar (`PENDENTE`).
      const statusInicial = asDraft
        ? "RASCUNHO"
        : (hasVeiculo ? REQ_STATUS.EM_ANALISE_SEGURANCA : REQ_STATUS.PENDENTE);
      const acaoCriacao = asDraft
        ? "Rascunho enviado como requerimento"
        : (hasVeiculo
          ? "Requerimento criado — encaminhado direto para Segurança do Trabalho"
          : "Requerimento criado — encaminhado para o DP");
      const historyEntry = {
        at: new Date().toISOString(),
        action: asDraft ? "Rascunho atualizado" : (draftId ? acaoCriacao : "Requerimento criado"),
        by: profile.name,
        byRole: profile.role,
      };

      if (draftId) {
        // Atualiza o rascunho existente
        reqRef = doc(db, "requerimentos", draftId);
        await updateDoc(reqRef, {
          type: data.tipo,
          regime: data.regime || "NAO_CLT",
          status: statusInicial,
          data: { ...data },
          history: arrayUnion(historyEntry),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Cria novo
        const newReq = {
          type: data.tipo,
          regime: data.regime || "NAO_CLT",
          status: statusInicial,
          data: { ...data },
          createdByUserId: profile.id,
          createdByName: profile.name,
          createdByRole: profile.role,
          createdAt: serverTimestamp(),
          history: [{ ...historyEntry, action: asDraft ? "Rascunho salvo" : acaoCriacao }],
        };
        reqRef = await addDoc(collection(db, "requerimentos"), newReq);
      }
      const reqId = draftId || reqRef.id;

      if (!asDraft && hasVeiculo) {
        // Placa é opcional. Quando preenchida, normalizamos para busca/uniqueness
        // (UPPERCASE sem hífen). Equipamentos pesados sem placa ficam null.
        const placaTrim = (data.placa || "").trim().toUpperCase();
        const placaNorm = placaTrim.replace(/[^A-Z0-9]/g, "");
        const motoristaEhRespLegal = data.motorista_eh_responsavel_legal !== false;
        const vRef = await addDoc(collection(db, "vehicles"), {
          tag: data.tag || `SEM-TAG-${reqId.slice(0, 6)}`,
          placa: placaTrim || null,
          placaNormalizada: placaNorm || null,
          porte: data.porte,
          equipamento_tipo: data.equipamento_tipo === "outro" ? data.equipamento_tipo_outro : data.equipamento_tipo,
          subTipo: data.sub_tipo || null,
          vehicleTypeId: data.vehicleTypeId || null,
          tipoSnapshot: data.tipoSnapshot || null,
          origem: data.origem,
          contrato: data.contrato || null,
          empresa: data.empresa,
          marca: data.marca,
          modelo: data.modelo,
          ano: data.ano,
          combustivel: data.combustivel,
          horimetro: data.horimetro,
          quilometragem: data.quilometragem,
          centro_custo: data.centro_custo,
          unidade: data.unidade,
          // Campos de custo/gestão. Para alugados, valorAluguelMensal vem do snapshot do tipo.
          valorAluguelMensal: Number(data.tipoSnapshot?.valorMensal ?? data.valor_aluguel) || 0,
          valorHoraExtra: Number(data.tipoSnapshot?.valorHoraExtra) || 0,
          valorDiaExtra: Number(data.tipoSnapshot?.valorDiaExtra) || 0,
          valorPatrimonio: Number(data.valor_aquisicao) || 0,
          dataAquisicao: data.data_aquisicao || null,
          vencimentoCRLV: data.vencimento_crlv || null,
          // Anexo do CRLV (opcional) — chega até o DP visível em RequerimentoDetail/VehicleDetail.
          crlvAnexo: data.crlv_anexo || null,
          observacoes: data.observacoes_veiculo || "",
          // Responsável legal pelo equipamento. Quando hasMotorista + flag marcada,
          // o motorista vinculado é o próprio responsável (nome/cpf/telefone
          // herdados do motorista). Os DADOS BANCÁRIOS são SEMPRE gravados
          // (independente da flag) — exigência da Frota.
          motoristaEhResponsavelLegal: hasMotorista ? motoristaEhRespLegal : null,
          responsavelLegal: hasMotorista ? {
            // Identificação só preenchida quando NÃO é o motorista vinculado.
            nome: !motoristaEhRespLegal ? data.responsavel_legal_nome : null,
            cpfCnpj: !motoristaEhRespLegal ? (data.responsavel_legal_cpf_cnpj || null) : null,
            telefone: !motoristaEhRespLegal ? data.responsavel_legal_telefone : null,
            email: !motoristaEhRespLegal ? (data.responsavel_legal_email || null) : null,
            // Dados bancários — sempre gravados para pagamento de aluguel/contrato.
            banco: data.responsavel_legal_banco || null,
            agencia: data.responsavel_legal_agencia || null,
            conta: data.responsavel_legal_conta || null,
            pix: data.responsavel_legal_pix || null,
          } : null,
          status: VEHICLE_STATUS.PRE_REGISTERED,
          requerimentoId: reqId,
          createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "requerimentos", reqId), { vehicleId: vRef.id });
      }

      if (!asDraft && hasMotorista) {
        const dRef = await addDoc(collection(db, "drivers"), {
          name: data.motorista_nome,
          data_nascimento: data.motorista_data_nasc,
          phone: data.motorista_telefone,
          email: data.motorista_email,
          endereco: data.motorista_endereco,
          funcao: data.motorista_funcao,
          cnh: data.motorista_cnh,
          cnhCategoria: data.motorista_categoria,
          cnhValidade: data.motorista_validade_cnh || null,
          // Anexo da CNH (opcional) — chega até o DP via RequerimentoDetail/Motorista.
          cnhAnexo: data.cnh_anexo || null,
          asoValidade: data.motorista_aso_validade || null,
          // Manter aliases legados para retrocompatibilidade:
          categoria: data.motorista_categoria,
          validade_cnh: data.motorista_validade_cnh,
          aso_validade: data.motorista_aso_validade,
          status: DRIVER_STATUS.PENDING_APPROVAL,
          hasLogin: false,
          requerimentoId: reqId,
          createdAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "requerimentos", reqId), { driverId: dRef.id });
        // Quando o requerimento é "veículo + motorista", deixamos pré-vinculado
        // no documento do veículo (titular). O vínculo se torna operacional só
        // após o DP aprovar o motorista (status ACTIVE/NO_LOGIN_USER).
        const reqAfter = await getDoc(doc(db, "requerimentos", reqId));
        const vehicleId = reqAfter.exists() ? reqAfter.data().vehicleId : null;
        if (vehicleId) {
          await updateDoc(doc(db, "vehicles", vehicleId), {
            motoristaTitularId: dRef.id,
            motoristaTitularNome: data.motorista_nome,
            motoristasTitularesIds: [dRef.id],
            motoristasTitularesNomes: [data.motorista_nome],
          });
        }
      }

      if (!asDraft) {
        const alvo = hasMotorista ? data.motorista_nome : `${data.marca} ${data.modelo} (TAG ${data.tag || "—"})`;
        const destinatario = hasVeiculo ? "Segurança do Trabalho" : "DP";
        const message = `🔔 *MACRO AMBIENTAL — Novo Requerimento*

📋 Tipo: ${REQ_TYPE_LABEL[data.tipo]}
🆔 Protocolo: ${reqId.slice(0, 10)}
👤 Solicitante: ${profile.name}
🎯 Alvo: ${alvo}

Status: *encaminhado para ${destinatario}*

Acesse o sistema para analisar:
${window.location.origin}/requerimentos/${reqId}`;
        await notifyWhatsApp({
          recipients: [hasVeiculo ? "seguranca" : "dp"],
          title: `Novo requerimento → ${destinatario}`,
          message,
          context: { requerimentoId: reqId, type: data.tipo },
        });
      }

      setCreatedReqId(reqId);
      if (asDraft) {
        toast.success("Rascunho salvo.");
        navigate("/requerimentos");
      } else {
        const destino = hasVeiculo ? "Segurança do Trabalho" : "DP";
        toast.success(draftId ? `Rascunho enviado para ${destino}.` : `Requerimento enviado para ${destino}.`);
        setDraftId(null);
        setStep(7); // success / Conclusão
      }
    } catch (e) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] font-[Manrope,sans-serif]">
      {/* Top bar with breadcrumb */}
      <div className="bg-white border-b border-[#E2E8E4] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-2 text-xs text-[#708278] font-bold">
          <House size={14} className="text-[#2563EB]" />
          <span className="text-[#2563EB]">Painel</span>
          <ArrowRight size={10} />
          <span>Requerimento Contratual</span>
          <ArrowRight size={10} />
          <span className="text-[#0F2542]">Novo Requerimento</span>
        </div>
      </div>

      {/* Stepper - horizontal */}
      <div className="bg-white border-b border-[#E2E8E4] px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <Stepper step={step} totalSteps={totalSteps} />
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-8">
        <div className="bg-white border border-[#E2E8E4] rounded-md p-6 sm:p-10">
          {step === 1 && <Step1Tipo data={data} set={set} role={profile.role} />}
          {step === 2 && <Step2Dados data={data} set={set} hasVeiculo={hasVeiculo} hasMotorista={hasMotorista} subTiposDisponiveis={subTiposDisponiveis} funcoes={funcoes} equipCfg={equipCfg} />}
          {step === 3 && <Step3Adicionais data={data} set={set} hasVeiculo={hasVeiculo} hasMotorista={hasMotorista} setStep={setStep} funcoes={funcoes} />}
          {step === 4 && <Step4Documentos data={data} set={set} hasVeiculo={hasVeiculo} hasMotorista={hasMotorista} />}
          {step === 5 && <Step5Detalhes data={data} set={set} hasVeiculo={hasVeiculo} hasMotorista={hasMotorista} isAlugado={isAlugado} isProprio={isProprio} useHorimetro={useHorimetro} useKm={useKm} vehicleTypesAplicaveis={vehicleTypesAplicaveis} />}
          {step === 6 && <Step6Revisao data={data} hasVeiculo={hasVeiculo} hasMotorista={hasMotorista} isAlugado={isAlugado} isProprio={isProprio} />}
          {step === 7 && <Step7Conclusao reqId={createdReqId} navigate={navigate} resetWizard={() => { setData(empty); setStep(1); setCreatedReqId(null); }} />}

          {step < 7 && (
            <div className="mt-10 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 border-t border-[#E2E8E4]">
              <div className="flex gap-3 flex-wrap">
                {step > 1 ? (
                  <button onClick={prev} data-testid="wizard-prev" className="flex items-center gap-2 border border-[#E2E8E4] text-[#0F2542] px-5 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#EFF3F8] transition-all">
                    <ArrowLeft size={16} /> Voltar
                  </button>
                ) : (
                  <button onClick={() => navigate(-1)} className="flex items-center gap-2 border border-[#E2E8E4] text-[#4A564F] px-5 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#EFF3F8] transition-all">
                    <X size={16} /> Cancelar
                  </button>
                )}
                <button onClick={() => submit(true)} data-testid="wizard-save-draft" className="flex items-center gap-2 border border-[#E2E8E4] text-[#4A564F] px-5 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#EFF3F8] transition-all">
                  <FloppyDisk size={16} /> Rascunho
                </button>
              </div>
              {step < 6 ? (
                <button onClick={handleNext} data-testid="wizard-next" className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white px-7 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:from-[#1D4ED8] hover:to-[#1E40AF] shadow-md shadow-blue-900/20 transition-all">
                  Próximo <ArrowRight size={16} />
                </button>
              ) : (
                <button onClick={() => submit(false)} disabled={saving} data-testid="wizard-submit" className="flex items-center justify-center gap-2 bg-[#0F2542] text-white px-7 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#16294A] transition-all disabled:opacity-50">
                  <CheckCircle size={16} /> {saving ? "Enviando…" : "Enviar Requerimento"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Progress footer */}
        {step < 7 && (
          <div className="mt-4 bg-[#EFF3F8] border border-[#E2E8E4] rounded-md p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3 flex-1">
              <span className="font-bold text-[#0F2542]">Progresso do cadastro: {progress}% concluído</span>
              <div className="flex-1 max-w-xs h-1.5 bg-white rounded-full overflow-hidden border border-[#E2E8E4]">
                <div className="h-full bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <button onClick={() => submit(true)} className="flex items-center gap-1 text-[#4A564F] font-bold hover:text-[#0F2542]">
              <FloppyDisk size={14} /> Salvar rascunho
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stepper({ step, totalSteps }) {
  return (
    <div className="flex items-center justify-between gap-1 overflow-x-auto">
      {WIZARD_STEPS.map((s, idx) => {
        const isActive = s.id === step;
        const isDone = s.id < step;
        return (
          <div key={s.id} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center min-w-[80px] sm:min-w-[100px]">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${isActive ? "bg-[#2563EB] text-white ring-4 ring-[#2563EB]/20" :
                isDone ? "bg-[#10B981] text-white" :
                  "bg-[#E2E8E4] text-[#708278]"
                }`}>
                {isDone ? <CheckCircle size={18} weight="fill" /> : s.id}
              </div>
              <div className={`mt-2 text-[10px] sm:text-xs font-bold text-center uppercase tracking-[0.1em] ${isActive ? "text-[#2563EB]" : isDone ? "text-[#0F2542]" : "text-[#708278]"
                }`}>{s.short}</div>
            </div>
            {idx < WIZARD_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mt-[-20px] ${isDone ? "bg-[#10B981]" : "bg-[#E2E8E4]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const inp = "w-full border border-[#E2E8E4] bg-white px-4 py-3 rounded-md text-sm text-[#0F1411] focus:outline-none focus:border-[#2563EB] focus:border-2 transition-all";

function Field({ label, children, hint, full = false, required = false }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278] block mb-1.5">
        {label}{required && <span className="text-[#DC2626]"> *</span>}
      </label>
      {children}
      {hint && <div className="text-[11px] text-[#708278] mt-1">{hint}</div>}
    </div>
  );
}

function StepTitle({ icon: Icon, title, subtitle }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-[#EFF3F8] flex items-center justify-center">
          <Icon size={20} weight="duotone" className="text-[#2563EB]" />
        </div>
        <h2 className="font-[Outfit,sans-serif] text-2xl sm:text-3xl font-black tracking-tight text-[#0F1411]" data-testid="wizard-step-title">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-[#4A564F] mt-2 ml-13">{subtitle}</p>}
    </div>
  );
}

function InfoBox({ children, variant = "info" }) {
  const styles = {
    info: "bg-[#EFF3F8] border-[#2563EB]/30 text-[#0F2542]",
    warn: "bg-[#FEF3C7] border-[#F59E0B]/40 text-[#92400E]",
  }[variant];
  return (
    <div className={`mt-6 border rounded-md p-4 flex gap-3 ${styles}`}>
      <Info size={18} className="mt-0.5 shrink-0" weight="duotone" />
      <div className="text-xs leading-relaxed">{children}</div>
    </div>
  );
}

/* ----- STEP 1 ----- */
function Step1Tipo({ data, set, role }) {
  // FROTA não cria "Apenas Motorista" — apenas DP e demais setores gerenciam motoristas.
  const isFrota = role === "admin_frota";
  const allOptions = [
    { id: REQ_TYPE.VEICULO, label: "Apenas Veículo", desc: "Cadastro de um veículo ou equipamento sem vínculo com motorista.", examples: "Retroescavadeira, Caminhão Pipa, Muck, Escavadeira, carro, etc.", icon: Truck },
    { id: REQ_TYPE.MOTORISTA, label: "Apenas Motorista", desc: "Cadastro de motorista sem vínculo com veículo ou equipamento.", examples: "Motorista de caminhão, operador de máquinas, etc.", icon: UserCircle },
    { id: REQ_TYPE.VEICULO_MOTORISTA, label: "Veículo + Motorista", desc: "Cadastro de veículo/equipamento com vínculo com motorista.", examples: "Retroescavadeira + Operador, Caminhão + Motorista, etc.", icon: ArrowsLeftRight },
  ];
  const options = isFrota ? allOptions.filter((o) => o.id !== REQ_TYPE.MOTORISTA) : allOptions;
  // Regime contratual SÓ aplica para "Apenas Motorista" (vínculo trabalhista direto).
  // Veículo e Veículo+Motorista são sempre contratos comerciais (terceirizados).
  const showRegime = data.tipo === REQ_TYPE.MOTORISTA;
  return (
    <>
      <StepTitle icon={FileText} title="1. Tipo de Requerimento" subtitle="Selecione o que você deseja cadastrar neste requerimento." />
      <div className={`mt-8 grid ${options.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-4`}>
        {options.map(({ id, label, desc, examples, icon: Ic }) => (
          <button key={id} data-testid={`req-tipo-${id}`} onClick={() => set("tipo", id)}
            className={`text-left p-5 rounded-md border-2 transition-all duration-200 ${data.tipo === id ? "border-[#2563EB] bg-[#EFF3F8]" : "border-[#E2E8E4] bg-white hover:border-[#2563EB]/40"}`}>
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-full bg-[#EFF3F8] flex items-center justify-center">
                <Ic size={28} weight="duotone" className="text-[#2563EB]" />
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${data.tipo === id ? "border-[#2563EB] bg-[#2563EB]" : "border-[#E2E8E4]"}`}>
                {data.tipo === id && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>
            <div className="font-[Outfit,sans-serif] text-lg font-black text-[#0F1411] mt-4">{label}</div>
            <div className="text-sm text-[#4A564F] mt-1 leading-relaxed">{desc}</div>
            <div className="mt-4 bg-white border border-[#E2E8E4] rounded-md p-3">
              <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#2563EB]">Exemplos:</div>
              <div className="text-xs text-[#4A564F] mt-1">{examples}</div>
            </div>
          </button>
        ))}
      </div>
      {showRegime && (
        <div className="mt-6">
          <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-2">Regime contratual</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { id: "NAO_CLT", label: "Não-CLT (Prestação de serviço)", desc: "Contrato comercial; sem vínculo trabalhista." },
              { id: "CLT", label: "CLT (Colaborador próprio)", desc: "Vínculo trabalhista regido pela CLT." },
            ].map((r) => (
              <button key={r.id} data-testid={`regime-${r.id}`} onClick={() => set("regime", r.id)}
                className={`text-left p-4 rounded-md border-2 transition-all ${data.regime === r.id ? "border-[#10B981] bg-[#ECFDF5]" : "border-[#E2E8E4] bg-white hover:border-[#10B981]/40"}`}>
                <div className="font-bold text-sm text-[#0F1411]">{r.label}</div>
                <div className="text-xs text-[#4A564F] mt-1">{r.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {data.tipo && <InfoBox variant="warn"><strong>Importante:</strong> Após a seleção, as próximas etapas serão ajustadas conforme o tipo de requerimento escolhido.</InfoBox>}
    </>
  );
}

/* ----- STEP 2 — Dados Iniciais (dinâmica) ----- */
function Step2Dados({ data, set, hasVeiculo, hasMotorista, subTiposDisponiveis = [], funcoes = [], equipCfg }) {
  return (
    <>
      <StepTitle icon={hasVeiculo && hasMotorista ? ArrowsLeftRight : hasVeiculo ? Truck : UserCircle}
        title="2. Dados Iniciais" subtitle="Informe as características básicas para seguirmos com o cadastro." />

      {hasVeiculo && (
        <div className="mt-8">
          <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-3">Dados do Veículo</div>
          <Field label="Qual o porte do veículo?" required>
            <div className="grid sm:grid-cols-3 gap-4 mt-2">
              {PORTE_VEICULO.map((p) => (
                <button key={p.id} data-testid={`porte-${p.id}`} onClick={() => { set("porte", p.id); set("equipamento_tipo", ""); set("sub_tipo", ""); }}
                  className={`text-left p-5 rounded-md border-2 transition-all ${data.porte === p.id ? "border-[#2563EB] bg-[#EFF3F8]" : "border-[#E2E8E4] bg-white hover:border-[#2563EB]/40"}`}>
                  <div className="flex items-start justify-between">
                    <Truck size={28} weight="duotone" className="text-[#2563EB]" />
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${data.porte === p.id ? "border-[#2563EB] bg-[#2563EB]" : "border-[#E2E8E4]"}`}>
                      {data.porte === p.id && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                  <div className="font-[Outfit,sans-serif] text-lg font-black mt-3">{p.label}</div>
                  <div className="text-xs text-[#4A564F] mt-1">{p.desc}</div>
                </button>
              ))}
            </div>
          </Field>

          {data.porte && (
            <div className="mt-6">
              <Field label="Tipo de equipamento" required>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
                  {EQUIPAMENTO_TIPOS.filter((t) => !t.porte || t.porte === data.porte || t.id === "outro").map((t) => (
                    <button key={t.id} data-testid={`equip-${t.id}`} onClick={() => { set("equipamento_tipo", t.id); set("sub_tipo", ""); }}
                      className={`p-3 rounded-md border-2 text-sm font-bold transition-all ${data.equipamento_tipo === t.id ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-[#E2E8E4] bg-white hover:border-[#2563EB]/40"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </Field>
              {/* Sub-tipo (Toco / Truck / 3/4) — apenas para Caminhão Basculante e Carroceria */}
              {subTiposDisponiveis.length > 0 && (
                <div className="mt-4">
                  <Field label="Sub-tipo" required hint="Selecione o sub-tipo do caminhão. 3/4 disponível apenas em Carroceria.">
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {subTiposDisponiveis.map((s) => (
                        <button key={s.id} data-testid={`sub-${s.id}`} onClick={() => set("sub_tipo", s.id)}
                          className={`p-3 rounded-md border-2 text-sm font-bold transition-all ${data.sub_tipo === s.id ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-[#E2E8E4] bg-white hover:border-[#2563EB]/40"}`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              )}
              {/* Aviso da regra de medição */}
              {equipCfg && equipCfg.medicao !== "ambos" && (
                <div className="mt-3 text-[11px] text-[#4A564F] italic">
                  Este equipamento usa <strong>{equipCfg.medicao === "horimetro" ? "Horímetro (h)" : "Quilometragem (km)"}</strong> — campo obrigatório no passo 5.
                </div>
              )}
              {data.equipamento_tipo === "outro" && (
                <div className="mt-4">
                  <Field label="Especifique o tipo">
                    <input data-testid="equip-outro" value={data.equipamento_tipo_outro} onChange={(e) => set("equipamento_tipo_outro", e.target.value)} className={inp} />
                  </Field>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {hasMotorista && (
        <div className={`${hasVeiculo ? "mt-10 pt-8 border-t border-[#E2E8E4]" : "mt-8"}`}>
          <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-3">Dados do Motorista</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nome completo" required full>
              <input data-testid="m-nome" value={data.motorista_nome} onChange={(e) => set("motorista_nome", e.target.value)} className={inp} placeholder="Digite o nome completo" />
            </Field>
            <Field label="Data de nascimento">
              <input data-testid="m-data-nasc" type="date" value={data.motorista_data_nasc} onChange={(e) => set("motorista_data_nasc", e.target.value)} className={inp} />
            </Field>
            <Field label="CNH" required>
              <input data-testid="m-cnh" value={data.motorista_cnh} onChange={(e) => set("motorista_cnh", e.target.value)} className={inp} placeholder="Número da CNH" />
            </Field>
            <Field label="Categoria da CNH">
              <select data-testid="m-categoria" value={data.motorista_categoria} onChange={(e) => set("motorista_categoria", e.target.value)} className={inp}>
                <option value="">Selecione a categoria</option>
                {CATEGORIAS_CNH.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Validade da CNH" full>
              <input data-testid="m-validade-cnh" type="date" value={data.motorista_validade_cnh} onChange={(e) => set("motorista_validade_cnh", e.target.value)} className={inp} />
            </Field>
          </div>
        </div>
      )}

      <InfoBox>As próximas etapas serão ajustadas para o cadastro de <strong>{hasVeiculo && hasMotorista ? "veículo + motorista" : hasVeiculo ? "veículo/equipamento" : "motorista"}</strong>.</InfoBox>
    </>
  );
}

/* ----- STEP 3 — Informações Adicionais (dinâmica) ----- */
function Step3Adicionais({ data, set, hasVeiculo, hasMotorista, setStep, funcoes = [] }) {
  // Quando o requerimento é "Veículo + Motorista", a origem é SEMPRE prestação de
  // serviço com motorista terceirizado — não há sentido em escolher Locadora ou
  // Próprio. Caso contrário (Apenas Veículo), restaura para Próprio se estava em
  // alugado_motorista (transição V+M → V).
  useEffect(() => {
    if (hasVeiculo && hasMotorista && data.origem !== "alugado_motorista") {
      set("origem", "alugado_motorista");
    } else if (hasVeiculo && !hasMotorista && data.origem === "alugado_motorista") {
      set("origem", "proprio");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasVeiculo, hasMotorista]);

  const handleOrigemClick = (oId) => {
    set("origem", oId);
  };
  // Opções de origem visíveis: só aplica para "Apenas Veículo".
  //   • Apenas Veículo → "Próprio" e "Alugado (Locadora)". Sem "Alugado com Motorista"
  //     porque esse caso é tratado em V+M.
  //   • Veículo + Motorista → origem fixa (alugado_motorista), bloco oculto.
  const origemOptions = hasMotorista
    ? []
    : ORIGEM_TIPOS.filter((o) => o.id !== "alugado_motorista");

  return (
    <>
      <StepTitle icon={Info} title="3. Informações Adicionais" subtitle="Complemente as informações relevantes para o requerimento." />

      {hasVeiculo && (
        <div className="mt-8">
          <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-3">Identificação do Equipamento</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Possui TAG / Patrimônio?" full>
              <div className="flex gap-3">
                {["sim", "nao"].map((v) => (
                  <button key={v} data-testid={`tag-${v}`} onClick={() => set("possui_tag", v)}
                    className={`flex-1 px-5 py-3 rounded-md border-2 text-sm font-bold uppercase tracking-[0.1em] transition-all ${data.possui_tag === v ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-[#E2E8E4] bg-white text-[#0F1411]"}`}>
                    {v === "sim" ? "Sim, possui TAG" : "Não possui TAG"}
                  </button>
                ))}
              </div>
            </Field>
            {data.possui_tag === "sim" && (
              <Field label="Número da TAG" required full hint="A TAG é o identificador único do equipamento. Ex: R-1, R-2, P-3, EQP-15.">
                <input data-testid="tag-numero" value={data.tag} onChange={(e) => set("tag", e.target.value)} className={inp} placeholder="Ex: R-1" />
              </Field>
            )}
          </div>

          {/* ------------------------------------------------------------- */}
          {/* PLACA — campo único e opcional para ambas as categorias       */}
          {/* (veículos leves E pesados). Equipamentos sem emplacamento     */}
          {/* (escavadeira, retro etc.) podem deixar em branco.             */}
          {/* ------------------------------------------------------------- */}
          <div className="mt-8 text-[11px] uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-3">Placa do Veículo</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Placa" required full hint="Em maiúsculas (Mercosul ABC1D23 ou antigo ABC1234).">
              <input data-testid="placa-numero"
                value={data.placa}
                onChange={(e) => set("placa", e.target.value.toUpperCase())}
                className={inp}
                placeholder="ABC1D23"
                maxLength={8} />
            </Field>
          </div>

          <div className="mt-8 text-[11px] uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-3">Origem e Contrato</div>
          {hasMotorista ? (
            // V+M: origem implícita (prestação de serviço com motorista terceirizado).
            <div className="bg-[#EFF3F8] border border-[#2563EB]/20 rounded-md p-3 text-xs text-[#0F2542]" data-testid="origem-implicita">
              <strong>Prestação de serviço.</strong> Como este requerimento contempla
              <strong> motorista + veículo</strong>, a origem é automaticamente
              definida como <strong>terceirizado com motorista</strong>. O contrato
              será gerado em Word ao final pelo DP.
              <div className="mt-2">
                <Field label="Prestador / Empresa contratada (opcional)">
                  <input data-testid="contrato" value={data.contrato} onChange={(e) => set("contrato", e.target.value)} className={inp} placeholder="Nome do prestador ou pessoa física" />
                </Field>
              </div>
            </div>
          ) : (
            <>
              <Field label="Origem">
                <div className="grid sm:grid-cols-2 gap-3 mt-2">
                  {origemOptions.map((o) => (
                    <button key={o.id} data-testid={`origem-${o.id}`} onClick={() => handleOrigemClick(o.id)}
                      className={`p-4 rounded-md border-2 text-left transition-all ${data.origem === o.id ? "border-[#2563EB] bg-[#EFF3F8]" : "border-[#E2E8E4] bg-white hover:border-[#2563EB]/40"}`}>
                      <div className="font-bold text-sm text-[#0F1411]">{o.label}</div>
                      <div className="text-xs text-[#4A564F] mt-1">{o.desc}</div>
                    </button>
                  ))}
                </div>
              </Field>
              {data.origem === "alugado_empresa" && (
                <div className="mt-4">
                  <Field label="Locadora / Empresa de aluguel" hint="Nome da empresa que está locando o veículo.">
                    <input data-testid="contrato" value={data.contrato} onChange={(e) => set("contrato", e.target.value)} className={inp} placeholder="Ex: Localiza, Movida, etc." />
                  </Field>
                </div>
              )}
            </>
          )}

          <div className="mt-8 grid sm:grid-cols-3 gap-4">
            <Field label="Empresa">
              <input data-testid="empresa" value={data.empresa} onChange={(e) => set("empresa", e.target.value)} className={inp} placeholder="Macro Ambiental" />
            </Field>
            <Field label="Centro de Custo">
              <input data-testid="centro-custo" value={data.centro_custo} onChange={(e) => set("centro_custo", e.target.value)} className={inp} placeholder="Operações" />
            </Field>
            <Field label="Unidade / Base">
              <input data-testid="unidade" value={data.unidade} onChange={(e) => set("unidade", e.target.value)} className={inp} placeholder="Matriz - Serra/ES" />
            </Field>
          </div>
        </div>
      )}

      {hasMotorista && (
        <div className={`${hasVeiculo ? "mt-10 pt-8 border-t border-[#E2E8E4]" : "mt-8"}`}>
          <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-3">Contato e Função</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Função / Cargo" hint={funcoes.length === 0 ? "Cadastros mantidos pelo perfil Performance — peça para criar caso falte." : undefined}>
              {funcoes.length > 0 ? (
                <select data-testid="m-funcao" value={data.motorista_funcao} onChange={(e) => set("motorista_funcao", e.target.value)} className={inp}>
                  <option value="">— Selecione —</option>
                  {funcoes.map((f) => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                </select>
              ) : (
                <input data-testid="m-funcao" value={data.motorista_funcao} onChange={(e) => set("motorista_funcao", e.target.value)} className={inp} placeholder="Operador de Máquinas" />
              )}
            </Field>
            <Field label="Telefone" required>
              <input data-testid="m-telefone" value={data.motorista_telefone} onChange={(e) => set("motorista_telefone", e.target.value)} className={inp} placeholder="(11) 99999-9999" />
            </Field>
            <Field label="E-mail (opcional)">
              <input data-testid="m-email" type="email" value={data.motorista_email} onChange={(e) => set("motorista_email", e.target.value)} className={inp} />
            </Field>
            <Field label="Endereço (opcional)">
              <input data-testid="m-endereco" value={data.motorista_endereco} onChange={(e) => set("motorista_endereco", e.target.value)} className={inp} />
            </Field>
          </div>
        </div>
      )}
    </>
  );
}

/* ----- STEP 4 — Documentos ----- */
function Step4Documentos({ data, set, hasVeiculo, hasMotorista }) {
  const onFile = async (e) => {
    const files = Array.from(e.target.files || []);
    const reads = await Promise.all(files.map((f) =>
      new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res({ name: f.name, type: f.type, size: f.size, dataUrl: r.result });
        r.readAsDataURL(f);
      })
    ));
    set("documentos", [...(data.documentos || []), ...reads]);
  };
  // Anexo único (CRLV ou CNH). Limite de 750KB para caber no documento Firestore.
  const MAX_SINGLE = 750 * 1024;
  const onSingleFile = (field) => (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_SINGLE) {
      toast.error(`Arquivo muito grande (${(f.size / 1024).toFixed(0)}KB). Máximo: ${MAX_SINGLE / 1024}KB.`);
      e.target.value = "";
      return;
    }
    const r = new FileReader();
    r.onload = () => set(field, { name: f.name, type: f.type, size: f.size, dataUrl: r.result });
    r.readAsDataURL(f);
  };
  return (
    <>
      <StepTitle icon={FileArrowUp} title="4. Documentos" subtitle="Anexe os documentos do veículo/motorista." />

      {/* Anexos específicos — chegam direto ao DP e ficam vinculados ao registro */}
      <div className="mt-6 grid sm:grid-cols-2 gap-4">
        {hasVeiculo && (
          <SingleFileSlot
            testId="crlv"
            label="CRLV do Veículo"
            hint="Certificado de Registro e Licenciamento (opcional)."
            file={data.crlv_anexo}
            onChange={onSingleFile("crlv_anexo")}
            onClear={() => set("crlv_anexo", null)}
          />
        )}
        {hasMotorista && (
          <SingleFileSlot
            testId="cnh"
            label="CNH do Motorista"
            hint="Carteira Nacional de Habilitação (opcional)."
            file={data.cnh_anexo}
            onChange={onSingleFile("cnh_anexo")}
            onClear={() => set("cnh_anexo", null)}
          />
        )}
      </div>

      <div className="mt-8">
        <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-3">Outros documentos (genéricos)</div>
        <label className="block border-2 border-dashed border-[#E2E8E4] rounded-md p-8 text-center cursor-pointer hover:border-[#2563EB]/40 hover:bg-[#EFF3F8] transition-all">
          <input type="file" multiple accept="application/pdf,image/*" onChange={onFile} className="hidden" data-testid="docs-input" />
          <FileArrowUp size={36} className="mx-auto text-[#2563EB]" weight="duotone" />
          <div className="mt-3 text-sm font-bold text-[#0F1411]">Selecionar arquivos</div>
          <div className="text-xs text-[#708278] mt-1">PDFs ou imagens — múltiplos arquivos</div>
        </label>
        {data.documentos?.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-3">Anexados ({data.documentos.length})</div>
            <div className="space-y-2">
              {data.documentos.map((d, i) => (
                <div key={i} className="flex items-center justify-between border border-[#E2E8E4] rounded-md px-4 py-3 bg-white">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-md bg-[#EFF3F8] flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-[#2563EB]" weight="duotone" />
                    </div>
                    <div className="text-sm text-[#0F1411] truncate font-bold">{d.name}</div>
                  </div>
                  <button onClick={() => set("documentos", data.documentos.filter((_, idx) => idx !== i))}
                    className="text-xs text-[#DC2626] font-bold uppercase tracking-[0.1em]">Remover</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* Slot reutilizável de upload de 1 arquivo (CRLV, CNH). */
function SingleFileSlot({ testId, label, hint, file, onChange, onClear }) {
  return (
    <div className="bg-[#EFF3F8] border border-[#2563EB]/20 rounded-md p-4">
      <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#2563EB] mb-1">{label}</div>
      {hint && <div className="text-[11px] text-[#4A564F] mb-3">{hint}</div>}
      {!file ? (
        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-[#2563EB]/30 rounded-md py-4 cursor-pointer hover:bg-white transition-all">
          <input type="file" accept="application/pdf,image/*" onChange={onChange} className="hidden" data-testid={`${testId}-anexo-input`} />
          <FileArrowUp size={18} className="text-[#2563EB]" weight="duotone" />
          <span className="text-xs font-bold text-[#2563EB] uppercase tracking-[0.1em]">Anexar arquivo</span>
        </label>
      ) : (
        <div className="flex items-center justify-between bg-white border border-[#E2E8E4] rounded-md px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="text-[#2563EB]" weight="duotone" />
            <span className="text-sm font-bold text-[#0F1411] truncate" data-testid={`${testId}-anexo-nome`}>{file.name}</span>
          </div>
          <button onClick={onClear} className="text-[10px] text-[#DC2626] font-bold uppercase tracking-[0.15em] ml-2" data-testid={`${testId}-anexo-remove`}>Remover</button>
        </div>
      )}
    </div>
  );
}

/* ----- STEP 5 — Detalhes (dinâmica) ----- */
function Step5Detalhes({ data, set, hasVeiculo, hasMotorista, isAlugado, isProprio, useHorimetro, useKm, vehicleTypesAplicaveis = [] }) {
  // Ao selecionar Tipo de Veículo, captura o snapshot e atualiza valor_aluguel.
  const onVehicleTypeChange = (vtId) => {
    set("vehicleTypeId", vtId);
    const vt = vehicleTypesAplicaveis.find((v) => v.id === vtId);
    if (vt) {
      set("tipoSnapshot", snapshotVehicleType(vt));
      set("valor_aluguel", vt.valorMensal || 0);
    } else {
      set("tipoSnapshot", null);
      set("valor_aluguel", "");
    }
  };
  return (
    <>
      <StepTitle icon={Info} title="5. Detalhes" subtitle="Preencha as informações detalhadas." />

      {hasVeiculo && (
        <div className="mt-8">
          <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-3">Detalhes do Equipamento</div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Marca" required><input data-testid="marca" value={data.marca} onChange={(e) => set("marca", e.target.value)} className={inp} placeholder="Caterpillar" /></Field>
            <Field label="Modelo" required><input data-testid="modelo" value={data.modelo} onChange={(e) => set("modelo", e.target.value)} className={inp} placeholder="416F2" /></Field>
            <Field label="Ano de Fabricação" required hint="Obrigatório (próprio ou alugado).">
              <input data-testid="ano" type="number" value={data.ano} onChange={(e) => set("ano", e.target.value)} className={inp} placeholder="2022" />
            </Field>
            <Field label="Combustível">
              <select data-testid="combustivel" value={data.combustivel} onChange={(e) => set("combustivel", e.target.value)} className={inp}>
                <option value="">Selecione</option>
                {COMBUSTIVEIS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            {/* Horímetro / Quilometragem (condicional ao tipo do equipamento) */}
            {useHorimetro ? (
              <Field label="Horímetro atual" required hint="Obrigatório para este equipamento.">
                <input data-testid="horimetro" value={data.horimetro} onChange={(e) => set("horimetro", e.target.value)} className={inp} placeholder="1.250 h" />
              </Field>
            ) : useKm ? (
              <Field label="Quilometragem" required hint="Obrigatório para este equipamento.">
                <input data-testid="quilometragem" value={data.quilometragem} onChange={(e) => set("quilometragem", e.target.value)} className={inp} placeholder="12.500 km" />
              </Field>
            ) : (
              <>
                <Field label="Horímetro (se aplicável)"><input data-testid="horimetro" value={data.horimetro} onChange={(e) => set("horimetro", e.target.value)} className={inp} placeholder="1.250 h" /></Field>
                <Field label="Quilometragem (se aplicável)"><input data-testid="quilometragem" value={data.quilometragem} onChange={(e) => set("quilometragem", e.target.value)} className={inp} placeholder="12.500 km" /></Field>
              </>
            )}

            {/* Bloco condicional: PRÓPRIO → patrimônio + data de aquisição */}
            {isProprio && (
              <>
                <Field label="Valor de Aquisição (R$)" required hint="Patrimônio (base para depreciação).">
                  <input data-testid="valor-aquisicao" type="number" value={data.valor_aquisicao} onChange={(e) => set("valor_aquisicao", e.target.value)} className={inp} placeholder="350000" />
                </Field>
                <Field label="Data de Aquisição" required>
                  <input data-testid="data-aquisicao" type="date" value={data.data_aquisicao} onChange={(e) => set("data_aquisicao", e.target.value)} className={inp} />
                </Field>
              </>
            )}

            <Field label="Vencimento do CRLV" hint="Validade do CRLV/licenciamento (alerta no Dashboard).">
              <input data-testid="vencimento-crlv" type="date" value={data.vencimento_crlv} onChange={(e) => set("vencimento_crlv", e.target.value)} className={inp} />
            </Field>
            <Field label="Observações sobre o equipamento" full>
              <textarea data-testid="obs-veiculo" rows={3} value={data.observacoes_veiculo} onChange={(e) => set("observacoes_veiculo", e.target.value)} className={inp} />
            </Field>
          </div>

          {/* Bloco ALUGADO: seleção do TIPO DE VEÍCULO (catálogo do Medição) */}
          {isAlugado && (
            <div className="mt-6 bg-[#EFF3F8] border border-[#2563EB]/20 rounded-md p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#2563EB] mb-3 flex items-center gap-2">
                <CurrencyCircleDollar size={14} /> Tipo de Veículo (catálogo Medição)
              </div>
              {vehicleTypesAplicaveis.length === 0 ? (
                <div className="text-sm text-[#92400E] bg-[#FEF3C7] border border-[#F59E0B]/40 rounded-md p-3">
                  Nenhum tipo cadastrado para esta categoria. Peça à equipe de Medição para criar em <strong>/tipos-veiculo</strong>.
                </div>
              ) : (
                <>
                  <Field label="Selecione o tipo" required>
                    <select data-testid="vehicle-type-select" value={data.vehicleTypeId} onChange={(e) => onVehicleTypeChange(e.target.value)} className={inp}>
                      <option value="">— Selecione —</option>
                      {vehicleTypesAplicaveis.map((vt) => (
                        <option key={vt.id} value={vt.id}>{vt.nome} · {formatCurrency(vt.valorMensal)}/mês</option>
                      ))}
                    </select>
                  </Field>
                  {data.tipoSnapshot && (
                    <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                      <div className="bg-white border border-[#E2E8E4] rounded-md p-2">
                        <div className="text-[9px] uppercase tracking-[0.15em] text-[#708278] font-bold">Mensal</div>
                        <div className="text-sm font-black text-[#10B981] mt-1">{formatCurrency(data.tipoSnapshot.valorMensal)}</div>
                      </div>
                      <div className="bg-white border border-[#E2E8E4] rounded-md p-2">
                        <div className="text-[9px] uppercase tracking-[0.15em] text-[#708278] font-bold">Hora Extra</div>
                        <div className="text-sm font-black text-[#0F2542] mt-1">{formatCurrency(data.tipoSnapshot.valorHoraExtra)}</div>
                      </div>
                      <div className="bg-white border border-[#E2E8E4] rounded-md p-2">
                        <div className="text-[9px] uppercase tracking-[0.15em] text-[#708278] font-bold">Dia Extra</div>
                        <div className="text-sm font-black text-[#0F2542] mt-1">{formatCurrency(data.tipoSnapshot.valorDiaExtra)}</div>
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-[#708278] italic mt-2">Valores travados nesse momento (snapshot). Alterações futuras no catálogo não afetam este requerimento.</p>
                </>
              )}
            </div>
          )}

          {/* Responsável legal pelo equipamento — só aparece quando há motorista atrelado */}
          {hasMotorista && (
            <div className="mt-8 pt-6 border-t border-[#E2E8E4]">
              <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-3">Responsável Legal pelo Equipamento</div>
              <label className="flex items-start gap-2 text-sm text-[#0F1411] cursor-pointer">
                <input type="checkbox" checked={data.motorista_eh_responsavel_legal !== false}
                  onChange={(e) => set("motorista_eh_responsavel_legal", e.target.checked)}
                  data-testid="motorista-eh-resp-legal" className="mt-1" />
                <span>O <strong>motorista vinculado</strong> é o responsável legal por este equipamento.</span>
              </label>
              {data.motorista_eh_responsavel_legal === false && (
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <Field label="Nome do responsável legal" required full>
                    <input data-testid="resp-nome" value={data.responsavel_legal_nome} onChange={(e) => set("responsavel_legal_nome", e.target.value)} className={inp} placeholder="Razão social ou nome completo" />
                  </Field>
                  <Field label="CPF / CNPJ">
                    <input data-testid="resp-doc" value={data.responsavel_legal_cpf_cnpj} onChange={(e) => set("responsavel_legal_cpf_cnpj", e.target.value)} className={inp} />
                  </Field>
                  <Field label="Telefone" required>
                    <input data-testid="resp-tel" value={data.responsavel_legal_telefone} onChange={(e) => set("responsavel_legal_telefone", e.target.value)} className={inp} placeholder="(11) 99999-9999" />
                  </Field>
                  <Field label="E-mail (opcional)">
                    <input data-testid="resp-email" type="email" value={data.responsavel_legal_email} onChange={(e) => set("responsavel_legal_email", e.target.value)} className={inp} />
                  </Field>
                </div>
              )}

              {/* Dados bancários — regra de pagamento:
                  OPÇÃO A: Banco + Agência + Conta (3 obrigatórios juntos);
                  OPÇÃO B: Só PIX. Pelo menos uma das duas opções completa. */}
              <div className="mt-5 bg-[#F5F7FA] border border-[#E2E8E4] rounded-md p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-1">Dados bancários · pagamento <span className="text-[#DC2626]">*</span></div>
                <p className="text-[11px] text-[#708278] mb-4">Preencha <strong>Opção A</strong> (Banco + Agência + Conta — os três juntos) <strong>OU</strong> <strong>Opção B</strong> (PIX). Você pode informar as duas, mas pelo menos uma precisa estar completa.</p>

                {/* Opção A — Conta bancária */}
                <div className="bg-white border border-[#E2E8E4] rounded-md p-3 mb-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-[#1E3A5F] text-white text-[11px] font-bold flex items-center justify-center">A</div>
                    <div className="text-[11px] uppercase tracking-[0.15em] font-bold text-[#0F2542]">Conta bancária</div>
                    <div className="text-[10px] text-[#708278]">(Banco + Agência + Conta — os 3 obrigatórios juntos)</div>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <Field label="Banco">
                      <input data-testid="resp-banco" value={data.responsavel_legal_banco} onChange={(e) => set("responsavel_legal_banco", e.target.value)} className={inp} placeholder="Ex: Itaú" />
                    </Field>
                    <Field label="Agência">
                      <input data-testid="resp-agencia" value={data.responsavel_legal_agencia} onChange={(e) => set("responsavel_legal_agencia", e.target.value)} className={inp} placeholder="0001" />
                    </Field>
                    <Field label="Conta">
                      <input data-testid="resp-conta" value={data.responsavel_legal_conta} onChange={(e) => set("responsavel_legal_conta", e.target.value)} className={inp} placeholder="12345-6" />
                    </Field>
                  </div>
                </div>

                <div className="text-center text-[10px] uppercase tracking-[0.25em] font-bold text-[#708278] my-2">— OU —</div>

                {/* Opção B — PIX */}
                <div className="bg-white border border-[#E2E8E4] rounded-md p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-[#10B981] text-white text-[11px] font-bold flex items-center justify-center">B</div>
                    <div className="text-[11px] uppercase tracking-[0.15em] font-bold text-[#0F2542]">PIX</div>
                  </div>
                  <Field label="Chave PIX" full>
                    <input data-testid="resp-pix" value={data.responsavel_legal_pix} onChange={(e) => set("responsavel_legal_pix", e.target.value)} className={inp} placeholder="CPF/CNPJ/E-mail/Telefone/Chave aleatória" />
                  </Field>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {hasMotorista && (
        <div className={`${hasVeiculo ? "mt-10 pt-8 border-t border-[#E2E8E4]" : "mt-8"}`}>
          <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-3">Detalhes do Motorista</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Validade do ASO (Exame médico)" full hint="Apenas alerta — não bloqueia.">
              <input data-testid="m-aso" type="date" value={data.motorista_aso_validade} onChange={(e) => set("motorista_aso_validade", e.target.value)} className={inp} />
            </Field>
            <Field label="Observações sobre o motorista" full>
              <textarea data-testid="m-obs" rows={4} value={data.motorista_observacoes} onChange={(e) => set("motorista_observacoes", e.target.value)} className={inp} />
            </Field>
          </div>
        </div>
      )}
    </>
  );
}

/* ----- STEP 6 — Revisão ----- */
function Step6Revisao({ data, hasVeiculo, hasMotorista, isAlugado, isProprio }) {
  const Row = ({ k, v }) => (
    <div className="flex justify-between gap-4 border-b border-[#E2E8E4] py-2 text-sm">
      <span className="text-[11px] uppercase tracking-[0.15em] text-[#708278] font-bold">{k}</span>
      <span className="text-right text-[#0F1411] font-semibold truncate max-w-xs">{v || "—"}</span>
    </div>
  );
  const origemLabel = ORIGEM_TIPOS.find((o) => o.id === data.origem)?.label || data.origem;
  return (
    <>
      <StepTitle icon={CheckCircle} title="6. Revisão" subtitle="Confira todas as informações antes de enviar." />
      <div className="mt-6">
        <div className="bg-[#EFF3F8] border border-[#2563EB]/20 rounded-md p-4 mb-6">
          <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#2563EB]">Tipo</div>
          <div className="text-base font-bold text-[#0F2542] mt-1">{REQ_TYPE_LABEL[data.tipo]}</div>
        </div>

        {hasVeiculo && (
          <div className="mb-6">
            <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-2">Veículo</div>
            <div className="bg-white border border-[#E2E8E4] rounded-md p-4">
              <Row k="Porte" v={data.porte} />
              <Row k="Equipamento" v={data.equipamento_tipo === "outro" ? data.equipamento_tipo_outro : data.equipamento_tipo} />
              <Row k="TAG" v={data.possui_tag === "sim" ? data.tag : "Sem TAG"} />
              <Row k="Placa" v={data.placa || "Sem placa (equipamento)"} />
              <Row k="Sub-tipo" v={data.sub_tipo ? SUB_TIPOS_LABEL[data.sub_tipo] : "—"} />
              <Row k="Origem" v={origemLabel} />
              <Row k="Tipo (catálogo)" v={data.tipoSnapshot?.nome || "—"} />
              <Row k="Contrato / Locadora" v={data.contrato} />
              <Row k="Empresa" v={data.empresa} />
              <Row k="Centro de custo" v={data.centro_custo} />
              <Row k="Unidade" v={data.unidade} />
              <Row k="Marca / Modelo" v={`${data.marca} ${data.modelo}`} />
              <Row k="Ano" v={data.ano} />
              <Row k="Combustível" v={data.combustivel} />
              <Row k="Horímetro" v={data.horimetro} />
              <Row k="Quilometragem" v={data.quilometragem} />
              {isProprio && <Row k="Valor aquisição" v={data.valor_aquisicao && `R$ ${data.valor_aquisicao}`} />}
              {isProprio && <Row k="Data aquisição" v={data.data_aquisicao} />}
              {isAlugado && <Row k="Valor aluguel mensal" v={data.tipoSnapshot ? formatCurrency(data.tipoSnapshot.valorMensal) + "/mês" : "—"} />}
              {isAlugado && data.tipoSnapshot && <Row k="Hora extra" v={formatCurrency(data.tipoSnapshot.valorHoraExtra)} />}
              {isAlugado && data.tipoSnapshot && <Row k="Dia extra" v={formatCurrency(data.tipoSnapshot.valorDiaExtra)} />}
              <Row k="Vencimento CRLV" v={data.vencimento_crlv} />
            </div>
            {hasMotorista && (
              <div className="bg-[#EFF3F8] border border-[#2563EB]/20 rounded-md p-3 mt-3">
                <div className="text-[11px] uppercase tracking-[0.15em] text-[#2563EB] font-bold mb-1">Responsável Legal</div>
                {data.motorista_eh_responsavel_legal !== false ? (
                  <div className="text-sm text-[#0F2542] font-bold">{data.motorista_nome || "(motorista vinculado)"}</div>
                ) : (
                  <>
                    <Row k="Nome" v={data.responsavel_legal_nome} />
                    <Row k="CPF/CNPJ" v={data.responsavel_legal_cpf_cnpj} />
                    <Row k="Telefone" v={data.responsavel_legal_telefone} />
                    <Row k="E-mail" v={data.responsavel_legal_email} />
                  </>
                )}
                {/* Dados bancários — sempre mostrados na revisão. */}
                <div className="mt-2 pt-2 border-t border-[#2563EB]/20">
                  <Row k="Banco" v={data.responsavel_legal_banco} />
                  <Row k="PIX" v={data.responsavel_legal_pix} />
                  <Row k="Agência" v={data.responsavel_legal_agencia} />
                  <Row k="Conta" v={data.responsavel_legal_conta} />
                </div>
              </div>
            )}
          </div>
        )}

        {hasMotorista && (
          <div className="mb-6">
            <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#0F2542] mb-2">Motorista</div>
            <div className="bg-white border border-[#E2E8E4] rounded-md p-4">
              <Row k="Nome" v={data.motorista_nome} />
              <Row k="Data nascimento" v={data.motorista_data_nasc} />
              <Row k="CNH" v={data.motorista_cnh} />
              <Row k="Categoria CNH" v={data.motorista_categoria} />
              <Row k="Validade CNH" v={data.motorista_validade_cnh} />
              <Row k="Função / Cargo" v={data.motorista_funcao} />
              <Row k="Telefone" v={data.motorista_telefone} />
              <Row k="E-mail" v={data.motorista_email} />
              <Row k="ASO validade" v={data.motorista_aso_validade} />
            </div>
            {data.motorista_observacoes && (
              <div className="mt-3 bg-[#F5F7FA] border border-[#E2E8E4] rounded-md p-3" data-testid="rev-motorista-obs">
                <div className="text-[11px] uppercase tracking-[0.15em] text-[#708278] font-bold mb-1.5">Observações</div>
                <div className="text-sm text-[#0F1411] whitespace-pre-wrap break-words">{data.motorista_observacoes}</div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white border border-[#E2E8E4] rounded-md p-4">
          <Row k="Documentos anexados" v={`${(data.documentos || []).length} arquivo(s)`} />
        </div>

        <InfoBox variant="warn">
          Ao enviar, este requerimento será encaminhado para análise do <strong>Departamento Pessoal (DP)</strong>.
        </InfoBox>
      </div>
    </>
  );
}

/* ----- STEP 7 — Conclusão ----- */
function Step7Conclusao({ reqId, navigate, resetWizard }) {
  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 mx-auto rounded-full bg-[#10B981]/15 flex items-center justify-center">
        <CheckCircle size={40} weight="fill" className="text-[#10B981]" />
      </div>
      <h2 className="font-[Outfit,sans-serif] text-3xl font-black tracking-tight text-[#0F1411] mt-6">Requerimento enviado!</h2>
      <p className="text-sm text-[#4A564F] mt-3 max-w-md mx-auto leading-relaxed">
        Seu requerimento foi recebido e encaminhado para análise do Departamento Pessoal. Você será notificado sobre o andamento.
      </p>
      <div className="mt-4 inline-flex items-center gap-2 bg-[#EFF3F8] px-4 py-2 rounded-md">
        <span className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#708278]">Protocolo</span>
        <code className="text-sm font-bold text-[#0F2542]">{reqId?.slice(0, 10)}…</code>
      </div>
      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={() => navigate(`/requerimentos/${reqId}`)} data-testid="conc-view"
          className="bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white px-6 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:from-[#1D4ED8] hover:to-[#1E40AF]">
          Ver requerimento
        </button>
        <button onClick={resetWizard} data-testid="conc-novo"
          className="border border-[#E2E8E4] text-[#0F2542] px-6 py-3 rounded-md text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#EFF3F8]">
          Criar outro
        </button>
        <button onClick={() => navigate("/")} className="text-[#4A564F] px-6 py-3 text-sm font-bold uppercase tracking-[0.1em] hover:text-[#0F2542]">
          Ir ao painel
        </button>
      </div>
    </div>
  );
}
