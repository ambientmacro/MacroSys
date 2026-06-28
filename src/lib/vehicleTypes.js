import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Coleção `vehicleTypes` — gerenciada pelo perfil MEDIÇÃO.
 *
 * Schema:
 *  {
 *    id (auto),
 *    nome: string,                // "Caminhão Basculante Toco"
 *    categoria: string,           // id de EQUIPAMENTO_TIPOS (caminhao_basculante, ...)
 *    subTipo: string|null,        // "toco" | "truck" | "3_4" | null
 *    porte: string,               // "pesado" | "leve"
 *    medicao: string,             // "horimetro" | "km"
 *    valorMensal: number,
 *    valorHoraExtra: number,
 *    valorDiaExtra: number,
 *    ativo: boolean,
 *    createdAt, updatedAt,
 *    createdBy, updatedBy,
 *    historicoValores: [          // log de alterações de valores (auditoria)
 *      { at, by, valorMensal, valorHoraExtra, valorDiaExtra }
 *    ]
 *  }
 */

export const fetchActiveVehicleTypes = async () => {
  try {
    const snap = await getDocs(query(collection(db, "vehicleTypes"), where("ativo", "==", true)));
    const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Ordena por nome em memória (sem precisar de orderBy server-side).
    return arr.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  } catch (e) {
    return [];
  }
};

export const fetchAllVehicleTypes = async () => {
  const snap = await getDocs(collection(db, "vehicleTypes"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
};

/**
 * Snapshot imutável dos valores do tipo, para gravar no requerimento.
 * Garante que alterações futuras na tabela `vehicleTypes` não afetem
 * requerimentos já criados (histórico financeiro confiável).
 */
export const snapshotVehicleType = (vt) => {
  if (!vt) return null;
  return {
    typeId: vt.id,
    nome: vt.nome,
    categoria: vt.categoria,
    subTipo: vt.subTipo || null,
    porte: vt.porte,
    medicao: vt.medicao,
    valorMensal: Number(vt.valorMensal) || 0,
    valorHoraExtra: Number(vt.valorHoraExtra) || 0,
    valorDiaExtra: Number(vt.valorDiaExtra) || 0,
    snapshotAt: new Date().toISOString(),
  };
};

export const formatCurrency = (n) => {
  const v = Number(n) || 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};
