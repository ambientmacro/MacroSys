import { addDoc, collection, serverTimestamp, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Resolve recipients (string role | userId | object) to actual user records with phones.
 */
async function resolveRecipients(recipients) {
  const resolved = [];
  for (const r of recipients) {
    if (typeof r === "object" && r.phone) {
      // Already complete (name, phone, role)
      resolved.push(r);
    } else if (typeof r === "object" && r.userId) {
      try {
        const s = await getDoc(doc(db, "users", r.userId));
        if (s.exists()) {
          const u = s.data();
          resolved.push({ name: u.name || u.email, phone: u.phone, role: u.role, email: u.email });
        }
      } catch (e) { /* ignore */ }
    } else if (typeof r === "string") {
      // role string -> look up approved users with that role
      try {
        const snap = await getDocs(query(collection(db, "users"), where("role", "==", r), where("status", "==", "approved")));
        snap.forEach((d) => {
          const u = d.data();
          resolved.push({ name: u.name || u.email, phone: u.phone, role: u.role, email: u.email });
        });
      } catch (e) { /* ignore */ }
    }
  }
  return resolved;
}

/**
 * Build wa.me link for a single recipient.
 */
export function buildWaLink(phone, message) {
  if (!phone) return null;
  // Strip non-digits
  const clean = String(phone).replace(/\D/g, "");
  if (!clean) return null;
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

/**
 * Trigger a WhatsApp notification dialog with prepared message + recipients.
 * Records the event in Firestore /notifications and opens the WhatsApp composer modal
 * via a global window event listened by WhatsAppNotifier.
 */
export async function notifyWhatsApp({ recipients = [], message, title = "WhatsApp", context = {} }) {
  const resolved = await resolveRecipients(recipients);

  // Log to Firestore so we have an audit trail (mocked send)
  try {
    await addDoc(collection(db, "notifications"), {
      channel: "whatsapp",
      title,
      message,
      recipients: resolved.map((r) => ({ name: r.name || "", phone: r.phone || "", role: r.role || "" })),
      context,
      sent_via: "click_to_chat",
      createdAt: serverTimestamp(),
    });
  } catch (e) { /* silent */ }

  // Dispatch UI event
  window.dispatchEvent(new CustomEvent("whatsapp-notify", {
    detail: { recipients: resolved, message, title, context },
  }));
}

// Backwards-compat alias used by older callers — accepts the legacy shape.
export async function sendWhatsAppMock({ to, message, context = {} }) {
  // try to interpret 'to' as a role string
  let recipients = [];
  if (typeof to === "string") {
    const lower = to.toLowerCase();
    const map = { dp: "dp", "departamento pessoal": "dp", "segurança": "seguranca", seguranca: "seguranca", "segurança do trabalho": "seguranca", encarregado: "encarregado", frota: "admin_frota", motorista: "motorista" };
    const role = map[lower];
    if (role) recipients = [role];
    else recipients = [{ name: to, phone: null }];
  }
  await notifyWhatsApp({ recipients, message, title: "Notificação WhatsApp", context });
}
