"use client";
import { useState } from "react";
import { Contract, House, PaymentMethod, UnpaidItem } from "@/types";
import { INIT_HOUSES, INIT_CONTRACTS, fmt, genPin, today, genPayments, MONTHS, MONTHS_SHORT, PAYMENT_METHODS, CITIES, HOUSE_TYPES } from "@/lib/data";
import { useLocalStorage } from "@/lib/useLocalStorage";

/* ─── Styles ──────────────────────────────────────────────────── */
const S: Record<string, React.CSSProperties> = {
  app:{display:"flex",minHeight:"100vh",background:"#F0F2F5",fontFamily:"'Sora',sans-serif",flexDirection:"column"},
  sidebar:{width:240,background:"#0F172A",display:"flex",flexDirection:"column",padding:"20px 14px",gap:6,position:"fixed",top:0,left:0,height:"100vh",overflowY:"auto",zIndex:500},
  logo:{display:"flex",alignItems:"center",gap:8,marginBottom:20,padding:"0 4px"},
  nav:{display:"flex",flexDirection:"column",gap:3,flex:1},
  navBtn:{display:"flex",alignItems:"center",gap:8,padding:"9px 10px",background:"transparent",border:"none",color:"#94A3B8",cursor:"pointer",borderRadius:8,fontSize:12,fontWeight:500,textAlign:"left",width:"100%"},
  navBtnActive:{background:"#1E293B",color:"#F8FAFC"},
  sidebarActions:{display:"flex",flexDirection:"column",gap:6,paddingTop:12,borderTop:"1px solid #1E293B"},
  actionBtn:{padding:"9px 12px",background:"#1877F2",border:"none",color:"#fff",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600},
  pageTitle:{fontSize:22,fontWeight:800,color:"#1C1E21",marginBottom:18,letterSpacing:"-0.5px"},
  sectionTitle:{fontSize:13,fontWeight:700,color:"#374151",margin:"0 0 10px"},
  section:{marginBottom:22},
  sectionDivider:{background:"#F1F5F9",borderRadius:6,padding:"7px 12px",fontWeight:700,fontSize:12,color:"#475569",marginTop:4},
  statCard:{background:"#fff",borderRadius:14,padding:"18px 16px",boxShadow:"0 2px 8px rgba(0,0,0,.06)",border:"1px solid #E9EAEC"},
  contractList:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:20},
  contractCard:{background:"#fff",borderRadius:12,padding:"13px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 3px rgba(0,0,0,.06)",border:"1px solid #F1F5F9",flexWrap:"wrap",gap:10},
  contractLeft:{display:"flex",flexDirection:"column",gap:3},
  unpaidTag:{display:"inline-block",background:"#FEF2F2",color:"#EF4444",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20},
  smallBtn:{padding:"6px 11px",background:"#F3F4F6",border:"none",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:600,color:"#374151"},
  badge:{padding:"3px 9px",borderRadius:20,fontSize:11,fontWeight:700,color:"#fff"},
  houseCard:{background:"#fff",borderRadius:12,padding:16,boxShadow:"0 1px 3px rgba(0,0,0,.06)",border:"1px solid #F1F5F9"},
  label:{fontSize:12,fontWeight:600,color:"#374151"},
  input:{padding:"9px 12px",border:"1.5px solid #E5E7EB",borderRadius:8,fontSize:13,fontFamily:"inherit",width:"100%",boxSizing:"border-box"},
  primaryBtn:{padding:"11px 20px",background:"#1877F2",border:"none",color:"#fff",borderRadius:10,cursor:"pointer",fontSize:13,fontWeight:700,boxShadow:"0 2px 8px rgba(24,119,242,.30)"},
  ghostBtn:{padding:"11px 20px",background:"#F3F4F6",border:"none",color:"#374151",borderRadius:10,cursor:"pointer",fontSize:13,fontWeight:600},
  allGood:{background:"#F0FDF4",border:"1px solid #BBF7D0",color:"#166534",padding:18,borderRadius:12,textAlign:"center",fontSize:14,fontWeight:600},
  historyTable:{background:"#fff",borderRadius:10,overflow:"hidden",border:"1px solid #F1F5F9"},
  unpaidRow:{display:"flex",alignItems:"center",gap:12,borderRadius:10,padding:"12px 14px",flexWrap:"wrap"},
  payNowBtn:{padding:"9px 16px",background:"#1877F2",border:"none",color:"#fff",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,marginLeft:"auto"},
  landing:{minHeight:"100vh",background:"linear-gradient(135deg,#0F172A 0%,#1E293B 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Sora',sans-serif",padding:16},
  landingCard:{textAlign:"center",maxWidth:460,width:"100%"},
  landingLogo:{fontSize:34,fontWeight:800,color:"#fff",marginBottom:6,letterSpacing:"-1px"},
  landingSub:{color:"#94A3B8",fontSize:13,marginBottom:32},
  landingBtns:{display:"flex",flexDirection:"column",gap:14},
  lBtn1:{display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:20,background:"#6366F1",border:"none",borderRadius:14,cursor:"pointer",color:"#fff"},
  lBtn2:{display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:20,background:"#1E293B",border:"1px solid #334155",borderRadius:14,cursor:"pointer",color:"#fff"},
  authCard:{background:"#fff",borderRadius:20,padding:34,maxWidth:390,width:"100%",display:"flex",flexDirection:"column",gap:12},
  authTitle:{fontSize:19,fontWeight:800,color:"#0F172A",textAlign:"center"},
  authSub:{fontSize:13,color:"#6B7280",textAlign:"center",marginTop:-6},
  backLink:{background:"none",border:"none",color:"#6366F1",cursor:"pointer",fontSize:13,fontWeight:600,textAlign:"left",padding:0},
  hint:{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#1D4ED8"},
  tenantApp:{minHeight:"100vh",background:"#F8FAFC",fontFamily:"'Sora',sans-serif"},
  tenantMain:{maxWidth:740,margin:"0 auto",padding:"26px 18px"},
  welcomeTitle:{fontSize:19,fontWeight:800,color:"#fff",marginBottom:4},
  welcomeSub:{fontSize:13,color:"#C7D2FE"},
  tenantStatCard:{background:"#fff",borderRadius:12,padding:14,textAlign:"center",boxShadow:"0 1px 3px rgba(0,0,0,.06)"},
  tenantStatVal:{fontSize:24,fontWeight:800,marginBottom:4},
  tenantStatLabel:{fontSize:11,color:"#6B7280",fontWeight:500},
  logoutBtn:{padding:"6px 12px",background:"#1E293B",border:"none",color:"#94A3B8",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16},
  modal:{background:"#fff",borderRadius:16,padding:0,maxWidth:480,width:"100%",position:"relative",maxHeight:"92vh",overflowY:"auto",overflow:"hidden"},
  modalClose:{position:"absolute",top:12,right:12,background:"none",border:"none",fontSize:17,cursor:"pointer",color:"#6B7280"},
  modalTitle:{fontSize:18,fontWeight:800,color:"#0F172A",marginBottom:4},
  modalSub:{fontSize:13,color:"#6B7280",marginBottom:4},
  toast:{position:"fixed",bottom:20,right:20,color:"#fff",padding:"12px 18px",borderRadius:10,fontWeight:600,fontSize:13,zIndex:2000,boxShadow:"0 4px 12px rgba(0,0,0,.15)"},
  formCard:{display:"flex",flexDirection:"column",gap:12,background:"#fff",borderRadius:14,padding:22,boxShadow:"0 1px 4px rgba(0,0,0,.07)"},
};

const InfoBox = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{border:"1px solid #E5E7EB",borderRadius:10,padding:"10px 14px"}}>
    <div style={{fontSize:10,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:.5,marginBottom:7}}>{title}</div>
    {children}
  </div>
);

const InfoRow = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0",fontSize:12,borderBottom:"1px solid #F8FAFC"}}>
    <span style={{color:"#6B7280"}}>{k}</span>
    <span style={{fontWeight:600,color:"#0F172A",textAlign:"right",maxWidth:"55%",wordBreak:"break-word"}}>{v}</span>
  </div>
);

const Row2 = ({ children }: { children: React.ReactNode }) => (
  <div className="rf-row2">{children}</div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{display:"flex",flexDirection:"column",gap:4}}>
    <label style={S.label}>{label}</label>
    {children}
  </div>
);

const Toast = ({ t }: { t: { msg: string; type: string } }) => (
  <div style={{...S.toast, background: t.type === "error" ? "#EF4444" : "#10B981"}}>{t.msg}</div>
);

function FilterBar({ search, setSearch, filterCity, setFilterCity, filterStatus, setFilterStatus, cities, showStatus }: {
  search: string; setSearch: (v: string) => void;
  filterCity: string; setFilterCity: (v: string) => void;
  filterStatus?: string; setFilterStatus?: (v: string) => void;
  cities: string[]; showStatus?: boolean;
}) {
  return (
    <div className="rf-filter-bar">
      <input style={{...S.input,maxWidth:260,flex:1}} placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}/>
      <select style={{...S.input,maxWidth:180}} value={filterCity} onChange={e => setFilterCity(e.target.value)}>
        <option value="">Toutes les villes</option>
        {cities.map(c => <option key={c}>{c}</option>)}
      </select>
      {showStatus && setFilterStatus && (
        <select style={{...S.input,maxWidth:150}} value={filterStatus || ""} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tous statuts</option>
          <option value="active">Actifs</option>
          <option value="closed">Clotures</option>
        </select>
      )}
      {(search || filterCity || filterStatus) && (
        <button style={{...S.smallBtn,background:"#FEF2F2",color:"#EF4444"}} onClick={() => { setSearch(""); setFilterCity(""); if (setFilterStatus) setFilterStatus(""); }}>X</button>
      )}
    </div>
  );
}

/* ─ Génère une couleur de couverture déterministe selon l'ID ─ */
function coverGradient(id: string) {
  const palettes = [
    "linear-gradient(135deg,#1e3a5f,#2563eb)","linear-gradient(135deg,#14532d,#16a34a)",
    "linear-gradient(135deg,#7c2d12,#ea580c)","linear-gradient(135deg,#4a1942,#9333ea)",
    "linear-gradient(135deg,#0f2942,#0ea5e9)","linear-gradient(135deg,#422006,#d97706)",
    "linear-gradient(135deg,#0d1f3c,#6366f1)","linear-gradient(135deg,#1a1a2e,#e11d48)",
  ];
  const idx = id.split("").reduce((s,c) => s + c.charCodeAt(0), 0) % palettes.length;
  return palettes[idx];
}

function initials(name: string) {
  return name.split(" ").slice(0,2).map(w => w[0]?.toUpperCase()||"").join("");
}

function ContractRow({ c, h, u, onClick, onNotif, showCity }: {
  c: Contract; h?: House; u: UnpaidItem[]; onClick: () => void; onNotif?: () => void; showCity?: boolean;
}) {
  const hasUnpaid = u.length > 0;
  const cover = c.coverPhoto?.data || null;
  const profile = c.profilePhoto?.data || null;
  const grad = coverGradient(c.id);

  return (
    <div
      style={{
        background:"#fff", borderRadius:18, overflow:"hidden",
        boxShadow: hasUnpaid
          ? "0 0 0 2px #FECACA, 0 4px 16px rgba(239,68,68,.10)"
          : "0 2px 12px rgba(15,23,42,.08)",
        cursor:"pointer", transition:"transform .18s, box-shadow .18s",
        display:"flex", flexDirection:"column",
      }}
      onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow=hasUnpaid?"0 0 0 2px #FECACA, 0 10px 28px rgba(239,68,68,.18)":"0 8px 28px rgba(15,23,42,.14)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow=hasUnpaid?"0 0 0 2px #FECACA, 0 4px 16px rgba(239,68,68,.10)":"0 2px 12px rgba(15,23,42,.08)"; }}
    >
      {/* ── COUVERTURE ─────────────────────────────── */}
      <div style={{height:110, position:"relative", overflow:"hidden", flexShrink:0,
        background: cover ? "transparent" : grad }}>
        {cover
          ? <img src={cover} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          : <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.12)"}}/>
        }
        {/* Badges flottants haut droite */}
        <div style={{position:"absolute",top:10,right:10,display:"flex",gap:5}}>
          {hasUnpaid && (
            <span style={{background:"#EF4444",color:"#fff",fontSize:10,fontWeight:800,padding:"3px 9px",borderRadius:20,
              boxShadow:"0 2px 8px rgba(239,68,68,.4)",letterSpacing:.3,display:"flex",alignItems:"center",gap:3}}>
              ⚠ {u.length} impayé{u.length>1?"s":""}
            </span>
          )}
          <span style={{background:c.status==="active"?"rgba(16,185,129,.92)":"rgba(100,116,139,.9)",
            color:"#fff",fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:20,
            backdropFilter:"blur(4px)",boxShadow:"0 1px 6px rgba(0,0,0,.25)"}}>
            {c.status==="active"?"● Actif":"● Clôturé"}
          </span>
        </div>
        {/* Loyer flottant bas gauche */}
        <div style={{position:"absolute",bottom:10,left:12,
          background:"rgba(0,0,0,.55)",backdropFilter:"blur(6px)",
          color:"#fff",fontWeight:800,fontSize:13,padding:"4px 12px",
          borderRadius:20,letterSpacing:-.3}}>
          {fmt(h?.rent??0)}<span style={{fontSize:10,fontWeight:400,opacity:.8}}>/mois</span>
        </div>
      </div>

      {/* ── CORPS ────────────────────────────────────── */}
      <div style={{padding:"0 16px 16px", flex:1}}>
        {/* Avatar chevauche la couverture */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginTop:-34,marginBottom:12}}>
          {/* Avatar */}
          <div style={{
            width:68, height:68, borderRadius:"50%",
            border:"4px solid #fff",
            background: profile ? "transparent" : grad,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:22, fontWeight:800, color:"#fff",
            overflow:"hidden", flexShrink:0,
            boxShadow:"0 3px 12px rgba(0,0,0,.18)",
          }}>
            {profile
              ? <img src={profile} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              : <span style={{userSelect:"none"}}>{initials(c.tenantName)}</span>
            }
          </div>
          {/* Actions */}
          <div style={{display:"flex",gap:6,paddingTop:38}} onClick={e=>e.stopPropagation()}>
            {onNotif && c.status==="active" && (
              <button style={{
                padding:"6px 12px", border:"1.5px solid #E5E7EB",
                background:"#fff", borderRadius:8, cursor:"pointer",
                fontSize:12, fontWeight:600, color:"#374151",
                display:"flex",alignItems:"center",gap:4,
                transition:"background .15s",
              }}
              onMouseEnter={e=>(e.currentTarget.style.background="#F8FAFC")}
              onMouseLeave={e=>(e.currentTarget.style.background="#fff")}
              onClick={onNotif}>📢 Notifier</button>
            )}
            <button style={{
              padding:"6px 16px", background:"#1877F2",
              border:"none", borderRadius:8, cursor:"pointer",
              fontSize:12, fontWeight:700, color:"#fff",
              boxShadow:"0 2px 6px rgba(24,119,242,.35)",
            }} onClick={onClick}>Voir profil</button>
          </div>
        </div>

        {/* Nom + localisation */}
        <div style={{fontWeight:800,color:"#0F172A",fontSize:16,marginBottom:2,lineHeight:1.2}}>{c.tenantName}</div>
        <div style={{fontSize:12,color:"#64748B",marginBottom:8,display:"flex",alignItems:"center",gap:4}}>
          <span style={{fontSize:11}}>📍</span>
          {h?.type}{showCity && h?.city ? ` · ${h.city}` : ""}{h?.address ? ` · ${h.address}` : ""}
        </div>

        {/* Séparateur + infos bas */}
        <div style={{borderTop:"1px solid #F1F5F9",paddingTop:10,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
          <div style={{fontSize:11,color:"#94A3B8"}}>
            Depuis le {new Date(c.startDate).toLocaleDateString("fr-FR")}
          </div>
          {hasUnpaid && (
            <span style={{fontSize:11,fontWeight:700,color:"#EF4444",
              background:"#FEF2F2",padding:"2px 8px",borderRadius:6}}>
              {u.reduce((s,x)=>s+x.amount,0).toLocaleString("fr-FR")} FCFA dûs
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── MOBILE MONEY MODAL ──────────────────────────────────────── */
function PaymentModal({ month, contract, onPay, onClose }: {
  month: UnpaidItem; contract?: Contract; onPay: (m: PaymentMethod) => void; onClose: () => void;
}) {
  const [sel, setSel] = useState<PaymentMethod | null>(null);
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState(contract?.tenantPhone || "");
  const [mmStep, setMmStep] = useState<"form"|"pending"|"confirm">("form");

  // Numeros marchands (a configurer avec vos vrais numeros)
  const MERCHANT: Record<string, string> = {
    orange: "0700000000",
    wave:   "0700000001",
    mtn:    "2500000000",
  };

  const cleanPhone = (p: string) => p.replace(/[\s\-+]/g, "");

  const initiateMM = () => {
    if (!sel || sel.id === "card") return;
    setMmStep("pending");
    const amount = month.amount;
    const ref = `RENT-${month.key}-${contract?.id || ""}`;

    setTimeout(() => {
      if (sel.id === "orange") {
        const ussd = `*144*1*1*${MERCHANT.orange}*${amount}*${ref}#`;
        window.location.href = `tel:${encodeURIComponent(ussd)}`;
      } else if (sel.id === "wave") {
        const memo = encodeURIComponent(`Loyer ${month.label}`);
        const deepLink = `wave://pay?phone=${MERCHANT.wave}&amount=${amount}&memo=${memo}`;
        try { window.location.href = deepLink; } catch {
          window.open(`https://wave.com/ci/pay?amount=${amount}&to=${MERCHANT.wave}`, "_blank");
        }
      } else if (sel.id === "mtn") {
        const ussd = `*133*1*1*${MERCHANT.mtn}*${amount}*${ref}#`;
        window.location.href = `tel:${encodeURIComponent(ussd)}`;
      }
      setMmStep("confirm");
    }, 800);
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <button onClick={onClose} style={S.modalClose}>X</button>
        <h2 style={S.modalTitle}>Paiement du loyer</h2>
        <div style={S.modalSub}>{month.label}</div>
        <div style={{fontSize:12,color:"#6B7280",marginBottom:4}}>Echeance : {month.dueDate}</div>
        <div style={{fontWeight:800,color:"#6366F1",fontSize:16,marginBottom:12}}>{fmt(month.amount)}</div>

        {step === 1 && <>
          <p style={{fontWeight:600,fontSize:13,color:"#374151",marginBottom:8}}>Moyen de paiement</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            {PAYMENT_METHODS.map(m => (
              <button key={m.id} onClick={() => setSel(m)} style={{padding:14,borderRadius:10,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6,background:"#fff",border:`2px solid ${sel?.id===m.id?m.color:"#E5E7EB"}`}}>
                <span style={{fontSize:26}}>{m.icon}</span>
                <span style={{fontSize:12,fontWeight:600}}>{m.name}</span>
                {m.id !== "card" && <span style={{fontSize:10,color:"#10B981",fontWeight:600}}>Paiement direct</span>}
              </button>
            ))}
          </div>
          <button disabled={!sel} onClick={() => setStep(2)} style={{...S.primaryBtn,width:"100%",opacity:sel?1:.4}}>Continuer</button>
        </>}

        {step === 2 && sel && <>
          <div style={{background:"#F3F4F6",padding:"10px 14px",borderRadius:8,margin:"12px 0",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:20}}>{sel.icon}</span>
            <div>
              <div style={{fontWeight:700,fontSize:14}}>{sel.name}</div>
              {sel.id !== "card" && <div style={{fontSize:11,color:"#6B7280"}}>Paiement Mobile Money integre CI</div>}
            </div>
          </div>

          {sel.id !== "card" && mmStep === "form" && <>
            <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#1D4ED8",marginBottom:12}}>
              Le paiement sera initie depuis votre telephone via {sel.name}. Une invite USSD ou l&apos;app s&apos;ouvrira automatiquement.
            </div>
            <Field label="Votre numero Mobile Money">
              <input style={S.input} placeholder="+225 07 xx xx xx" value={phone} onChange={e => setPhone(e.target.value)}/>
            </Field>
            <div style={{background:"#F8FAFC",border:"1px solid #E5E7EB",borderRadius:8,padding:"10px 14px",marginTop:10,fontSize:12}}>
              <div style={{fontWeight:700,color:"#374151",marginBottom:6}}>Recapitulatif :</div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span style={{color:"#6B7280"}}>Montant</span><span style={{fontWeight:700,color:"#6366F1"}}>{fmt(month.amount)}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span style={{color:"#6B7280"}}>Marchand</span><span style={{fontWeight:600}}>{MERCHANT[sel.id]}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0"}}><span style={{color:"#6B7280"}}>Reference</span><span style={{fontWeight:600,fontSize:11}}>{`RENT-${month.key}-${contract?.id}`}</span></div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:14}}>
              <button onClick={() => setStep(1)} style={S.ghostBtn}>Retour</button>
              <button onClick={initiateMM} disabled={!phone.trim()} style={{...S.primaryBtn,flex:1,background:sel.color,opacity:phone.trim()?1:.4}}>
                {sel.id === "orange" ? "Payer via Orange Money" : sel.id === "wave" ? "Payer via Wave" : "Payer via MTN MoMo"}
              </button>
            </div>
          </>}

          {sel.id !== "card" && mmStep === "pending" && <>
            <div style={{textAlign:"center",padding:"28px 0"}}>
              <div style={{fontSize:36,marginBottom:12}}>...</div>
              <div style={{fontWeight:700,color:"#374151",fontSize:15}}>Ouverture de {sel.name}...</div>
              <div style={{fontSize:12,color:"#6B7280",marginTop:6}}>Confirmez le paiement sur votre telephone</div>
            </div>
          </>}

          {sel.id !== "card" && mmStep === "confirm" && <>
            <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
              <div style={{fontWeight:700,color:"#92400E",marginBottom:6}}>Paiement initie !</div>
              <div style={{fontSize:12,color:"#78350F"}}>
                Completez le paiement sur votre telephone via {sel.name}.<br/>
                Apres confirmation par SMS, cliquez sur <b>Valider la reception</b>.
              </div>
            </div>
            <div style={{background:"#F8FAFC",borderRadius:8,padding:"10px 14px",fontSize:12,marginBottom:12}}>
              <div>{fmt(month.amount)} via {sel.name}</div>
              <div style={{color:"#6B7280"}}>Numero : {phone}</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={() => { setMmStep("form"); }} style={{...S.ghostBtn,padding:"10px 14px",fontSize:12}}>Recommencer</button>
              <button onClick={() => onPay(sel)} style={{...S.primaryBtn,flex:1,background:"#10B981"}}>Valider la reception</button>
            </div>
          </>}

          {sel.id === "card" && <>
            <Field label="Numero de carte"><input style={S.input} placeholder="1234 5678 9012 3456"/></Field>
            <Row2>
              <Field label="Expiration"><input style={S.input} placeholder="MM/AA"/></Field>
              <Field label="CVV"><input style={S.input} placeholder="123" maxLength={3}/></Field>
            </Row2>
            <div style={{fontSize:11,color:"#6B7280",marginTop:4}}>Paiement securise SSL</div>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={() => setStep(1)} style={S.ghostBtn}>Retour</button>
              <button onClick={() => onPay(sel)} style={{...S.primaryBtn,flex:1}}>Payer {fmt(month.amount)}</button>
            </div>
          </>}
        </>}
      </div>
    </div>
  );
}

function NotifModal({ contract, onSend, onClose }: { contract: Contract; onSend: () => void; onClose: () => void }) {
  const [msg, setMsg] = useState(`Bonjour ${contract.tenantName}, votre loyer est en attente. Merci de regulariser.`);
  const [ch, setCh] = useState("sms");
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <button onClick={onClose} style={S.modalClose}>X</button>
        <h2 style={S.modalTitle}>Notification</h2>
        <div style={S.modalSub}>A : {contract.tenantName} · {contract.tenantPhone}</div>
        <div style={{display:"flex",gap:8,margin:"12px 0"}}>
          {[["sms","SMS"],["email","Email"],["whatsapp","WhatsApp"]].map(([v,l]) => (
            <button key={v} onClick={() => setCh(v)} style={{padding:"8px 14px",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13,background:ch===v?"#6366F1":"#F3F4F6",color:ch===v?"#fff":"#374151"}}>{l}</button>
          ))}
        </div>
        <textarea style={{...S.input,resize:"vertical",minHeight:90,width:"100%"}} value={msg} onChange={e => setMsg(e.target.value)}/>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button onClick={onClose} style={S.ghostBtn}>Annuler</button>
          <button onClick={onSend} style={{...S.primaryBtn,flex:1}}>Envoyer</button>
        </div>
      </div>
    </div>
  );
}

function InstallGuide({ appUrl }: { appUrl: string }) {
  const [os, setOs] = useState("android");
  const steps: Record<string, { icon: string; text: string }[]> = {
    android: [
      { icon:"1.", text:"Ouvrir le lien dans Chrome sur Android" },
      { icon:"2.", text:"Appuyer sur les 3 points en haut a droite" },
      { icon:"3.", text:"Selectionner Ajouter a l'ecran d'accueil" },
      { icon:"4.", text:"Appuyer sur Ajouter pour confirmer" },
      { icon:"5.", text:"L'icone RentFlow CI apparait sur l'ecran d'accueil" },
    ],
    ios: [
      { icon:"1.", text:"Ouvrir le lien dans Safari sur iPhone/iPad" },
      { icon:"2.", text:"Appuyer sur le bouton Partager (carre avec fleche)" },
      { icon:"3.", text:"Sur l'ecran d'accueil" },
      { icon:"4.", text:"Appuyer sur Ajouter en haut a droite" },
      { icon:"5.", text:"L'icone RentFlow CI apparait sur l'ecran d'accueil" },
    ],
  };
  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {[["android","Android"],["ios","iPhone/iPad"]].map(([v,l]) => (
          <button key={v} onClick={() => setOs(v)} style={{flex:1,padding:"7px 10px",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,background:os===v?"#6366F1":"#E5E7EB",color:os===v?"#fff":"#374151"}}>{l}</button>
        ))}
      </div>
      <ol style={{listStyle:"none",padding:0,margin:0,display:"flex",flexDirection:"column",gap:8}}>
        {steps[os].map((s, i) => (
          <li key={i} style={{display:"flex",alignItems:"flex-start",gap:10,fontSize:13}}>
            <span style={{background:"#6366F1",color:"#fff",borderRadius:"50%",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>{i+1}</span>
            <span style={{color:"#374151"}}>{s.text}</span>
          </li>
        ))}
      </ol>
      <div style={{marginTop:8,fontSize:11,color:"#94A3B8",wordBreak:"break-all"}}>Lien : <b>{appUrl}</b></div>
    </div>
  );
}

function WelcomeModal({ data, onClose }: { data: { contract: Contract; house?: House; pin: string }; onClose: () => void }) {
  const { contract, house, pin } = data;
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [showInstall, setShowInstall] = useState(false);

  const msgText = `Bonjour ${contract.tenantName}\nVotre bail RentFlow CI est pret !\n\nN de contrat : ${contract.id}\nCode PIN : ${pin}\nBien : ${house?.type}, ${house?.address} - ${house?.city}\nConnectez-vous ici : ${appUrl}`;

  const copyAccess = () => {
    navigator.clipboard?.writeText(`N contrat : ${contract.id}\nCode PIN : ${pin}\nLien : ${appUrl}`);
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };
  const sendWhatsApp = () => {
    const p = (contract.tenantPhone || "").replace(/[\s\-+]/g,"");
    const ip = p.startsWith("0") ? `225${p.slice(1)}` : p;
    window.open(`https://wa.me/${ip}?text=${encodeURIComponent(msgText)}`, "_blank");
    setSent(true);
  };
  const sendSms = () => { window.open(`sms:${contract.tenantPhone?.replace(/\s/g,"")}?body=${encodeURIComponent(msgText)}`, "_blank"); setSent(true); };
  const sendEmail = () => {
    if (!contract.tenantEmail) return;
    window.open(`mailto:${contract.tenantEmail}?subject=${encodeURIComponent(`Acces RentFlow CI - Contrat ${contract.id}`)}&body=${encodeURIComponent(msgText)}`, "_blank");
    setSent(true);
  };

  return (
    <div style={S.overlay}>
      <div style={{...S.modal,maxWidth:500,padding:"26px 24px"}}>
        <button onClick={onClose} style={S.modalClose}>X</button>
        <div style={{textAlign:"center",marginBottom:18}}>
          <div style={{fontSize:38,marginBottom:6}}>Contrat cree !</div>
          <h2 style={{fontSize:18,fontWeight:800,color:"#0F172A",margin:0}}>Acces locataire prets</h2>
          <p style={{fontSize:13,color:"#6B7280",marginTop:4}}>Envoyez les codes a <b>{contract.tenantName}</b></p>
        </div>
        <div style={{background:"#F8FAFC",border:"1px solid #E5E7EB",borderRadius:12,padding:"14px 16px",marginBottom:14}}>
          {[["Locataire",contract.tenantName],["N contrat",contract.id],["Code PIN",pin],["Bien",`${house?.type} · ${house?.address}`]].map(([k,v]) => (
            <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0",borderBottom:"1px solid #F1F5F9"}}>
              <span style={{color:"#6B7280"}}>{k}</span>
              <span style={{fontWeight:k==="Code PIN"?800:700,color:k==="Code PIN"?"#10B981":k==="N contrat"?"#6366F1":"#0F172A",letterSpacing:k==="Code PIN"?3:0,fontSize:k==="Code PIN"?15:13}}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
          <div className="rf-unpaid-send-btns">
            <button style={{...S.primaryBtn,background:"#25D366",padding:"10px 12px",fontSize:13}} onClick={sendWhatsApp}>WhatsApp</button>
            <button style={{...S.primaryBtn,background:"#374151",padding:"10px 12px",fontSize:13}} onClick={sendSms}>SMS</button>
          </div>
          {contract.tenantEmail && <button style={{...S.primaryBtn,padding:"10px 12px",fontSize:13}} onClick={sendEmail}>Email</button>}
          <button style={{...S.primaryBtn,background:copied?"#10B981":"#0F172A",padding:"10px 12px",fontSize:13}} onClick={copyAccess}>
            {copied ? "Copie !" : "Copier les acces"}
          </button>
          {sent && <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:8,padding:"9px 12px",fontSize:12,color:"#166534",textAlign:"center"}}>Message envoye !</div>}
        </div>
        <div style={{border:"1px solid #E5E7EB",borderRadius:12,overflow:"hidden"}}>
          <button onClick={() => setShowInstall(v => !v)} style={{width:"100%",padding:"12px 16px",background:showInstall?"#F1F5F9":"#fff",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,fontWeight:700,color:"#0F172A"}}>
            <span>Installer l&apos;app sur mobile ?</span>
            <span style={{fontSize:11,color:"#6B7280"}}>{showInstall?"Reduire":"Voir"}</span>
          </button>
          {showInstall && <div style={{padding:"14px 16px",background:"#F8FAFC",borderTop:"1px solid #E5E7EB"}}><InstallGuide appUrl={appUrl}/></div>}
        </div>
        <button style={{...S.ghostBtn,width:"100%",marginTop:12}} onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}

/* ─── PDF PRINT ───────────────────────────────────────────────── */
function printContract(contract: Contract, house?: House) {
  const paidCount   = Object.values(contract.payments).filter(p => p.status === "paid").length;
  const unpaidCount = Object.values(contract.payments).filter(p => p.status === "unpaid").length;
  const totalPaid   = Object.values(contract.payments).filter(p => p.status === "paid").reduce((s,p) => s+p.amount,0);
  const advMonths   = Object.values(contract.payments).filter(p => p.method === "Avance").length;

  const rows = Object.entries(contract.payments).sort(([a],[b]) => b.localeCompare(a)).map(([,p]) =>
    `<tr><td>${p.label}</td><td>${p.dueDate}</td><td>${p.status==="paid"?p.date:"—"}</td><td style="color:${p.method==="Avance"?"#7c3aed":"inherit"}">${p.status==="paid"?p.method:"—"}</td><td style="color:${p.status==="paid"?"#10b981":p.overdue?"#ef4444":"#f59e0b"};font-weight:700">${p.status==="paid"?p.method==="Avance"?"Avance":"Paye":p.overdue?"En retard":"A payer"}</td><td style="text-align:right">${new Intl.NumberFormat("fr-FR").format(p.amount)} FCFA</td></tr>`
  ).join("");

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>Contrat ${contract.id}</title>
<style>
  @page{margin:18mm 14mm}
  body{font-family:Arial,sans-serif;font-size:12px;color:#1f2937}
  h1{font-size:20px;font-weight:800;color:#0f172a;margin:0 0 2px}
  h2{font-size:13px;font-weight:700;color:#374151;margin:18px 0 6px;border-bottom:2px solid #e5e7eb;padding-bottom:4px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:3px solid #6366f1;padding-bottom:14px}
  .logo{font-size:20px;font-weight:900;color:#6366f1}
  .badge{display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;color:#fff;background:${contract.status==="active"?"#10b981":"#6b7280"}}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px}
  .grid4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;text-align:center;margin-top:8px}
  .box{border:1px solid #e5e7eb;border-radius:8px;padding:10px}
  .bt{font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px}
  .row{display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid #f9fafb;font-size:11px}
  .key{color:#6b7280}.val{font-weight:600;color:#0f172a;text-align:right;max-width:58%}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#f8fafc;padding:6px 8px;text-align:left;font-weight:700;color:#6b7280;font-size:10px;text-transform:uppercase;border-bottom:2px solid #e5e7eb}
  td{padding:5px 8px;border-bottom:1px solid #f1f5f9}
  .bv{font-size:18px;font-weight:800;margin-bottom:2px}.bl{font-size:10px;color:#6b7280}
  .bilan{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px}
  .footer{margin-top:26px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center}
</style></head><body>
<div class="header">
  <div><div class="logo">RentFlow CI</div><div style="font-size:10px;color:#6b7280;margin-top:2px">Plateforme de gestion locative — Cote d'Ivoire</div></div>
  <div style="text-align:right"><h1>Contrat ${contract.id}</h1><span class="badge">${contract.status==="active"?"Actif":"Cloture"}</span><div style="font-size:10px;color:#6b7280;margin-top:5px">Imprime le ${new Date().toLocaleDateString("fr-FR")}</div></div>
</div>
<div class="grid2">
  <div class="box"><div class="bt">Locataire</div><div class="row"><span class="key">Nom</span><span class="val">${contract.tenantName}</span></div><div class="row"><span class="key">Tel.</span><span class="val">${contract.tenantPhone||"—"}</span></div><div class="row"><span class="key">Email</span><span class="val">${contract.tenantEmail||"—"}</span></div></div>
  <div class="box"><div class="bt">Bien loue</div><div class="row"><span class="key">Ref.</span><span class="val">${house?.id||"—"}</span></div><div class="row"><span class="key">Type</span><span class="val">${house?.type||"—"}</span></div><div class="row"><span class="key">Adresse</span><span class="val">${house?.address||"—"}, ${house?.city||""}</span></div><div class="row"><span class="key">Loyer</span><span class="val">${new Intl.NumberFormat("fr-FR").format(house?.rent??0)} FCFA/mois</span></div></div>
</div>
<div class="grid3">
  <div class="box"><div class="bt">Bail</div><div class="row"><span class="key">Date d'effet</span><span class="val">${new Date(contract.startDate).toLocaleDateString("fr-FR")}</span></div><div class="row"><span class="key">Edition</span><span class="val">${contract.editDate||"—"}</span></div>${contract.endDate?`<div class="row"><span class="key">Cloture</span><span class="val">${contract.endDate}</span></div>`:""}</div>
  <div class="box"><div class="bt">Caution</div><div class="row"><span class="key">Statut</span><span class="val" style="color:${contract.caution?.paid?"#10b981":"#ef4444"}">${contract.caution?.paid?"Payee":"Non payee"}</span></div><div class="row"><span class="key">Montant</span><span class="val">${new Intl.NumberFormat("fr-FR").format(contract.caution?.amount||0)} FCFA</span></div></div>
  <div class="box"><div class="bt">Avance</div><div class="row"><span class="key">Mois</span><span class="val">${advMonths}</span></div><div class="row"><span class="key">Montant</span><span class="val">${new Intl.NumberFormat("fr-FR").format(contract.advance?.amount||0)} FCFA</span></div></div>
</div>
<div class="grid2">
  <div class="box"><div class="bt">Contact d'urgence</div><div class="row"><span class="key">Nom</span><span class="val">${contract.emergencyName||"—"}</span></div><div class="row"><span class="key">Relation</span><span class="val">${contract.emergencyRelation||"—"}</span></div><div class="row"><span class="key">Tel.</span><span class="val">${contract.emergencyPhone||"—"}</span></div></div>
  <div class="bilan"><div class="bt">Bilan financier</div><div class="grid4"><div><div class="bv" style="color:#10b981">${paidCount}</div><div class="bl">Mois payes</div></div><div><div class="bv" style="color:#7c3aed">${advMonths}</div><div class="bl">Avance</div></div><div><div class="bv" style="color:${unpaidCount>0?"#ef4444":"#10b981"}">${unpaidCount}</div><div class="bl">Impayes</div></div><div><div class="bv" style="color:#6366f1;font-size:13px">${new Intl.NumberFormat("fr-FR").format(totalPaid)}</div><div class="bl">FCFA encaisses</div></div></div></div>
</div>
<h2>Historique des paiements</h2>
<table><thead><tr><th>Mois</th><th>Echeance</th><th>Date paiement</th><th>Methode</th><th>Statut</th><th style="text-align:right">Montant</th></tr></thead><tbody>${rows}</tbody></table>
<div class="footer">Document genere par RentFlow CI — ${new Date().toLocaleDateString("fr-FR")} · Contrat ${contract.id}</div>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) { alert("Autorisez les pop-ups pour imprimer."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

/* ─── CONTRACT DETAIL ────────────────────────────────────────── */
function ContractDetail({ contract, house, onClose, onNotif, onCloseContract, isOwner, onUpdateContract }: {
  contract: Contract; house?: House; onClose: () => void;
  onNotif?: () => void; onCloseContract?: () => void;
  isOwner: boolean; onUpdateContract?: (patch: Partial<Contract>) => void;
}) {
  const [confirmClose, setConfirmClose] = useState(false);
  const [idTab, setIdTab] = useState<"recto"|"verso">("recto");
  const [localRecto, setLocalRecto] = useState(contract.idRecto);
  const [localVerso, setLocalVerso] = useState(contract.idVerso);
  const [localProfile, setLocalProfile] = useState(contract.profilePhoto);
  const [localCover, setLocalCover] = useState(contract.coverPhoto);

  const unpaidCount = Object.values(contract.payments).filter(p => p.status === "unpaid").length;
  const paidCount   = Object.values(contract.payments).filter(p => p.status === "paid").length;
  const totalPaid   = Object.values(contract.payments).filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const advMonths   = Object.values(contract.payments).filter(p => p.method === "Avance").length;

  const uploadId = (side: "recto"|"verso", file: File | null) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      const d = { name: file.name, data: ev.target!.result as string, type: file.type };
      if (side === "recto") { setLocalRecto(d); onUpdateContract?.({ idRecto: d }); }
      else                  { setLocalVerso(d); onUpdateContract?.({ idVerso: d }); }
    };
    r.readAsDataURL(file);
  };

  const uploadPhoto = (which: "profile"|"cover", file: File | null) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      const d = { name: file.name, data: ev.target!.result as string, type: file.type };
      if (which === "profile") { setLocalProfile(d); onUpdateContract?.({ profilePhoto: d }); }
      else                     { setLocalCover(d);  onUpdateContract?.({ coverPhoto: d });  }
    };
    r.readAsDataURL(file);
  };

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{...S.modal,maxWidth:720,width:"96%",padding:0,overflow:"hidden"}}>
        {/* ══ COVER FACEBOOK-STYLE ══════════════════════════ */}
        <div style={{height:170, position:"relative", overflow:"hidden", flexShrink:0,
          background: localCover ? "transparent" : coverGradient(contract.id)}}>
          {localCover && <img src={localCover.data} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
          {/* Gradient overlay bottom */}
          <div style={{position:"absolute",bottom:0,left:0,right:0,height:60,
            background:"linear-gradient(to top,rgba(0,0,0,.45),transparent)"}}/>
          {/* Fermer */}
          <button onClick={onClose} style={{
            position:"absolute",top:12,right:12,
            background:"rgba(0,0,0,.45)",backdropFilter:"blur(4px)",
            border:"none",color:"#fff",borderRadius:"50%",
            width:34,height:34,cursor:"pointer",fontSize:18,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontWeight:300,lineHeight:1,
          }}>×</button>
          {/* Upload couverture */}
          {isOwner && (
            <label style={{
              position:"absolute",bottom:12,right:12,
              background:"rgba(0,0,0,.55)",backdropFilter:"blur(4px)",
              border:"1px solid rgba(255,255,255,.25)",
              color:"#fff",borderRadius:8,padding:"5px 11px",
              cursor:"pointer",fontSize:11,fontWeight:600,
              display:"flex",alignItems:"center",gap:5,
            }}>
              📷 Modifier la couverture
              <input type="file" accept="image/*" style={{display:"none"}} onChange={e => uploadPhoto("cover", e.target.files?.[0]??null)}/>
            </label>
          )}
        </div>

        <div style={{padding:"0 24px 24px"}}>
          {/* ── Avatar + infos (style profil Facebook) ── */}
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginTop:-44,marginBottom:14,flexWrap:"wrap",gap:10}}>
            {/* Avatar avec bouton upload */}
            <div style={{position:"relative",flexShrink:0}}>
              <div style={{
                width:88,height:88,borderRadius:"50%",
                border:"4px solid #fff",
                background: localProfile ? "transparent" : coverGradient(contract.id),
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:28,fontWeight:800,color:"#fff",
                overflow:"hidden",
                boxShadow:"0 4px 16px rgba(0,0,0,.22)",
              }}>
                {localProfile
                  ? <img src={localProfile.data} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  : <span style={{userSelect:"none"}}>{initials(contract.tenantName)}</span>
                }
              </div>
              {isOwner && (
                <label style={{
                  position:"absolute",bottom:2,right:2,
                  background:"#1877F2",border:"2px solid #fff",
                  borderRadius:"50%",width:26,height:26,cursor:"pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:13,boxShadow:"0 2px 6px rgba(0,0,0,.2)",
                }}>
                  📷
                  <input type="file" accept="image/*" style={{display:"none"}} onChange={e => uploadPhoto("profile", e.target.files?.[0]??null)}/>
                </label>
              )}
            </div>
            {/* Nom + infos */}
            <div style={{flex:1,minWidth:160,paddingBottom:4}}>
              <h2 style={{fontSize:21,fontWeight:800,color:"#0F172A",margin:0,lineHeight:1.2}}>{contract.tenantName}</h2>
              <div style={{fontSize:12,color:"#64748B",marginTop:3,display:"flex",alignItems:"center",gap:3}}>
                <span>📍</span>
                {house?.type} · {house?.rooms} pièce{(house?.rooms??0)>1?"s":""} · {house?.address}{house?.city?`, ${house.city}`:""}
              </div>
              <div style={{fontSize:11,color:"#94A3B8",marginTop:3}}>
                Contrat <strong style={{color:"#6366F1"}}>{contract.id}</strong> · Effet le {new Date(contract.startDate).toLocaleDateString("fr-FR")}
              </div>
            </div>
            {/* Badge statut */}
            <span style={{
              padding:"6px 16px",borderRadius:20,fontSize:12,fontWeight:700,color:"#fff",
              background:contract.status==="active"?"#10B981":"#64748B",
              boxShadow:contract.status==="active"?"0 2px 8px rgba(16,185,129,.35)":"none",
              alignSelf:"flex-start",marginTop:8,
            }}>
              {contract.status==="active"?"● Actif":"● Clôturé"}
            </span>
          </div>

        {isOwner && unpaidCount > 0 && (
          <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#991B1B",fontWeight:600}}>
            {unpaidCount} loyer(s) impaye(s) — cloture bloquee.
          </div>
        )}

        {confirmClose && (
          <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
            <div style={{fontWeight:700,color:"#991B1B",marginBottom:8}}>Confirmer la cloture du contrat {contract.id} ?</div>
            <div style={{fontSize:12,color:"#7F1D1D",marginBottom:12}}>La maison sera disponible et le locataire perdra l&apos;acces.</div>
            <div style={{display:"flex",gap:8}}>
              <button style={{...S.primaryBtn,background:"#EF4444",padding:"8px 18px",fontSize:13}} onClick={() => { setConfirmClose(false); onCloseContract?.(); }}>Oui, cloturer</button>
              <button style={{...S.ghostBtn,padding:"8px 18px",fontSize:13}} onClick={() => setConfirmClose(false)}>Annuler</button>
            </div>
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div className="rf-detail-2col">
            <InfoBox title="Locataire">
              <InfoRow k="Nom" v={contract.tenantName}/>
              <InfoRow k="Tel." v={contract.tenantPhone||"—"}/>
              <InfoRow k="Email" v={contract.tenantEmail||"—"}/>
            </InfoBox>
            <InfoBox title="Bien loue">
              <InfoRow k="Ref." v={house?.id}/>
              <InfoRow k="Type" v={house?.type||"—"}/>
              <InfoRow k="Pieces" v={`${house?.rooms}`}/>
              <InfoRow k="Adresse" v={`${house?.address}, ${house?.city}`}/>
              <InfoRow k="Loyer" v={fmt(house?.rent??0)}/>
            </InfoBox>
          </div>

          <div className="rf-detail-3col">
            <InfoBox title="Bail">
              <InfoRow k="Date d'effet" v={new Date(contract.startDate).toLocaleDateString("fr-FR")}/>
              <InfoRow k="Edition" v={contract.editDate||"—"}/>
              {contract.endDate && <InfoRow k="Cloture" v={contract.endDate}/>}
              <InfoRow k="Statut" v={<span style={{...S.badge,background:contract.status==="active"?"#10B981":"#6B7280"}}>{contract.status==="active"?"Actif":"Cloture"}</span>}/>
            </InfoBox>
            <InfoBox title="Caution">
              <InfoRow k="Statut" v={<span style={{...S.badge,background:contract.caution?.paid?"#10B981":"#EF4444"}}>{contract.caution?.paid?"Payee":"Non payee"}</span>}/>
              <InfoRow k="Montant" v={fmt(contract.caution?.amount||0)}/>
            </InfoBox>
            <InfoBox title="Avance">
              <InfoRow k="Mois" v={`${advMonths}`}/>
              <InfoRow k="Montant" v={fmt(contract.advance?.amount||0)}/>
            </InfoBox>
          </div>

          <div className="rf-detail-2col">
            <InfoBox title="Bilan">
              <InfoRow k="Mois payes"    v={<span style={{color:"#10B981",fontWeight:700}}>{paidCount}</span>}/>
              <InfoRow k="dont avance"   v={<span style={{color:"#6366F1",fontWeight:700}}>{advMonths}</span>}/>
              <InfoRow k="Impayes"       v={<span style={{color:unpaidCount>0?"#EF4444":"#10B981",fontWeight:700}}>{unpaidCount}</span>}/>
              <InfoRow k="Total encaisse" v={<span style={{color:"#10B981",fontWeight:700}}>{fmt(totalPaid)}</span>}/>
            </InfoBox>
            <InfoBox title="Urgence">
              <InfoRow k="Nom"       v={contract.emergencyName||"—"}/>
              <InfoRow k="Relation"  v={contract.emergencyRelation||"—"}/>
              <InfoRow k="Tel."      v={contract.emergencyPhone||"—"}/>
            </InfoBox>
          </div>

          <InfoBox title="Piece d'identite">
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              {(["recto","verso"] as const).map(s => (
                <button key={s} onClick={() => setIdTab(s)} style={{padding:"5px 14px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:600,fontSize:12,background:idTab===s?"#6366F1":"#F3F4F6",color:idTab===s?"#fff":"#374151"}}>
                  {s==="recto"?"Recto":"Verso"}
                  {((s==="recto"&&localRecto)||(s==="verso"&&localVerso)) && <span style={{marginLeft:4,color:idTab===s?"#fff":"#10B981"}}>ok</span>}
                </button>
              ))}
            </div>
            {idTab === "recto" && (localRecto
              ? <img src={localRecto.data} alt="Recto CNI" style={{maxWidth:"100%",maxHeight:180,borderRadius:8,border:"1px solid #E5E7EB"}}/>
              : isOwner
                ? <div><p style={{fontSize:12,color:"#6B7280",marginBottom:6}}>Aucune image recto.</p><input type="file" accept="image/*" style={{fontSize:12}} onChange={e => uploadId("recto", e.target.files?.[0]??null)}/></div>
                : <p style={{fontSize:12,color:"#6B7280"}}>Non disponible</p>
            )}
            {idTab === "verso" && (localVerso
              ? <img src={localVerso.data} alt="Verso CNI" style={{maxWidth:"100%",maxHeight:180,borderRadius:8,border:"1px solid #E5E7EB"}}/>
              : isOwner
                ? <div><p style={{fontSize:12,color:"#6B7280",marginBottom:6}}>Aucune image verso.</p><input type="file" accept="image/*" style={{fontSize:12}} onChange={e => uploadId("verso", e.target.files?.[0]??null)}/></div>
                : <p style={{fontSize:12,color:"#6B7280"}}>Non disponible</p>
            )}
          </InfoBox>

          <div>
            <div style={{fontSize:11,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>Historique des paiements</div>
            <div style={S.historyTable}>
              <div className="rf-history-head"><span>Mois</span><span>Echeance</span><span>Date paiement</span><span>Methode</span><span>Statut</span></div>
              {Object.entries(contract.payments).sort(([a],[b]) => b.localeCompare(a)).map(([key,p]) => (
                <div key={key} className="rf-history-row" style={{background:p.method==="Avance"?"#F5F3FF":p.status==="unpaid"&&p.overdue?"#FFF1F2":"transparent"}}>
                  <span style={{fontWeight:600}}>{p.label}</span>
                  <span style={{fontSize:11,color:"#6B7280"}}>{p.dueDate}</span>
                  <span>{p.status==="paid"?p.date:"—"}</span>
                  <span style={{color:p.method==="Avance"?"#7C3AED":"inherit"}}>{p.status==="paid"?p.method:"—"}</span>
                  <span style={{color:p.status==="paid"?p.method==="Avance"?"#7C3AED":"#10B981":p.overdue?"#EF4444":"#F59E0B",fontWeight:700}}>
                    {p.status==="paid"?p.method==="Avance"?"Avance":"Paye":p.overdue?"En retard":"A payer"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isOwner && (
          <div style={{display:"flex",gap:10,marginTop:16,paddingTop:14,borderTop:"1px solid #F1F5F9",flexWrap:"wrap"}}>
            <button
              style={{padding:"8px 16px",background:"#0F172A",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13}}
              onClick={() => printContract(contract, house)}>
              Imprimer / PDF
            </button>
            {onNotif && <button style={S.smallBtn} onClick={onNotif}>Notifier</button>}
            {onCloseContract && contract.status === "active" && !confirmClose && (
              <button
                style={{padding:"8px 16px",background:unpaidCount>0?"#9CA3AF":"#EF4444",color:"#fff",border:"none",borderRadius:8,cursor:unpaidCount>0?"not-allowed":"pointer",fontWeight:700,fontSize:13}}
                onClick={() => { if (unpaidCount > 0) return; setConfirmClose(true); }}>
                Cloturer{unpaidCount>0?` (${unpaidCount} impaye${unpaidCount>1?"s":""})`:""}
              </button>
            )}
          </div>
        )}
        </div>{/* end padding wrapper */}
      </div>
    </div>
  );
}

/* ─── TENANT PORTAL ──────────────────────────────────────────── */
function TenantPortal({ contracts, houses, session, setSession, updatePayment, onBack, showToast }: {
  contracts: Contract[]; houses: House[];
  session: string | null; setSession: (id: string | null) => void;
  updatePayment: (cid: string, key: string, method: PaymentMethod) => void;
  onBack: () => void; showToast: (msg: string, type?: string) => void;
}) {
  const [contractId, setContractId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [payModal, setPayModal] = useState<UnpaidItem | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const login = () => {
    const c = contracts.find(x => x.id.toLowerCase() === contractId.trim().toLowerCase() && x.pin === pin.trim());
    if (!c) { setError("Numero de contrat ou PIN incorrect."); return; }
    if (c.status === "closed") { setError("Ce contrat est cloture. Acces refuse."); return; }
    setSession(c.id); setError("");
  };

  if (!session) return (
    <div style={S.landing}>
      <div style={S.authCard}>
        <button onClick={onBack} style={S.backLink}>Retour</button>
        <div style={{fontSize:40,textAlign:"center"}}>🏡</div>
        <h2 style={S.authTitle}>Espace Locataire</h2>
        <p style={S.authSub}>Connectez-vous avec votre n de contrat et PIN</p>
        <label style={S.label}>Numero de contrat</label>
        <input style={S.input} placeholder="ex: C001" value={contractId} onChange={e => setContractId(e.target.value)} onKeyDown={e => e.key==="Enter"&&login()}/>
        <label style={S.label}>Code PIN</label>
        <input style={S.input} type="password" maxLength={4} placeholder="••••" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key==="Enter"&&login()}/>
        {error && <p style={{color:"#EF4444",fontSize:13}}>{error}</p>}
        <div style={S.hint}>Demo : C001/1234 · C002/5678 · C003/9999</div>
        <button style={{...S.primaryBtn,width:"100%",marginTop:8}} onClick={login}>Se connecter</button>
      </div>
    </div>
  );

  const contract = contracts.find(c => c.id === session);
  if (!contract) return null;

  if (contract.status === "closed") return (
    <div style={S.landing}>
      <div style={S.authCard}>
        <div style={{fontSize:40,textAlign:"center"}}>🔒</div>
        <h2 style={S.authTitle}>Acces revoue</h2>
        <p style={{fontSize:13,color:"#6B7280",textAlign:"center"}}>Votre contrat <b>{contract.id}</b> a ete cloture.</p>
        <button style={{...S.primaryBtn,width:"100%",marginTop:8}} onClick={() => { setSession(null); onBack(); }}>Retour</button>
      </div>
    </div>
  );

  const house = houses.find(h => h.id === contract.houseId);
  const advancePaid = Object.values(contract.payments).filter(p => p.method === "Avance").length;
  const unpaid = Object.entries(contract.payments).filter(([,v]) => v.status === "unpaid").map(([k,v]) => ({ key:k, label:v.label, dueDate:v.dueDate, overdue:v.overdue??false, amount:v.amount }));
  const paid  = Object.values(contract.payments).filter(p => p.status === "paid").length;
  const total = Object.keys(contract.payments).length;

  return (
    <div style={S.tenantApp}>
      {payModal && <PaymentModal month={payModal} contract={contract} onPay={method => { updatePayment(contract.id, payModal.key, method); setPayModal(null); showToast(`Paiement via ${method.name} enregistre !`); }} onClose={() => setPayModal(null)}/>}
      {showDetail && <ContractDetail contract={contract} house={house} onClose={() => setShowDetail(false)} isOwner={false}/>}
      <header className="rf-tenant-header" style={{background:"#0F172A",padding:"13px 26px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={S.logo}>
          <div style={{width:36,height:36,background:"#1877F2",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏠</div>
          <span style={{color:"#F8FAFC",fontWeight:800,fontSize:16,letterSpacing:"-0.4px"}}>RentFlow CI</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span className="tenant-name" style={{fontSize:13,color:"#94A3B8"}}>{contract.tenantName}</span>
          <button style={S.logoutBtn} onClick={() => { setSession(null); onBack(); }}>Deconnexion</button>
        </div>
      </header>
      <div style={S.tenantMain}>
        <div className="rf-welcome-card" style={{background:"linear-gradient(135deg,#6366F1,#8B5CF6)",borderRadius:14,padding:"22px 26px",marginBottom:18}}>
          <div>
            <div style={S.welcomeTitle}>Bonjour, {contract.tenantName.split(" ")[0]}</div>
            <div style={S.welcomeSub}>{house?.type} · {house?.address} · {house?.city}</div>
            <div style={{fontSize:12,color:"#A5B4FC",marginTop:2}}>Contrat {contract.id} · depuis {new Date(contract.startDate).toLocaleDateString("fr-FR")}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:12,color:"#A5B4FC",marginBottom:2}}>Loyer mensuel</div>
            <div style={{fontSize:22,fontWeight:800,color:"#fff"}}>{fmt(house?.rent??0)}</div>
            <button style={{...S.smallBtn,marginTop:8,background:"rgba(255,255,255,.15)",color:"#fff",border:"1px solid rgba(255,255,255,.3)"}} onClick={() => setShowDetail(true)}>Mon contrat</button>
          </div>
        </div>

        {advancePaid > 0 && (
          <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:20}}>📅</span>
            <div>
              <div style={{fontWeight:700,color:"#1D4ED8",fontSize:13}}>Avance sur loyer</div>
              <div style={{fontSize:12,color:"#3B82F6"}}>{advancePaid} mois couverts ({fmt(contract.advance?.amount||0)})</div>
            </div>
          </div>
        )}

        <div className="rf-tenant-stats">
          {[
            {label:"Mois payes",value:paid,color:"#10B981"},
            {label:"Impayes",value:unpaid.length,color:unpaid.length>0?"#EF4444":"#10B981"},
            {label:"Total mois",value:total,color:"#6366F1"},
          ].map(s => (
            <div key={s.label} style={S.tenantStatCard}>
              <div style={{...S.tenantStatVal,color:s.color}}>{s.value}</div>
              <div style={S.tenantStatLabel}>{s.label}</div>
            </div>
          ))}
        </div>

        {unpaid.length > 0 ? (
          <section style={S.section}>
            <h3 style={S.sectionTitle}>Loyers a payer</h3>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {unpaid.map(u => (
                <div key={u.key} style={{...S.unpaidRow,background:u.overdue?"#FEF2F2":"#FFF7ED"}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13}}>{u.label}</div>
                    <div style={{fontSize:11,color:u.overdue?"#EF4444":"#92400E"}}>Echeance : {u.dueDate}{u.overdue?" - En retard":""}</div>
                  </div>
                  <div style={{fontWeight:800,color:u.overdue?"#EF4444":"#92400E"}}>{fmt(u.amount)}</div>
                  <button style={S.payNowBtn} onClick={() => setPayModal(u)}>Payer</button>
                </div>
              ))}
            </div>
          </section>
        ) : <div style={S.allGood}>Tous vos loyers sont a jour — Merci !</div>}

        <section style={S.section}>
          <h3 style={S.sectionTitle}>Historique des paiements</h3>
          <div style={S.historyTable}>
            <div className="rf-history-head"><span>Mois</span><span>Echeance</span><span>Date paiement</span><span>Methode</span><span>Statut</span></div>
            {Object.entries(contract.payments).sort(([a],[b]) => b.localeCompare(a)).map(([key,p]) => (
              <div key={key} className="rf-history-row" style={{background:p.method==="Avance"?"#F5F3FF":p.status==="unpaid"&&p.overdue?"#FFF1F2":"transparent"}}>
                <span style={{fontWeight:600}}>{p.label}</span>
                <span style={{fontSize:11,color:"#6B7280"}}>{p.dueDate}</span>
                <span>{p.status==="paid"?p.date:"—"}</span>
                <span style={{color:p.method==="Avance"?"#7C3AED":"inherit"}}>{p.status==="paid"?p.method:"—"}</span>
                <span style={{color:p.status==="paid"?p.method==="Avance"?"#7C3AED":"#10B981":p.overdue?"#EF4444":"#F59E0B",fontWeight:700}}>
                  {p.status==="paid"?p.method==="Avance"?"Avance":"Paye":p.overdue?"En retard":"A payer"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ─── OWNER PORTAL ───────────────────────────────────────────── */
function OwnerPortal({ houses, contracts, authed, setAuthed, onBack, addHouse, addContract, closeContract, updatePayment, updateContract, showToast, toast }: {
  houses: House[]; contracts: Contract[];
  authed: boolean; setAuthed: (v: boolean) => void; onBack: () => void;
  addHouse: (f: Record<string,string>) => void;
  addContract: (f: Record<string,string|number|null>) => { contract: Contract; house?: House; pin: string };
  closeContract: (id: string) => void;
  updatePayment: (cid: string, key: string, method: PaymentMethod) => void;
  updateContract: (cid: string, patch: Partial<Contract>) => void;
  showToast: (msg: string, type?: string) => void;
  toast: { msg: string; type: string } | null;
}) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [view, setView] = useState("dashboard");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [payModal, setPayModal] = useState<{ month: UnpaidItem; contractId: string } | null>(null);
  const [notifModal, setNotifModal] = useState<Contract | null>(null);
  const [welcomeModal, setWelcomeModal] = useState<{ contract: Contract; house?: House; pin: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const emptyAhf = { address:"", city:"Abidjan", type:"Appartement", rooms:"2", rent:"" };
  const [ahf, setAhf] = useState(emptyAhf);

  type AcfIdFile = { name: string; data: string; type: string } | null;
  const emptyAcf: { houseId:string; tenantName:string; tenantPhone:string; tenantEmail:string; startDate:string; idRecto:AcfIdFile; idVerso:AcfIdFile; profilePhoto:AcfIdFile; coverPhoto:AcfIdFile; emergencyName:string; emergencyPhone:string; emergencyRelation:string; cautionPaid:string; cautionAmount:string; advancePaid:string; advanceAmount:string; advanceMonths:string } = { houseId:"", tenantName:"", tenantPhone:"", tenantEmail:"", startDate:"", idRecto:null, idVerso:null, profilePhoto:null, coverPhoto:null, emergencyName:"", emergencyPhone:"", emergencyRelation:"", cautionPaid:"oui", cautionAmount:"", advancePaid:"oui", advanceAmount:"", advanceMonths:"1" };
  const [acf, setAcf] = useState(emptyAcf);

  const getUnpaid = (c: Contract): UnpaidItem[] =>
    Object.entries(c.payments).filter(([,v]) => v.status === "unpaid").map(([k,v]) => ({ key:k, label:v.label, dueDate:v.dueDate, overdue:v.overdue??false, amount:v.amount }));

  const allUnpaid = contracts.filter(c => c.status === "active").flatMap(c => {
    const h = houses.find(x => x.id === c.houseId);
    return getUnpaid(c).map(u => ({ ...u, tenantName:c.tenantName, address:h?.address, city:h?.city, contractId:c.id }));
  });

  const filteredContracts = contracts.filter(c => {
    const h = houses.find(x => x.id === c.houseId);
    const q = search.toLowerCase();
    return (!q || (c.tenantName.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || (h?.address||"").toLowerCase().includes(q)))
      && (!filterCity || h?.city === filterCity)
      && (!filterStatus || c.status === filterStatus);
  });

  const totalRecovered = contracts.flatMap(c => Object.values(c.payments).filter(p => p.status==="paid").map(p => p.amount)).reduce((a,b) => a+b, 0);
  const totalExpected  = contracts.flatMap(c => Object.values(c.payments).map(p => p.amount)).reduce((a,b) => a+b, 0);
  const totalRemaining = totalExpected - totalRecovered;

  const navReset = () => { setSearch(""); setFilterCity(""); setFilterStatus(""); };

  if (!authed) return (
    <div style={S.landing}>
      <div style={S.authCard}>
        <button onClick={onBack} style={S.backLink}>Retour</button>
        <div style={{fontSize:40,textAlign:"center"}}>👔</div>
        <h2 style={S.authTitle}>Espace Proprietaire</h2>
        <label style={S.label}>Code PIN</label>
        <input style={S.input} type="password" maxLength={6} placeholder="••••" value={pin}
          onChange={e => setPin(e.target.value)}
          onKeyDown={e => e.key==="Enter" && (pin==="0000" ? (setAuthed(true),setErr("")) : setErr("PIN incorrect."))}/>
        {err && <p style={{color:"#EF4444",fontSize:13}}>{err}</p>}
        <div style={S.hint}>Demo : PIN = 0000</div>
        <button style={{...S.primaryBtn,width:"100%",marginTop:8}} onClick={() => pin==="0000" ? (setAuthed(true),setErr("")) : setErr("PIN incorrect.")}>Acceder</button>
      </div>
    </div>
  );

  const detail = detailId ? contracts.find(c => c.id === detailId) : null;
  const detailHouse = detail ? houses.find(h => h.id === detail.houseId) : undefined;

  const handleCloseContract = (cid: string) => {
    const c = contracts.find(x => x.id === cid);
    if (!c) return;
    const unpaid = Object.values(c.payments).filter(p => p.status === "unpaid");
    if (unpaid.length > 0) { showToast(`${unpaid.length} loyer(s) impaye(s). Reglez-les avant la cloture.`, "error"); return; }
    closeContract(cid);
    setDetailId(null);
    showToast("Contrat cloture — Maison disponible");
  };

  const handleAddContract = () => {
    if (!acf.houseId || !acf.tenantName || !acf.startDate) { showToast("Remplissez les champs obligatoires *","error"); return; }
    const result = addContract(acf as unknown as Record<string,string|number|null>);
    setAcf(emptyAcf);
    setView("pinInfo"); // Redirige vers codes PIN apres creation
    setWelcomeModal(result);
    showToast(`Bail cree ! Code PIN : ${result.pin}`);
  };

  const payContract = payModal ? contracts.find(c => c.id === payModal.contractId) : undefined;

  return (
    <div style={S.app}>
      {toast && <Toast t={toast}/>}
      {notifModal && <NotifModal contract={notifModal} onSend={() => { showToast("Notification envoyee"); setNotifModal(null); }} onClose={() => setNotifModal(null)}/>}
      {payModal && <PaymentModal month={payModal.month} contract={payContract} onPay={method => { updatePayment(payModal.contractId, payModal.month.key, method); setPayModal(null); showToast("Paiement enregistre"); }} onClose={() => setPayModal(null)}/>}
      {welcomeModal && <WelcomeModal data={welcomeModal} onClose={() => setWelcomeModal(null)}/>}
      {detail && (
        <ContractDetail contract={detail} house={detailHouse} isOwner
          onClose={() => setDetailId(null)}
          onNotif={() => { setDetailId(null); setNotifModal(detail); }}
          onCloseContract={() => handleCloseContract(detail.id)}
          onUpdateContract={patch => updateContract(detail.id, patch)}
        />
      )}

      {/* Topbar mobile — toggle hamburger X */}
      <div className="rf-topbar">
        <div className="rf-topbar-logo">🏠 RentFlow CI</div>
        <button className="rf-hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Menu">
          {sidebarOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Overlay pour fermer menu mobile */}
      <div className={`rf-nav-overlay${sidebarOpen?" visible":""}`} onClick={() => setSidebarOpen(false)}/>

      {/* Sidebar — responsive */}
      <aside className={`rf-sidebar${sidebarOpen?" open":""}`} style={S.sidebar}>
        <div style={S.logo}>
          <div style={{width:36,height:36,background:"#1877F2",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏠</div>
          <span style={{color:"#F8FAFC",fontWeight:800,fontSize:16,letterSpacing:"-0.4px"}}>RentFlow CI</span>
        </div>
        {/* Stats rapides dans la sidebar */}
        <div style={{background:"#1E293B",borderRadius:10,padding:"10px 12px",marginBottom:10}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {[
              {v:contracts.filter(c=>c.status==="active").length,l:"Actifs",c:"#10B981"},
              {v:allUnpaid.length,l:"Impayés",c:allUnpaid.length>0?"#EF4444":"#10B981"},
              {v:houses.filter(h=>h.available).length,l:"Libres",c:"#F59E0B"},
              {v:houses.filter(h=>!h.available).length,l:"Occupés",c:"#6366F1"},
            ].map(x => (
              <div key={x.l} style={{textAlign:"center",padding:"6px 4px"}}>
                <div style={{fontSize:18,fontWeight:800,color:x.c}}>{x.v}</div>
                <div style={{fontSize:9,color:"#64748B",fontWeight:600}}>{x.l}</div>
              </div>
            ))}
          </div>
        </div>
        <nav style={S.nav}>
          {[
            {id:"dashboard",icon:"📊",label:"Tableau de bord"},
            {id:"contracts",icon:"📄",label:"Contrats"},
            {id:"houses",   icon:"🏘️",label:"Mes maisons"},
            {id:"unpaid",   icon:"⚠️",label:`Impayes (${allUnpaid.length})`},
            {id:"pinInfo",  icon:"🔐",label:"Codes PIN"},
            {id:"archive",  icon:"🗄️",label:`Archive (${contracts.filter(c=>c.status==="closed").length})`},
          ].map(item => (
            <button key={item.id} onClick={() => { setView(item.id); navReset(); setSidebarOpen(false); }}
              style={{...S.navBtn,...(view===item.id?S.navBtnActive:{})}}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div style={S.sidebarActions}>
          <button style={S.actionBtn} onClick={() => { setView("addHouse"); navReset(); setSidebarOpen(false); }}>+ Maison</button>
          <button style={S.actionBtn} onClick={() => { setView("addContract"); navReset(); setSidebarOpen(false); }}>+ Bail</button>
          <button style={{...S.actionBtn,background:"#374151",marginTop:8}} onClick={() => { setAuthed(false); onBack(); }}>Deconnexion</button>
        </div>
      </aside>

      <main className="rf-main">

        {view==="dashboard" && (() => {
          const now2 = new Date();
          const last6 = Array.from({length:6}, (_,i) => {
            const d = new Date(now2.getFullYear(), now2.getMonth()-5+i, 1);
            return { label: MONTHS_SHORT[d.getMonth()], key: `${d.getFullYear()}-${d.getMonth()}`, isCurrent: i===5 };
          });
          const barData = last6.map(m => ({
            ...m,
            total: contracts.flatMap(c => Object.entries(c.payments).filter(([k,p]) => k===m.key && p.status==="paid").map(([,p]) => p.amount)).reduce((a,b)=>a+b,0)
          }));
          const maxBar = Math.max(...barData.map(d=>d.total), 1);

          const occupied = houses.filter(h=>!h.available).length;
          const avail = houses.filter(h=>h.available).length;
          const tot = houses.length||1;
          const pctOcc = Math.round(occupied/tot*100);
          const r=40, cx=55, cy=55, sw=14, circ=2*Math.PI*r;
          const dashOcc = (occupied/tot)*circ;

          const mCounts: Record<string,number> = {};
          contracts.forEach(c => Object.values(c.payments).forEach(p => {
            if(p.status==="paid" && p.method && p.method!=="Avance") mCounts[p.method]=(mCounts[p.method]||0)+1;
          }));
          const mColors: Record<string,string> = {"Orange Money":"#FF6600","Wave":"#1A73E8","MTN MoMo":"#FFCC00","Carte bancaire":"#475569"};
          const mEntries = Object.entries(mCounts).sort((a,b)=>b[1]-a[1]);
          const totalM = mEntries.reduce((s,[,v])=>s+v,0)||1;
          const recRate = totalExpected>0 ? Math.round(totalRecovered/totalExpected*100) : 0;

          return <>
            <h1 className="rf-page-title" style={S.pageTitle}>Tableau de bord</h1>
            <div className="rf-stats-grid">
              {[
                {label:"Maisons",     value:houses.length,                                    icon:"🏠",color:"#6366F1"},
                {label:"Disponibles", value:houses.filter(h=>h.available).length,             icon:"🔑",color:"#10B981"},
                {label:"Baux actifs", value:contracts.filter(c=>c.status==="active").length,  icon:"📋",color:"#F59E0B"},
                {label:"Impayes",     value:allUnpaid.length,                                 icon:"⚠️",color:"#EF4444"},
              ].map(s => (
                <div key={s.label} style={{...S.statCard,borderTop:`3px solid ${s.color}`}}>
                  <div style={{fontSize:22,marginBottom:4}}>{s.icon}</div>
                  <div style={{fontSize:28,fontWeight:800,color:"#0F172A"}}>{s.value}</div>
                  <div style={{fontSize:12,color:"#6B7280",marginTop:2}}>{s.label}</div>
                </div>
              ))}
            </div>
            <div className="rf-fin-grid" style={{marginBottom:16}}>
              <div style={{...S.statCard,borderTop:"3px solid #10B981",display:"flex",alignItems:"center",gap:14}}>
                <div style={{fontSize:28}}>💰</div>
                <div><div style={{fontSize:11,color:"#6B7280",marginBottom:2}}>Total recouvre</div><div style={{fontSize:18,fontWeight:800,color:"#10B981"}}>{fmt(totalRecovered)}</div></div>
              </div>
              <div style={{...S.statCard,borderTop:"3px solid #EF4444",display:"flex",alignItems:"center",gap:14}}>
                <div style={{fontSize:28}}>📉</div>
                <div><div style={{fontSize:11,color:"#6B7280",marginBottom:2}}>Reste a recouvrer</div><div style={{fontSize:18,fontWeight:800,color:"#EF4444"}}>{fmt(totalRemaining)}</div></div>
              </div>
            </div>

            {/* GRAPHIQUES */}
            <div className="rf-fin-grid" style={{marginBottom:16}}>
              {/* Barres encaissements */}
              <div style={{...S.statCard,padding:"18px 20px"}}>
                <div style={{fontWeight:700,fontSize:13,color:"#374151",marginBottom:4}}>Encaissements — 6 mois</div>
                <div style={{fontSize:11,color:"#6B7280",marginBottom:14}}>Evolution mensuelle des loyers percus</div>
                <div style={{display:"flex",alignItems:"flex-end",gap:5,height:90}}>
                  {barData.map((d) => {
                    const bh = maxBar>0 ? Math.max((d.total/maxBar)*80, d.total>0?5:2) : 2;
                    return (
                      <div key={d.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                        <div style={{fontSize:9,color:"#6B7280",textAlign:"center",minHeight:16,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
                          {d.total>0 ? `${Math.round(d.total/1000)}k` : ""}
                        </div>
                        <div style={{
                          width:"100%", height:bh, borderRadius:"3px 3px 0 0",
                          background: d.isCurrent ? "linear-gradient(180deg,#6366F1,#8B5CF6)" : d.total>0 ? "#C7D2FE" : "#F1F5F9",
                          boxShadow: d.isCurrent ? "0 2px 6px rgba(99,102,241,.4)" : "none",
                        }}/>
                        <div style={{fontSize:9,fontWeight:d.isCurrent?700:400,color:d.isCurrent?"#6366F1":"#9CA3AF"}}>{d.label}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{marginTop:10,display:"flex",gap:14,fontSize:10,color:"#6B7280"}}>
                  <span style={{display:"flex",gap:4,alignItems:"center"}}><span style={{width:8,height:8,borderRadius:1,background:"linear-gradient(#6366F1,#8B5CF6)",display:"inline-block"}}/> Mois actuel</span>
                  <span style={{display:"flex",gap:4,alignItems:"center"}}><span style={{width:8,height:8,borderRadius:1,background:"#C7D2FE",display:"inline-block"}}/> Precedents</span>
                </div>
              </div>

              {/* Donut occupation */}
              <div style={{...S.statCard,padding:"18px 20px"}}>
                <div style={{fontWeight:700,fontSize:13,color:"#374151",marginBottom:4}}>Occupation des biens</div>
                <div style={{fontSize:11,color:"#6B7280",marginBottom:12}}>Repartition logements occupes / disponibles</div>
                <div style={{display:"flex",alignItems:"center",gap:16}}>
                  <svg width={110} height={110} viewBox="0 0 110 110" style={{flexShrink:0}}>
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth={sw}/>
                    {occupied>0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="#6366F1" strokeWidth={sw}
                      strokeDasharray={`${dashOcc} ${circ}`} strokeDashoffset={circ*0.25} strokeLinecap="round"/>}
                    {avail>0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="#10B981" strokeWidth={sw}
                      strokeDasharray={`${circ-dashOcc-3} ${circ}`} strokeDashoffset={circ*0.25-dashOcc-1.5} strokeLinecap="round"/>}
                    <text x={cx} y={cy-4} textAnchor="middle" fontSize="17" fontWeight="800" fill="#0F172A">{pctOcc}%</text>
                    <text x={cx} y={cy+11} textAnchor="middle" fontSize="9" fill="#6B7280">occupes</text>
                  </svg>
                  <div style={{flex:1}}>
                    {[{label:"Occupes",val:occupied,col:"#6366F1"},{label:"Libres",val:avail,col:"#10B981"}].map(x=>(
                      <div key={x.label} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <span style={{width:10,height:10,borderRadius:2,background:x.col,display:"inline-block",flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:700,color:"#0F172A"}}>{x.val}</span>
                        <span style={{fontSize:11,color:"#6B7280"}}>{x.label}</span>
                      </div>
                    ))}
                    <div style={{paddingTop:8,borderTop:"1px solid #F1F5F9"}}>
                      <div style={{fontSize:10,color:"#6B7280",marginBottom:4,fontWeight:600}}>TAUX RECOUVREMENT</div>
                      <div style={{background:"#F1F5F9",borderRadius:20,height:7,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${recRate}%`,background:"linear-gradient(90deg,#10B981,#6366F1)",borderRadius:20}}/>
                      </div>
                      <div style={{fontSize:13,fontWeight:800,color:"#10B981",marginTop:4}}>{recRate}%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Methodes paiement */}
            {mEntries.length>0 && (
              <div style={{...S.statCard,marginBottom:16,padding:"18px 20px"}}>
                <div style={{fontWeight:700,fontSize:13,color:"#374151",marginBottom:4}}>Methodes de paiement</div>
                <div style={{fontSize:11,color:"#6B7280",marginBottom:14}}>Repartition des paiements valides</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {mEntries.map(([m,cnt]) => {
                    const pct = Math.round(cnt/totalM*100);
                    return (
                      <div key={m} style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:110,fontSize:12,fontWeight:600,color:"#374151",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m}</div>
                        <div style={{flex:1,background:"#F1F5F9",borderRadius:20,height:9,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${pct}%`,background:mColors[m]||"#6366F1",borderRadius:20,opacity:m==="MTN MoMo"?0.9:1}}/>
                        </div>
                        <div style={{fontSize:12,fontWeight:700,color:"#374151",minWidth:32,textAlign:"right"}}>{pct}%</div>
                        <div style={{fontSize:11,color:"#6B7280",minWidth:24,textAlign:"right"}}>{cnt}x</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ══ TABLEAU DE BORD : seulement locataires EN RETARD ══ */}
            {allUnpaid.length > 0 ? (
              <>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{
                      background:"linear-gradient(135deg,#EF4444,#DC2626)",
                      color:"#fff",borderRadius:12,padding:"4px 14px",
                      fontWeight:800,fontSize:14,
                      boxShadow:"0 3px 10px rgba(239,68,68,.35)",
                      display:"flex",alignItems:"center",gap:6,
                    }}>
                      <span style={{fontSize:16}}>⚠️</span>
                      {contracts.filter(c=>c.status==="active"&&getUnpaid(c).length>0).length} locataire{contracts.filter(c=>c.status==="active"&&getUnpaid(c).length>0).length>1?"s":""} en retard
                    </div>
                    <div style={{fontSize:12,color:"#94A3B8"}}>
                      {allUnpaid.length} loyer{allUnpaid.length>1?"s":""} impayé{allUnpaid.length>1?"s":""}
                    </div>
                  </div>
                </div>
                <div style={S.contractList}>
                  {contracts.filter(c => c.status==="active" && getUnpaid(c).length>0).map(c => {
                    const h = houses.find(x => x.id===c.houseId);
                    const u = getUnpaid(c);
                    return <ContractRow key={c.id} c={c} h={h} u={u} onClick={() => setDetailId(c.id)} onNotif={() => setNotifModal(c)} showCity/>;
                  })}
                </div>
              </>
            ) : (
              <div style={{
                background:"linear-gradient(135deg,#F0FDF4,#DCFCE7)",
                border:"1px solid #86EFAC",borderRadius:16,
                padding:"28px 24px",textAlign:"center",
                boxShadow:"0 2px 12px rgba(16,185,129,.08)",
              }}>
                <div style={{fontSize:48,marginBottom:10}}>✅</div>
                <div style={{fontSize:17,fontWeight:800,color:"#166534",marginBottom:4}}>Tous les locataires sont à jour !</div>
                <div style={{fontSize:13,color:"#4ADE80"}}>Aucun impayé en ce moment. Excellent taux de recouvrement !</div>
              </div>
            )}
          </>;
        })()}

        {view==="contracts" && <>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
            <h1 className="rf-page-title" style={{...S.pageTitle,marginBottom:0}}>Locataires actifs</h1>
            <span style={{
              background:"#EFF6FF",color:"#1D4ED8",
              fontWeight:700,fontSize:13,padding:"5px 14px",borderRadius:20,
              border:"1px solid #BFDBFE",
            }}>
              {filteredContracts.filter(c=>c.status==="active").length} bail{filteredContracts.filter(c=>c.status==="active").length>1?"s":""}
            </span>
          </div>
          <FilterBar search={search} setSearch={setSearch} filterCity={filterCity} setFilterCity={setFilterCity} cities={Array.from(new Set(houses.map(h=>h.city)))}/>
          <div style={S.contractList}>
            {filteredContracts.filter(c => c.status==="active").map(c => {
              const h = houses.find(x => x.id===c.houseId);
              const u = getUnpaid(c);
              return <ContractRow key={c.id} c={c} h={h} u={u} onClick={() => setDetailId(c.id)} onNotif={() => setNotifModal(c)} showCity/>;
            })}
          </div>
          {filteredContracts.filter(c => c.status==="active").length===0 && (
            <div style={S.allGood}>Aucun contrat actif.</div>
          )}
        </>}

        {view==="houses" && <>
          <h1 className="rf-page-title" style={S.pageTitle}>Mes maisons</h1>
          <FilterBar search={search} setSearch={setSearch} filterCity={filterCity} setFilterCity={setFilterCity} cities={Array.from(new Set(houses.map(h=>h.city)))}/>
          <div className="rf-houses-grid">
            {houses.filter(h => {
              const q = search.toLowerCase();
              return (!q || (h.address.toLowerCase().includes(q)||h.id.toLowerCase().includes(q)||h.city.toLowerCase().includes(q))) && (!filterCity||h.city===filterCity);
            }).map(h => {
              const c = contracts.find(x => x.houseId===h.id && x.status==="active");
              return (
                <div key={h.id} style={S.houseCard}>
                  <span style={{...S.badge,background:h.available?"#10B981":"#6B7280",display:"inline-block",marginBottom:8}}>{h.available?"Disponible":"Occupee"}</span>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{fontWeight:800,color:"#6366F1",fontSize:15}}>{h.id}</div>
                    <span style={{fontSize:11,background:"#F1F5F9",padding:"2px 8px",borderRadius:10,color:"#475569",fontWeight:600}}>{h.city}</span>
                  </div>
                  <div style={{color:"#374151",fontSize:13,margin:"4px 0"}}>{h.address}</div>
                  <div style={{fontSize:12,color:"#6B7280",marginBottom:4}}>{h.type} · {h.rooms} piece{h.rooms>1?"s":""}</div>
                  <div style={{fontSize:12,color:"#6B7280"}}>{fmt(h.rent)}/mois</div>
                  {c && <button style={{...S.smallBtn,marginTop:10}} onClick={() => setDetailId(c.id)}>Voir locataire</button>}
                </div>
              );
            })}
          </div>
          <button style={S.primaryBtn} onClick={() => setView("addHouse")}>+ Ajouter une maison</button>
        </>}

        {view==="unpaid" && <>
          <h1 className="rf-page-title" style={S.pageTitle}>⚠️ Impayés</h1>
          <FilterBar search={search} setSearch={setSearch} filterCity={filterCity} setFilterCity={setFilterCity} cities={Array.from(new Set(houses.map(h=>h.city)))}/>
          {(() => {
            const filtered = allUnpaid.filter(u => {
              const q = search.toLowerCase();
              return (!q || (u.tenantName?.toLowerCase().includes(q)||u.contractId?.toLowerCase().includes(q))) && (!filterCity||u.city===filterCity);
            });
            const byContract: Record<string, typeof filtered> = {};
            filtered.forEach(u => { if (!byContract[u.contractId!]) byContract[u.contractId!]=[]; byContract[u.contractId!].push(u); });
            return filtered.length === 0
              ? <div style={S.allGood}>✅ Aucun impayé !</div>
              : <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  {Object.entries(byContract).map(([cid, items]) => {
                    const contract = contracts.find(c => c.id===cid);
                    const h = houses.find(x => x.id===contract?.houseId);
                    const cover = contract?.coverPhoto?.data || null;
                    const profile = contract?.profilePhoto?.data || null;
                    return (
                      <div key={cid} style={{background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 2px 8px rgba(239,68,68,.15)",border:"1px solid #FECACA"}}>
                        <div style={{height:70,background:cover?"transparent":coverGradient(cid),position:"relative",overflow:"hidden"}}>
                          {cover && <img src={cover} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
                          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.2)"}}/>
                          <div style={{position:"absolute",top:8,right:10}}>
                            <span style={{background:"#EF4444",color:"#fff",fontWeight:700,padding:"3px 10px",borderRadius:20,fontSize:11}}>⚠ {items.length} impayé{items.length>1?"s":""}</span>
                          </div>
                        </div>
                        <div style={{padding:"0 16px 16px"}}>
                          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginTop:-22,marginBottom:10,flexWrap:"wrap",gap:8}}>
                            <div style={{width:44,height:44,borderRadius:"50%",border:"3px solid #fff",background:profile?"transparent":coverGradient(cid),display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff",overflow:"hidden",flexShrink:0}}>
                              {profile ? <img src={profile} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : initials(contract?.tenantName||"")}
                            </div>
                            <div style={{flex:1,paddingLeft:8}}>
                              <div style={{fontWeight:800,fontSize:14,color:"#0F172A"}}>{contract?.tenantName}</div>
                              <div style={{fontSize:11,color:"#6B7280"}}>{h?.address} · {h?.city}</div>
                            </div>
                            <div style={{display:"flex",gap:6}}>
                              <button style={{padding:"5px 12px",background:"#F3F4F6",border:"none",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600}} onClick={() => setNotifModal(contract!)}>📢</button>
                              <button style={{padding:"5px 12px",background:"#6366F1",border:"none",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600,color:"#fff"}} onClick={() => setDetailId(cid)}>Voir</button>
                            </div>
                          </div>
                          {items.map((u,i) => (
                            <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:u.overdue?"#FEF2F2":"#FFF7ED",borderRadius:10,padding:"10px 14px",marginBottom:8,flexWrap:"wrap",gap:8}}>
                              <div>
                                <span style={{fontWeight:700,color:u.overdue?"#EF4444":"#F59E0B",fontSize:13}}>{u.label}</span>
                                <div style={{fontSize:11,color:"#6B7280",marginTop:2}}>Échéance : {u.dueDate}{u.overdue?" · En retard 🔴":""}</div>
                              </div>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <span style={{fontWeight:800,fontSize:14}}>{fmt(u.amount)}</span>
                                <button style={{padding:"6px 14px",background:"#6366F1",border:"none",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,color:"#fff"}} onClick={() => setPayModal({ month:u, contractId:cid })}>Payer</button>
                              </div>
                            </div>
                          ))}
                          <div style={{fontSize:12,fontWeight:700,color:"#EF4444",textAlign:"right"}}>Total dû : {fmt(items.reduce((s,u)=>s+u.amount,0))}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>;
          })()}
        </>}

        {/* ── PIN INFO — mis a jour apres chaque nouveau bail ── */}
        {view==="pinInfo" && <>
          <h1 className="rf-page-title" style={S.pageTitle}>Codes PIN locataires</h1>
          <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,padding:"10px 16px",marginBottom:16,fontSize:12,color:"#1D4ED8"}}>
            Cette liste est mise a jour automatiquement a chaque nouveau bail cree. Les codes PIN sont generes aleatoirement et uniques.
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {contracts.filter(c => c.status==="active").map(c => {
              const h = houses.find(x => x.id===c.houseId);
              return (
                <div key={c.id} style={{background:"#fff",borderRadius:12,padding:"16px 22px",boxShadow:"0 1px 3px rgba(0,0,0,.07)",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700}}>{c.tenantName}</div>
                    <div style={{fontSize:12,color:"#6B7280"}}>{h?.address} · {h?.city}</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:11,color:"#6B7280",marginBottom:2}}>Contrat</div>
                    <div style={{fontWeight:800,color:"#6366F1",fontSize:16}}>{c.id}</div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:11,color:"#6B7280",marginBottom:2}}>PIN</div>
                    <div style={{background:"#F0FDF4",border:"2px solid #86EFAC",borderRadius:8,padding:"5px 14px",fontWeight:800,color:"#166534",fontSize:18,letterSpacing:4}}>{c.pin}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    <button style={S.smallBtn} onClick={() => setWelcomeModal({ contract:c, house:h, pin:c.pin })}>Renvoyer</button>
                    <button style={{...S.smallBtn,background:"#0F172A",color:"#fff"}} onClick={() => printContract(c, h)}>PDF</button>
                  </div>
                </div>
              );
            })}
            {contracts.filter(c => c.status==="active").length === 0 && <div style={S.allGood}>Aucun bail actif.</div>}
          </div>
        </>}

        {view==="addHouse" && <>
          <h1 className="rf-page-title" style={S.pageTitle}>Nouvelle maison</h1>
          <div style={S.formCard}>
            <Row2>
              <Field label="Ville *"><select style={S.input} value={ahf.city} onChange={e => setAhf({...ahf,city:e.target.value})}>{CITIES.map(c => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Adresse *"><input style={S.input} placeholder="Rue, quartier..." value={ahf.address} onChange={e => setAhf({...ahf,address:e.target.value})}/></Field>
            </Row2>
            <Row2>
              <Field label="Type de bien"><select style={S.input} value={ahf.type} onChange={e => setAhf({...ahf,type:e.target.value})}>{HOUSE_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Nb de pieces"><input style={S.input} type="number" min="1" value={ahf.rooms} onChange={e => setAhf({...ahf,rooms:e.target.value})}/></Field>
            </Row2>
            <Field label="Loyer mensuel (FCFA) *"><input style={S.input} type="number" placeholder="120000" value={ahf.rent} onChange={e => setAhf({...ahf,rent:e.target.value})}/></Field>
            <div style={{display:"flex",gap:12,marginTop:8}}>
              <button style={S.primaryBtn} onClick={() => {
                if (!ahf.address || !ahf.rent) { showToast("Adresse et loyer obligatoires","error"); return; }
                addHouse(ahf); setAhf(emptyAhf); setView("houses");
              }}>Ajouter</button>
              <button style={S.ghostBtn} onClick={() => setView("dashboard")}>Annuler</button>
            </div>
          </div>
        </>}

        {view==="addContract" && <>
          <h1 className="rf-page-title" style={S.pageTitle}>Nouveau bail</h1>
          <div style={S.formCard}>
            <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#1D4ED8"}}>
              Un code PIN a 4 chiffres sera genere automatiquement. La liste des codes PIN sera mise a jour apres creation.
            </div>
            <Field label="Maison *">
              <select style={S.input} value={acf.houseId} onChange={e => setAcf({...acf,houseId:e.target.value})}>
                <option value="">— Choisir —</option>
                {houses.filter(h => h.available).map(h => <option key={h.id} value={h.id}>{h.id} · {h.type} · {h.city} · {h.address} · {fmt(h.rent)}/mois</option>)}
              </select>
            </Field>
            <Row2>
              <Field label="Nom locataire *"><input style={S.input} placeholder="Nom complet" value={acf.tenantName} onChange={e => setAcf({...acf,tenantName:e.target.value})}/></Field>
              <Field label="Telephone *"><input style={S.input} placeholder="+225 07 xx xx xx" value={acf.tenantPhone} onChange={e => setAcf({...acf,tenantPhone:e.target.value})}/></Field>
            </Row2>
            <Field label="Email"><input style={S.input} placeholder="email@exemple.com" value={acf.tenantEmail} onChange={e => setAcf({...acf,tenantEmail:e.target.value})}/></Field>
            <Field label="Date d&apos;effet *">
              <input style={S.input} type="date" value={acf.startDate} onChange={e => setAcf({...acf,startDate:e.target.value})}/>
              {acf.startDate && (() => {
                const d = new Date(acf.startDate);
                const nextM = d.getMonth()===11?0:d.getMonth()+1;
                return <span style={{fontSize:11,color:"#6366F1",marginTop:3}}>Premier loyer : {MONTHS[d.getMonth()]} {d.getFullYear()} — echeance le 05 {MONTHS_SHORT[nextM]}</span>;
              })()}
            </Field>
            <div style={S.sectionDivider}>Photos du locataire</div>
            <Row2>
              <Field label="Photo de profil">
                <div style={{position:"relative"}}>
                  {acf.profilePhoto
                    ? <div style={{position:"relative"}}>
                        <img src={acf.profilePhoto.data} alt="profil" style={{width:80,height:80,borderRadius:"50%",objectFit:"cover",border:"3px solid #6366F1"}}/>
                        <button style={{position:"absolute",top:-4,right:-4,background:"#EF4444",border:"none",color:"#fff",borderRadius:"50%",width:20,height:20,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={() => setAcf({...acf,profilePhoto:null})}>×</button>
                      </div>
                    : <label style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",width:80,height:80,borderRadius:"50%",border:"2px dashed #CBD5E1",cursor:"pointer",background:"#F8FAFC",gap:4}}>
                        <span style={{fontSize:24}}>📷</span>
                        <span style={{fontSize:9,color:"#94A3B8",textAlign:"center"}}>Choisir</span>
                        <input type="file" accept="image/*" style={{display:"none"}} onChange={e => {
                          const file = e.target.files?.[0]; if (!file) return;
                          const r = new FileReader(); r.onload = ev => setAcf({...acf,profilePhoto:{name:file.name,data:ev.target!.result as string,type:file.type}}); r.readAsDataURL(file);
                        }}/>
                      </label>
                  }
                </div>
              </Field>
              <Field label="Photo de couverture">
                <div>
                  {acf.coverPhoto
                    ? <div style={{position:"relative"}}>
                        <img src={acf.coverPhoto.data} alt="couverture" style={{width:"100%",height:60,objectFit:"cover",borderRadius:8,border:"2px solid #6366F1"}}/>
                        <button style={{position:"absolute",top:-6,right:-6,background:"#EF4444",border:"none",color:"#fff",borderRadius:"50%",width:20,height:20,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={() => setAcf({...acf,coverPhoto:null})}>×</button>
                      </div>
                    : <label style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",width:"100%",height:60,border:"2px dashed #CBD5E1",borderRadius:8,cursor:"pointer",background:"#F8FAFC",gap:2}}>
                        <span style={{fontSize:20}}>🖼️</span>
                        <span style={{fontSize:9,color:"#94A3B8"}}>Photo de couverture</span>
                        <input type="file" accept="image/*" style={{display:"none"}} onChange={e => {
                          const file = e.target.files?.[0]; if (!file) return;
                          const r = new FileReader(); r.onload = ev => setAcf({...acf,coverPhoto:{name:file.name,data:ev.target!.result as string,type:file.type}}); r.readAsDataURL(file);
                        }}/>
                      </label>
                  }
                </div>
              </Field>
            </Row2>
            <div style={S.sectionDivider}>Piece d&apos;identite (recto / verso)</div>
            <Row2>
              <Field label="Recto CNI / Passeport">
                <input type="file" accept="image/*" style={{...S.input,padding:"7px 10px",fontSize:11}} onChange={e => {
                  const file = e.target.files?.[0]; if (!file) return;
                  const r = new FileReader(); r.onload = ev => setAcf({...acf,idRecto:{name:file.name,data:ev.target!.result as string,type:file.type}}); r.readAsDataURL(file);
                }}/>
                {acf.idRecto && <span style={{fontSize:11,color:"#10B981"}}>{acf.idRecto.name}</span>}
              </Field>
              <Field label="Verso CNI / Passeport">
                <input type="file" accept="image/*" style={{...S.input,padding:"7px 10px",fontSize:11}} onChange={e => {
                  const file = e.target.files?.[0]; if (!file) return;
                  const r = new FileReader(); r.onload = ev => setAcf({...acf,idVerso:{name:file.name,data:ev.target!.result as string,type:file.type}}); r.readAsDataURL(file);
                }}/>
                {acf.idVerso && <span style={{fontSize:11,color:"#10B981"}}>{acf.idVerso.name}</span>}
              </Field>
            </Row2>
            <div style={S.sectionDivider}>Contact d&apos;urgence</div>
            <Row2>
              <Field label="Nom complet"><input style={S.input} value={acf.emergencyName} onChange={e => setAcf({...acf,emergencyName:e.target.value})}/></Field>
              <Field label="Telephone"><input style={S.input} value={acf.emergencyPhone} onChange={e => setAcf({...acf,emergencyPhone:e.target.value})}/></Field>
            </Row2>
            <Field label="Relation"><input style={S.input} placeholder="ex: Epouse" value={acf.emergencyRelation} onChange={e => setAcf({...acf,emergencyRelation:e.target.value})}/></Field>
            <div style={S.sectionDivider}>Caution</div>
            <Row2>
              <Field label="Caution payee ?"><select style={S.input} value={acf.cautionPaid} onChange={e => setAcf({...acf,cautionPaid:e.target.value})}><option value="oui">Oui</option><option value="non">Non</option></select></Field>
              <Field label="Montant (FCFA)"><input style={S.input} type="number" placeholder="150000" value={acf.cautionAmount} onChange={e => setAcf({...acf,cautionAmount:e.target.value})}/></Field>
            </Row2>
            <div style={S.sectionDivider}>Avance sur loyer</div>
            <Row2>
              <Field label="Avance payee ?"><select style={S.input} value={acf.advancePaid} onChange={e => setAcf({...acf,advancePaid:e.target.value})}><option value="oui">Oui</option><option value="non">Non</option></select></Field>
              <Field label="Nb de mois"><input style={S.input} type="number" min="0" max="12" value={acf.advanceMonths} onChange={e => setAcf({...acf,advanceMonths:e.target.value})}/></Field>
            </Row2>
            <Field label="Montant total avance (FCFA)"><input style={S.input} type="number" value={acf.advanceAmount} onChange={e => setAcf({...acf,advanceAmount:e.target.value})}/></Field>
            {acf.startDate && Number(acf.advanceMonths) > 0 && (
              <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#1D4ED8"}}>
                Mois couverts : {Array.from({length:+acf.advanceMonths},(_,i) => {
                  const d = new Date(acf.startDate); d.setMonth(d.getMonth()+i);
                  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
                }).join(", ")}
              </div>
            )}
            <div style={{display:"flex",gap:12,marginTop:8}}>
              <button style={S.primaryBtn} onClick={handleAddContract}>Creer et envoyer les acces</button>
              <button style={S.ghostBtn} onClick={() => setView("dashboard")}>Annuler</button>
            </div>
          </div>
        </>}

        {/* ARCHIVE — Contrats clotures */}
        {view==="archive" && <>
          <h1 className="rf-page-title" style={S.pageTitle}>Archive des contrats</h1>
          <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:10,padding:"10px 16px",marginBottom:16,fontSize:12,color:"#92400E"}}>
            Archive de tous les baux clotures. Ces contrats sont conserves a titre de reference et peuvent etre imprimes.
          </div>
          <FilterBar search={search} setSearch={setSearch} filterCity={filterCity} setFilterCity={setFilterCity} cities={Array.from(new Set(houses.map(h=>h.city)))}/>
          {(() => {
            const archived = contracts.filter(c => c.status==="closed").filter(c => {
              const h = houses.find(x => x.id===c.houseId);
              const q = search.toLowerCase();
              return (!q || c.tenantName.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || (h?.address||"").toLowerCase().includes(q))
                && (!filterCity || h?.city===filterCity);
            }).sort((a,b) => (b.endDate||"").localeCompare(a.endDate||""));
            if (archived.length===0) return (
              <div style={{...S.allGood,background:"#FFF7ED",border:"1px solid #FED7AA",color:"#92400E"}}>
                Aucun contrat archive pour le moment.
              </div>
            );
            return (
              <>
                <div style={{fontSize:12,color:"#6B7280",marginBottom:16}}>
                  🗄️ <strong>{archived.length}</strong> contrat{archived.length>1?"s":""} archivé{archived.length>1?"s":""}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:20}}>
                {archived.map(c => {
                  const h = houses.find(x => x.id===c.houseId);
                  const paidCount = Object.values(c.payments).filter(p=>p.status==="paid").length;
                  const totalPaid = Object.values(c.payments).filter(p=>p.status==="paid").reduce((s,p)=>s+p.amount,0);
                  const duration = (() => {
                    if (!c.startDate || !c.endDate) return "—";
                    const start = new Date(c.startDate);
                    const [d,m,y] = (c.endDate||"").split("/");
                    const end = new Date(parseInt(y),parseInt(m)-1,parseInt(d));
                    const months = (end.getFullYear()-start.getFullYear())*12 + end.getMonth()-start.getMonth();
                    return `${months} mois`;
                  })();
                  const cover = c.coverPhoto?.data || null;
                  const profile = c.profilePhoto?.data || null;
                  const grad = coverGradient(c.id);
                  return (
                    <div key={c.id} style={{
                      background:"#fff",borderRadius:18,overflow:"hidden",
                      boxShadow:"0 2px 10px rgba(0,0,0,.07)",
                      border:"1px solid #E5E7EB",
                      opacity:.9,filter:"grayscale(0.15)",
                    }}>
                      {/* Cover */}
                      <div style={{height:90,position:"relative",overflow:"hidden",
                        background: cover?"transparent":grad}}>
                        {cover && <img src={cover} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
                        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.25)"}}/>
                        <div style={{position:"absolute",top:8,right:8,
                          background:"rgba(100,116,139,.9)",color:"#fff",
                          fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20}}>
                          🗄 Archivé · {duration}
                        </div>
                      </div>
                      {/* Corps */}
                      <div style={{padding:"0 16px 16px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginTop:-28,marginBottom:10}}>
                          <div style={{
                            width:56,height:56,borderRadius:"50%",
                            border:"3px solid #fff",
                            background: profile?"transparent":grad,
                            display:"flex",alignItems:"center",justifyContent:"center",
                            fontSize:18,fontWeight:800,color:"#fff",overflow:"hidden",
                            boxShadow:"0 2px 8px rgba(0,0,0,.18)",
                            filter:"grayscale(0.3)",
                          }}>
                            {profile?<img src={profile} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:initials(c.tenantName)}
                          </div>
                          <div style={{display:"flex",gap:6,paddingTop:32}}>
                            <button style={{...S.smallBtn,fontSize:11}} onClick={() => setDetailId(c.id)}>Détails</button>
                            <button style={{...S.smallBtn,background:"#0F172A",color:"#fff",fontSize:11}} onClick={() => printContract(c, h)}>PDF</button>
                          </div>
                        </div>
                        <div style={{fontWeight:800,color:"#374151",fontSize:15,marginBottom:2}}>{c.tenantName}</div>
                        <div style={{fontSize:12,color:"#94A3B8",marginBottom:10}}>
                          📍 {h?.type} · {h?.city} · {h?.address}
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,borderTop:"1px solid #F1F5F9",paddingTop:10}}>
                          {[
                            {label:"Mois payés",value:String(paidCount),color:"#10B981"},
                            {label:"Loyer/mois",value:`${Math.round((h?.rent||0)/1000)}k`,color:"#6366F1"},
                            {label:"Encaissé",value:`${Math.round(totalPaid/1000)}k`,color:"#F59E0B"},
                          ].map(x => (
                            <div key={x.label} style={{textAlign:"center",background:"#F8FAFC",borderRadius:8,padding:"7px 4px"}}>
                              <div style={{fontSize:14,fontWeight:800,color:x.color}}>{x.value}</div>
                              <div style={{fontSize:9,color:"#94A3B8",marginTop:2,fontWeight:600}}>{x.label}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{fontSize:10,color:"#94A3B8",marginTop:8,textAlign:"center"}}>
                          {new Date(c.startDate).toLocaleDateString("fr-FR")} → {c.endDate||"—"}
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              </>
            );
          })()}
        </>}

      </main>
    </div>
  );
}

/* ─── ROOT APP ───────────────────────────────────────────────── */
export default function App() {
  const [houses,    setHouses]    = useLocalStorage<House[]>("rf_houses", INIT_HOUSES);
  const [contracts, setContracts] = useLocalStorage<Contract[]>("rf_contracts", INIT_CONTRACTS);
  const [mode,         setMode]         = useState<"owner"|"tenant"|null>(null);
  const [ownerAuth,    setOwnerAuth]    = useState(false);
  const [tenantSession,setTenantSession]= useState<string|null>(null);
  const [toast,        setToast]        = useState<{msg:string;type:string}|null>(null);

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const updatePayment = (cid: string, key: string, method: PaymentMethod) =>
    setContracts((cs: Contract[]) => cs.map(c => c.id !== cid ? c : {
      ...c, payments: { ...c.payments, [key]: { ...c.payments[key], status:"paid", date:new Date().toLocaleDateString("fr-FR"), method:method.name, overdue:false }}
    }));

  const closeContract = (cid: string) => {
    const c = contracts.find(x => x.id === cid);
    if (!c) return;
    setContracts((cs: Contract[]) => cs.map(x => x.id === cid ? { ...x, status:"closed", endDate:today() } : x));
    setHouses((hs: House[]) => hs.map(h => h.id === c.houseId ? { ...h, available:true } : h));
  };

  const addHouse = (f: Record<string,string>) => {
    setHouses((hs: House[]) => [...hs, {
      id: `H${String(hs.length+1).padStart(3,"0")}`,
      address:f.address, city:f.city, type:f.type, rooms:+f.rooms, rent:+f.rent, available:true,
    }]);
    showToast("Maison ajoutee");
  };

  const addContract = (f: Record<string,string|number|null>) => {
    const h = houses.find(x => x.id === f.houseId);
    const advMonths = f.advancePaid === "oui" ? +(f.advanceMonths||0) : 0;
    const newPin = genPin();
    const newContract: Contract = {
      id: `C${String(contracts.length+1).padStart(3,"0")}`,
      houseId: f.houseId as string,
      tenantName: f.tenantName as string,
      tenantPhone: f.tenantPhone as string,
      tenantEmail: f.tenantEmail as string,
      pin: newPin,
      startDate: f.startDate as string,
      editDate: today(),
      status: "active",
      idRecto: (f.idRecto as { name: string; data: string; type: string } | null) ?? null,
      idVerso: (f.idVerso as { name: string; data: string; type: string } | null) ?? null,
      profilePhoto: (f.profilePhoto as { name: string; data: string; type: string } | null) ?? null,
      coverPhoto: (f.coverPhoto as { name: string; data: string; type: string } | null) ?? null,
      emergencyName: f.emergencyName as string,
      emergencyPhone: f.emergencyPhone as string,
      emergencyRelation: f.emergencyRelation as string,
      caution: { paid: f.cautionPaid === "oui", amount: +(f.cautionAmount||0) },
      advance: { paid: f.advancePaid === "oui", amount: +(f.advanceAmount||0), months: advMonths },
      payments: genPayments(f.startDate as string, h?.rent ?? 0, advMonths),
    };
    setContracts((cs: Contract[]) => [...cs, newContract]);
    setHouses((hs: House[]) => hs.map(x => x.id === f.houseId ? { ...x, available:false } : x));
    return { contract:newContract, house:h, pin:newPin };
  };

  const updateContract = (cid: string, patch: Partial<Contract>) =>
    setContracts((cs: Contract[]) => cs.map(c => c.id !== cid ? c : { ...c, ...patch }));

  if (!mode) return (
    <div style={S.landing}>
      {toast && <Toast t={toast}/>}
      <div style={S.landingCard}>
        <div style={S.landingLogo}>🏠 RentFlow CI</div>
        <p style={S.landingSub}>Plateforme de gestion locative — Cote d&apos;Ivoire</p>
        <div style={S.landingBtns}>
          <button style={S.lBtn1} onClick={() => setMode("owner")}>
            <span style={{fontSize:32}}>👔</span>
            <b>Espace Proprietaire</b>
            <span style={{fontSize:12,opacity:.8}}>Gerer vos biens et locataires</span>
          </button>
          <button style={S.lBtn2} onClick={() => setMode("tenant")}>
            <span style={{fontSize:32}}>🏡</span>
            <b>Espace Locataire</b>
            <span style={{fontSize:12,opacity:.8}}>Consulter et payer votre loyer</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (mode === "tenant") return (
    <TenantPortal contracts={contracts} houses={houses} session={tenantSession} setSession={setTenantSession}
      updatePayment={updatePayment} onBack={() => { setMode(null); setTenantSession(null); }} showToast={showToast}/>
  );

  return (
    <OwnerPortal houses={houses} contracts={contracts} authed={ownerAuth} setAuthed={setOwnerAuth}
      onBack={() => { setMode(null); setOwnerAuth(false); }}
      addHouse={addHouse} addContract={addContract} closeContract={closeContract}
      updatePayment={updatePayment} updateContract={updateContract}
      showToast={showToast} toast={toast}/>
  );
}
