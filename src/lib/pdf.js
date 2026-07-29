import jsPDF from "jspdf";

export function generateChecklistPDF({ checklist, template, vehicle, driver, filler }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("MACRO AMBIENTAL — Checklist Operacional", 40, y);
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Data: ${new Date(checklist.createdAt?.toDate?.() || checklist.createdAt || Date.now()).toLocaleString("pt-BR")}`, 40, y);
  y += 14;
  doc.text(`Tipo: ${checklist.type === "manual" ? "Manual (encarregado)" : "Digital"}`, 40, y);
  y += 14;
  doc.text(`Template: ${template?.name || "—"}`, 40, y);
  y += 14;
  doc.text(`Veículo: ${vehicle?.tag || "—"} — ${vehicle?.brand || ""} ${vehicle?.model || ""}`, 40, y);
  y += 14;
  doc.text(`Motorista: ${driver?.name || "—"} ${driver?.phone ? `(${driver.phone})` : ""}`, 40, y);
  y += 14;
  doc.text(`Registrado por: ${filler?.name || filler?.email || "—"}`, 40, y);
  y += 20;

  doc.setLineWidth(0.5);
  doc.line(40, y, pageWidth - 40, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Itens Verificados", 40, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  (template?.items || []).forEach((item, idx) => {
    if (y > 760) {
      doc.addPage();
      y = 40;
    }
    const answer = checklist.answers?.[item.id];
    let val = "—";
    if (item.type === "checkbox") val = answer === true ? "Conforme" : answer === false ? "Não Conforme" : "—";
    else if (answer !== undefined && answer !== null && answer !== "") val = String(answer);
    doc.text(`${idx + 1}. ${item.label}`, 40, y);
    doc.text(val, pageWidth - 200, y);
    y += 14;
  });

  if (checklist.observations) {
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("Observações:", 40, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(checklist.observations, pageWidth - 80);
    lines.forEach((l) => {
      if (y > 780) { doc.addPage(); y = 40; }
      doc.text(l, 40, y);
      y += 12;
    });
  }

  doc.save(`checklist_${vehicle?.tag || "veiculo"}_${Date.now()}.pdf`);
}
