import { useState, useEffect } from "react";

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const MONTHS_SHORT = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const PAYMENT_METHODS = [
  { id:"orange", name:"Orange Money", icon:"🟠", color:"#FF6600" },
  { id:"wave",   name:"Wave",         icon:"🔵", color:"#1A73E8" },
  { id:"mtn",    name:"MTN MoMo",     icon:"🟡", color:"#FFCC00" },
  { id:"card",   name:"Carte bancaire",icon:"💳", color:"#2D3748" },
];
const CITIES = ["Abidjan","Bouaké","Daloa","San-Pédro","Yamoussoukro","Korhogo","Man","Gagnoa","Abengourou","Divo"];
const HOUSE_TYPES = ["Appartement","Villa","Studio","Chambre","Duplex","Maison simple"];
const fmt = n => new Intl.NumberFormat("fr-FR").format(n)+" FCFA";
const genPin = () => String(Math.floor(1000+Math.random()*9000));
const today = () => new Date().toLocaleDateString("fr-FR");

const genPayments = (startDateStr, rent, advanceMonths=0) => {
  const p={}, start=new Date(startDateStr), now=new Date();
  let year=start.getFullYear(), month=start.getMonth(), idx=0;
  while(true){
    if(year>now.getFullYear()||(year===now.getFullYear()&&month>now.getMonth()))break;
    const k=`${year}-${month}`;
    const dueMonth=month===11?0:month+1, dueYear=month===11?year+1:year;
    const dueDate=new Date(dueYear,dueMonth,5);
    const isOverdue=now>dueDate;
    const label=`${MONTHS[month]} ${year}`;
    const dueDateStr=`05 ${MONTHS_SHORT[dueMonth]} ${dueYear}`;
    if(idx<advanceMonths){
      p[k]={status:"paid",label,dueDate:dueDateStr,date:new Date(year,month,1).toLocaleDateString("fr-FR"),method:"Avance",amount:rent};
    } else {
      p[k]=Math.random()>0.3
        ?{status:"paid",label,dueDate:dueDateStr,date:new Date(year,month,Math.floor(Math.random()*10)+1).toLocaleDateString("fr-FR"),method:["Orange Money","Wave","MTN MoMo"][Math.floor(Math.random()*3)],amount:rent}
        :{status:"unpaid",label,dueDate:dueDateStr,overdue:isOverdue,amount:rent};
    }
    month++; if(month>11){month=0;year++;} idx++;
  }
  return p;
};

const INIT_HOUSES = [
  {id:"H001",address:"12 Rue des Lilas",city:"Abidjan",type:"Appartement",rooms:3,rent:150000,available:false},
  {id:"H002",address:"45 Av. Houphouët",city:"Abidjan",type:"Studio",rooms:2,rent:95000,available:false},
  {id:"H003",address:"8 Résid. Palm Beach",city:"San-Pédro",type:"Villa",rooms:4,rent:220000,available:true},
  {id:"H004",address:"22 Rue du Commerce",city:"Bouaké",type:"Maison simple",rooms:3,rent:80000,available:true},
  {id:"H005",address:"14 Av. de la Paix",city:"Yamoussoukro",type:"Appartement",rooms:2,rent:70000,available:false},
];

const INIT_CONTRACTS = [
  {id:"C001",houseId:"H001",tenantName:"Kouassi Jean-Baptiste",tenantPhone:"+225 07 12 34 56",tenantEmail:"jb.kouassi@email.com",pin:"1234",startDate:"2025-01-15",editDate:"15/01/2025",status:"active",idRecto:null,idVerso:null,emergencyName:"Kouassi Ama",emergencyPhone:"+225 07 99 11 22",emergencyRelation:"Épouse",caution:{paid:true,amount:300000},advance:{paid:true,amount:300000,months:2},payments:genPayments("2025-01-15",150000,2)},
  {id:"C002",houseId:"H002",tenantName:"Aya Fatima Diabaté",tenantPhone:"+225 05 98 76 54",tenantEmail:"aya.diabate@email.com",pin:"5678",startDate:"2024-10-01",editDate:"01/10/2024",status:"active",idRecto:null,idVerso:null,emergencyName:"Diabaté Moussa",emergencyPhone:"+225 05 44 55 66",emergencyRelation:"Frère",caution:{paid:true,amount:190000},advance:{paid:true,amount:285000,months:3},payments:genPayments("2024-10-01",95000,3)},
  {id:"C003",houseId:"H005",tenantName:"Koné Ibrahim",tenantPhone:"+225 01 23 45 67",tenantEmail:"kone.ibrahim@email.com",pin:"9999",startDate:"2024-06-01",editDate:"01/06/2024",status:"active",idRecto:null,idVerso:null,emergencyName:"Koné Fatou",emergencyPhone:"+225 07 77 88 99",emergencyRelation:"Mère",caution:{paid:false,amount:140000},advance:{paid:true,amount:140000,months:2},payments:genPayments("2024-06-01",70000,2)},
];

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [houses,        setHouses]        = useState(INIT_HOUSES);
  const [contracts,     setContracts]     = useState(INIT_CONTRACTS);
  const [mode,          setMode]          = useState(null);
  const [ownerAuth,     setOwnerAuth]     = useState(false);
  const [tenantSession, setTenantSession] = useState(null);
  const [toast,         setToast]         = useState(null);

  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3500);};

  const updatePayment=(cid,key,method)=>
    setContracts(cs=>cs.map(c=>c.id!==cid?c:{...c,payments:{...c.payments,[key]:{...c.payments[key],status:"paid",date:new Date().toLocaleDateString("fr-FR"),method:method.name,overdue:false}}}));

  const closeContract=(cid)=>{
    const c=contracts.find(x=>x.id===cid); if(!c)return;
    setContracts(cs=>cs.map(x=>x.id===cid?{...x,status:"closed",endDate:today()}:x));
    setHouses(hs=>hs.map(h=>h.id===c.houseId?{...h,available:true}:h));
  };

  const addHouse=f=>{
    setHouses(hs=>[...hs,{id:`H${String(hs.length+1).padStart(3,"0")}`,address:f.address,city:f.city,type:f.type,rooms:+f.rooms,rent:+f.rent,available:true}]);
    showToast("Maison ajoutée ✓");
  };

  const addContract=f=>{
    const h=houses.find(x=>x.id===f.houseId);
    const advMonths=f.advancePaid==="oui"?+f.advanceMonths:0;
    const newPin=genPin();
    const newContract={
      id:`C${String(contracts.length+1).padStart(3,"0")}`,houseId:f.houseId,tenantName:f.tenantName,
      tenantPhone:f.tenantPhone,tenantEmail:f.tenantEmail,pin:newPin,startDate:f.startDate,
      editDate:today(),status:"active",idRecto:f.idRecto||null,idVerso:f.idVerso||null,
      emergencyName:f.emergencyName,emergencyPhone:f.emergencyPhone,emergencyRelation:f.emergencyRelation,
      caution:{paid:f.cautionPaid==="oui",amount:+f.cautionAmount},
      advance:{paid:f.advancePaid==="oui",amount:+f.advanceAmount,months:advMonths},
      payments:genPayments(f.startDate,h.rent,advMonths)
    };
    setContracts(cs=>[...cs,newContract]);
    setHouses(hs=>hs.map(h=>h.id===f.houseId?{...h,available:false}:h));
    return {contract:newContract, house:h, pin:newPin};
  };

  const updateContract=(cid,patch)=>setContracts(cs=>cs.map(c=>c.id!==cid?c:{...c,...patch}));

  if(!mode) return (
    <div style={S.landing}><style>{css}</style>
      {toast&&<Toast t={toast}/>}
      <div style={S.landingCard}>
        <div style={S.landingLogo}>🏠 RentFlow CI</div>
        <p style={S.landingSub}>Plateforme de gestion locative — Côte d'Ivoire</p>
        <div style={S.landingBtns}>
          <button style={S.lBtn1} onClick={()=>setMode("owner")}><span style={{fontSize:32}}>👔</span><b>Espace Propriétaire</b><span style={{fontSize:12,opacity:.8}}>Gérer vos biens & locataires</span></button>
          <button style={S.lBtn2} onClick={()=>setMode("tenant")}><span style={{fontSize:32}}>🏡</span><b>Espace Locataire</b><span style={{fontSize:12,opacity:.8}}>Consulter & payer votre loyer</span></button>
        </div>
      </div>
    </div>
  );

  if(mode==="tenant") return (
    <TenantPortal contracts={contracts} houses={houses} session={tenantSession} setSession={setTenantSession}
      updatePayment={updatePayment} onBack={()=>{setMode(null);setTenantSession(null);}} showToast={showToast}/>
  );

  return (
    <OwnerPortal houses={houses} contracts={contracts} authed={ownerAuth} setAuthed={setOwnerAuth}
      onBack={()=>{setMode(null);setOwnerAuth(false);}} addHouse={addHouse} addContract={addContract}
      closeContract={closeContract} updatePayment={updatePayment} updateContract={updateContract}
      showToast={showToast} toast={toast}/>
  );
}

// ── OWNER PORTAL ──────────────────────────────────────────────────────────────
function OwnerPortal({houses,contracts,authed,setAuthed,onBack,addHouse,addContract,closeContract,updatePayment,updateContract,showToast,toast}){
  const [pin,setPin]=useState(""); const [err,setErr]=useState("");
  const [view,setView]=useState("dashboard");
  const [detailId,setDetailId]=useState(null);
  const [payModal,setPayModal]=useState(null);
  const [notifModal,setNotifModal]=useState(null);
  const [welcomeModal,setWelcomeModal]=useState(null);
  const [search,setSearch]=useState("");
  const [filterCity,setFilterCity]=useState("");
  const [filterStatus,setFilterStatus]=useState("");
  const [ahf,setAhf]=useState({address:"",city:"Abidjan",type:"Appartement",rooms:2,rent:""});
  const emptyAcf={houseId:"",tenantName:"",tenantPhone:"",tenantEmail:"",startDate:"",idRecto:null,idVerso:null,emergencyName:"",emergencyPhone:"",emergencyRelation:"",cautionPaid:"oui",cautionAmount:"",advancePaid:"oui",advanceAmount:"",advanceMonths:1};
  const [acf,setAcf]=useState(emptyAcf);

  const getUnpaid=c=>Object.entries(c.payments).filter(([,v])=>v.status==="unpaid").map(([k,v])=>({key:k,label:v.label,dueDate:v.dueDate,overdue:v.overdue,amount:v.amount}));
  const allUnpaid=contracts.filter(c=>c.status==="active").flatMap(c=>{const h=houses.find(x=>x.id===c.houseId);return getUnpaid(c).map(u=>({...u,tenantName:c.tenantName,address:h?.address,city:h?.city,contractId:c.id}));});
  const filteredContracts=contracts.filter(c=>{
    const h=houses.find(x=>x.id===c.houseId); const q=search.toLowerCase();
    return(!q||(c.tenantName.toLowerCase().includes(q)||c.id.toLowerCase().includes(q)||(h?.address||"").toLowerCase().includes(q)))
      &&(!filterCity||h?.city===filterCity)&&(!filterStatus||c.status===filterStatus);
  });

  // Dashboard financials
  const totalRecovered=contracts.flatMap(c=>Object.values(c.payments).filter(p=>p.status==="paid").map(p=>p.amount)).reduce((a,b)=>a+b,0);
  const totalExpected=contracts.flatMap(c=>Object.values(c.payments).map(p=>p.amount)).reduce((a,b)=>a+b,0);
  const totalRemaining=totalExpected-totalRecovered;

  if(!authed) return (
    <div style={S.landing}><style>{css}</style>
      <div style={S.authCard}>
        <button onClick={onBack} style={S.backLink}>← Retour</button>
        <div style={{fontSize:40,textAlign:"center"}}>👔</div>
        <h2 style={S.authTitle}>Espace Propriétaire</h2>
        <label style={S.label}>Code PIN</label>
        <input style={S.input} type="password" maxLength={6} placeholder="••••" value={pin}
          onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(pin==="0000"?(setAuthed(true),setErr("")):(setErr("PIN incorrect.")))}/>
        {err&&<p style={{color:"#EF4444",fontSize:13}}>{err}</p>}
        <div style={S.hint}>💡 Démo : PIN = <b>0000</b></div>
        <button style={{...S.primaryBtn,width:"100%",marginTop:8}} onClick={()=>pin==="0000"?(setAuthed(true),setErr("")):(setErr("PIN incorrect."))}>Accéder</button>
      </div>
    </div>
  );

  const detail=detailId?contracts.find(c=>c.id===detailId):null;
  const detailHouse=detail?houses.find(h=>h.id===detail.houseId):null;

  const handleCloseContract=(cid)=>{
    const c=contracts.find(x=>x.id===cid); if(!c)return;
    const unpaid=Object.values(c.payments).filter(p=>p.status==="unpaid");
    if(unpaid.length>0){showToast(`❌ ${unpaid.length} loyer(s) impayé(s). Réglez-les avant la clôture.`,"error");return;}
    closeContract(cid); setDetailId(null); showToast("Contrat clôturé — Maison disponible ✓");
  };

  const handleAddContract=()=>{
    if(!acf.houseId||!acf.tenantName||!acf.startDate)return;
    const result=addContract(acf);
    setAcf(emptyAcf);
    setView("contracts");
    setWelcomeModal(result);
  };

  return (
    <div style={S.app}><style>{css}</style>
      {toast&&<Toast t={toast}/>}
      {notifModal&&<NotifModal contract={notifModal} onSend={()=>{showToast("Notification envoyée ✓");setNotifModal(null);}} onClose={()=>setNotifModal(null)}/>}
      {payModal&&<PaymentModal month={payModal.month} onPay={(method)=>{updatePayment(payModal.contractId,payModal.month.key,method);setPayModal(null);showToast("Paiement enregistré ✓");}} onClose={()=>setPayModal(null)}/>}
      {welcomeModal&&<WelcomeModal data={welcomeModal} onClose={()=>setWelcomeModal(null)}/>}
      {detail&&(
        <ContractDetail contract={detail} house={detailHouse} isOwner
          onClose={()=>setDetailId(null)}
          onNotif={()=>{setDetailId(null);setNotifModal(detail);}}
          onCloseContract={()=>handleCloseContract(detail.id)}
          onUpdateContract={(patch)=>updateContract(detail.id,patch)}
        />
      )}

      <aside style={S.sidebar}>
        <div style={S.logo}>🏠 <span style={{color:"#F8FAFC",fontWeight:800,fontSize:16}}>RentFlow CI</span></div>
        <nav style={S.nav}>
          {[
            {id:"dashboard",icon:"⬛",label:"Tableau de bord"},
            {id:"contracts",icon:"📄",label:"Contrats"},
            {id:"houses",   icon:"🏘️",label:"Mes maisons"},
            {id:"unpaid",   icon:"⚠️",label:`Impayés (${allUnpaid.length})`},
            {id:"pinInfo",  icon:"🔐",label:"Codes PIN"},
          ].map(item=>(
            <button key={item.id} onClick={()=>{setView(item.id);setSearch("");setFilterCity("");setFilterStatus("");}}
              style={{...S.navBtn,...(view===item.id?S.navBtnActive:{})}}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div style={S.sidebarActions}>
          <button style={S.actionBtn} onClick={()=>setView("addHouse")}>+ Maison</button>
          <button style={S.actionBtn} onClick={()=>setView("addContract")}>+ Bail</button>
          <button style={{...S.actionBtn,background:"#374151",marginTop:8}} onClick={()=>{setAuthed(false);onBack();}}>Déconnexion</button>
        </div>
      </aside>

      <main style={S.main}>

        {view==="dashboard"&&<>
          <h1 style={S.pageTitle}>Tableau de bord</h1>
          <div style={S.statsGrid}>
            {[
              {label:"Maisons",     value:houses.length,                                   icon:"🏠",color:"#6366F1"},
              {label:"Disponibles", value:houses.filter(h=>h.available).length,            icon:"🔑",color:"#10B981"},
              {label:"Baux actifs", value:contracts.filter(c=>c.status==="active").length, icon:"📋",color:"#F59E0B"},
              {label:"Impayés",     value:allUnpaid.length,                                icon:"⚠️",color:"#EF4444"},
            ].map(s=>(
              <div key={s.label} style={{...S.statCard,borderTop:`3px solid ${s.color}`}}>
                <div style={{fontSize:22,marginBottom:4}}>{s.icon}</div>
                <div style={{fontSize:28,fontWeight:800,color:"#0F172A"}}>{s.value}</div>
                <div style={{fontSize:12,color:"#6B7280",marginTop:2}}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Financial summary */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:24}}>
            <div style={{...S.statCard,borderTop:"3px solid #10B981",display:"flex",alignItems:"center",gap:14}}>
              <div style={{fontSize:28}}>💰</div>
              <div>
                <div style={{fontSize:11,color:"#6B7280",marginBottom:2}}>Total recouvré</div>
                <div style={{fontSize:18,fontWeight:800,color:"#10B981"}}>{fmt(totalRecovered)}</div>
              </div>
            </div>
            <div style={{...S.statCard,borderTop:"3px solid #EF4444",display:"flex",alignItems:"center",gap:14}}>
              <div style={{fontSize:28}}>📉</div>
              <div>
                <div style={{fontSize:11,color:"#6B7280",marginBottom:2}}>Reste à recouvrer</div>
                <div style={{fontSize:18,fontWeight:800,color:"#EF4444"}}>{fmt(totalRemaining)}</div>
              </div>
            </div>
          </div>
          <h2 style={S.sectionTitle}>Baux actifs</h2>
          <div style={S.contractList}>
            {contracts.filter(c=>c.status==="active").map(c=>{
              const h=houses.find(x=>x.id===c.houseId); const u=getUnpaid(c);
              return <ContractRow key={c.id} c={c} h={h} u={u} onClick={()=>setDetailId(c.id)} onNotif={()=>setNotifModal(c)} showCity/>;
            })}
          </div>
        </>}

        {view==="contracts"&&<>
          <h1 style={S.pageTitle}>📄 Contrats</h1>
          <FilterBar search={search} setSearch={setSearch} filterCity={filterCity} setFilterCity={setFilterCity} filterStatus={filterStatus} setFilterStatus={setFilterStatus} cities={[...new Set(houses.map(h=>h.city))]} showStatus/>
          <div style={{fontSize:12,color:"#6B7280",marginBottom:12}}>{filteredContracts.length} contrat{filteredContracts.length>1?"s":""}</div>
          <div style={S.contractList}>
            {filteredContracts.map(c=>{
              const h=houses.find(x=>x.id===c.houseId); const u=getUnpaid(c);
              return <ContractRow key={c.id} c={c} h={h} u={u} onClick={()=>setDetailId(c.id)} onNotif={()=>setNotifModal(c)} showCity/>;
            })}
          </div>
        </>}

        {view==="houses"&&<>
          <h1 style={S.pageTitle}>🏘️ Mes maisons</h1>
          <FilterBar search={search} setSearch={setSearch} filterCity={filterCity} setFilterCity={setFilterCity} cities={[...new Set(houses.map(h=>h.city))]}/>
          <div style={S.housesGrid}>
            {houses.filter(h=>{const q=search.toLowerCase();return(!q||(h.address.toLowerCase().includes(q)||h.id.toLowerCase().includes(q)||h.city.toLowerCase().includes(q)))&&(!filterCity||h.city===filterCity);}).map(h=>{
              const c=contracts.find(x=>x.houseId===h.id&&x.status==="active");
              return (
                <div key={h.id} style={S.houseCard}>
                  <span style={{...S.badge,background:h.available?"#10B981":"#6B7280",display:"inline-block",marginBottom:8}}>{h.available?"Disponible":"Occupée"}</span>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{fontWeight:800,color:"#6366F1",fontSize:15}}>{h.id}</div>
                    <span style={{fontSize:11,background:"#F1F5F9",padding:"2px 8px",borderRadius:10,color:"#475569",fontWeight:600}}>📍{h.city}</span>
                  </div>
                  <div style={{color:"#374151",fontSize:13,margin:"4px 0 4px"}}>{h.address}</div>
                  <div style={{fontSize:12,color:"#6B7280",marginBottom:4}}>🏠 {h.type} · {h.rooms} pièce{h.rooms>1?"s":""}</div>
                  <div style={{fontSize:12,color:"#6B7280"}}>{fmt(h.rent)}/mois</div>
                  {c&&<button style={{...S.smallBtn,marginTop:10}} onClick={()=>setDetailId(c.id)}>Voir locataire →</button>}
                </div>
              );
            })}
          </div>
          <button style={S.primaryBtn} onClick={()=>setView("addHouse")}>+ Ajouter une maison</button>
        </>}

        {view==="unpaid"&&<>
          <h1 style={S.pageTitle}>⚠️ Impayés</h1>
          <FilterBar search={search} setSearch={setSearch} filterCity={filterCity} setFilterCity={setFilterCity} cities={[...new Set(houses.map(h=>h.city))]}/>
          {allUnpaid.filter(u=>{const q=search.toLowerCase();return(!q||(u.tenantName.toLowerCase().includes(q)||u.contractId.toLowerCase().includes(q)))&&(!filterCity||u.city===filterCity);}).length===0
            ?<div style={S.allGood}>✅ Aucun impayé</div>
            :<div style={{display:"flex",flexDirection:"column",gap:12}}>
              {allUnpaid.filter(u=>{const q=search.toLowerCase();return(!q||(u.tenantName.toLowerCase().includes(q)||u.contractId.toLowerCase().includes(q)))&&(!filterCity||u.city===filterCity);}).map((u,i)=>(
                <div key={i} style={{...S.contractCard,cursor:"default",flexWrap:"wrap",gap:12}}>
                  <div style={{flex:1}}><div style={{fontWeight:700}}>{u.tenantName}</div><div style={{fontSize:11,color:"#6B7280"}}>{u.address} · 📍{u.city}</div></div>
                  <div style={{textAlign:"center"}}>
                    <span style={{background:u.overdue?"#FEF2F2":"#FFF7ED",color:u.overdue?"#EF4444":"#F59E0B",fontWeight:700,padding:"4px 10px",borderRadius:20,fontSize:12}}>{u.label}</span>
                    <div style={{fontSize:11,color:u.overdue?"#EF4444":"#6B7280",marginTop:3}}>Échéance : {u.dueDate}{u.overdue?" 🔴":""}</div>
                  </div>
                  <div style={{fontWeight:800}}>{fmt(u.amount)}</div>
                  <div style={{display:"flex",gap:8}}>
                    <button style={S.smallBtn} onClick={()=>setPayModal({month:u,contractId:u.contractId})}>💳</button>
                    <button style={S.smallBtn} onClick={()=>setNotifModal(contracts.find(c=>c.id===u.contractId))}>📲</button>
                  </div>
                </div>
              ))}
            </div>
          }
        </>}

        {view==="pinInfo"&&<>
          <h1 style={S.pageTitle}>🔐 Codes PIN locataires</h1>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {contracts.filter(c=>c.status==="active").map(c=>{
              const h=houses.find(x=>x.id===c.houseId);
              return (
                <div key={c.id} style={{background:"#fff",borderRadius:12,padding:"16px 22px",boxShadow:"0 1px 3px rgba(0,0,0,.07)",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                  <div style={{flex:1}}><div style={{fontWeight:700}}>{c.tenantName}</div><div style={{fontSize:12,color:"#6B7280"}}>{h?.address} · 📍{h?.city}</div></div>
                  <div style={{textAlign:"center"}}><div style={{fontSize:11,color:"#6B7280",marginBottom:2}}>Contrat</div><div style={{fontWeight:800,color:"#6366F1",fontSize:16}}>{c.id}</div></div>
                  <div style={{textAlign:"center"}}><div style={{fontSize:11,color:"#6B7280",marginBottom:2}}>PIN</div><div style={{background:"#F0FDF4",border:"2px solid #86EFAC",borderRadius:8,padding:"5px 14px",fontWeight:800,color:"#166534",fontSize:18,letterSpacing:4}}>{c.pin}</div></div>
                  <button style={S.smallBtn} onClick={()=>setWelcomeModal({contract:c,house:h,pin:c.pin})}>📤 Renvoyer</button>
                </div>
              );
            })}
          </div>
        </>}

        {view==="addHouse"&&<>
          <h1 style={S.pageTitle}>🏠 Nouvelle maison</h1>
          <div style={S.formCard}>
            <Row2>
              <Field label="Ville *"><select style={S.input} value={ahf.city} onChange={e=>setAhf({...ahf,city:e.target.value})}>{CITIES.map(c=><option key={c}>{c}</option>)}</select></Field>
              <Field label="Adresse *"><input style={S.input} placeholder="Rue, quartier..." value={ahf.address} onChange={e=>setAhf({...ahf,address:e.target.value})}/></Field>
            </Row2>
            <Row2>
              <Field label="Type de bien"><select style={S.input} value={ahf.type} onChange={e=>setAhf({...ahf,type:e.target.value})}>{HOUSE_TYPES.map(t=><option key={t}>{t}</option>)}</select></Field>
              <Field label="Nombre de pièces"><input style={S.input} type="number" min="1" value={ahf.rooms} onChange={e=>setAhf({...ahf,rooms:e.target.value})}/></Field>
            </Row2>
            <Field label="Loyer mensuel (FCFA) *"><input style={S.input} type="number" placeholder="120000" value={ahf.rent} onChange={e=>setAhf({...ahf,rent:e.target.value})}/></Field>
            <div style={{display:"flex",gap:12,marginTop:8}}>
              <button style={S.primaryBtn} onClick={()=>{if(!ahf.address||!ahf.rent)return;addHouse(ahf);setAhf({address:"",city:"Abidjan",type:"Appartement",rooms:2,rent:""});setView("houses");}}>Ajouter</button>
              <button style={S.ghostBtn} onClick={()=>setView("dashboard")}>Annuler</button>
            </div>
          </div>
        </>}

        {view==="addContract"&&<>
          <h1 style={S.pageTitle}>📋 Nouveau bail</h1>
          <div style={S.formCard}>
            {/* Info PIN auto */}
            <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#1D4ED8",display:"flex",gap:8,alignItems:"center"}}>
              <span>🔐</span><span>Un code PIN à 4 chiffres sera <b>généré automatiquement</b> et envoyé au locataire après création du contrat.</span>
            </div>
            <Field label="Maison *">
              <select style={S.input} value={acf.houseId} onChange={e=>setAcf({...acf,houseId:e.target.value})}>
                <option value="">— Choisir —</option>
                {houses.filter(h=>h.available).map(h=><option key={h.id} value={h.id}>{h.id} · {h.type} · {h.city} · {h.address} · {fmt(h.rent)}/mois</option>)}
              </select>
            </Field>
            <Row2>
              <Field label="Nom locataire *"><input style={S.input} placeholder="Nom complet" value={acf.tenantName} onChange={e=>setAcf({...acf,tenantName:e.target.value})}/></Field>
              <Field label="Téléphone *"><input style={S.input} placeholder="+225 07 xx xx xx" value={acf.tenantPhone} onChange={e=>setAcf({...acf,tenantPhone:e.target.value})}/></Field>
            </Row2>
            <Field label="Email"><input style={S.input} placeholder="email@exemple.com" value={acf.tenantEmail} onChange={e=>setAcf({...acf,tenantEmail:e.target.value})}/></Field>
            <Field label="Date d'effet du contrat *">
              <input style={S.input} type="date" value={acf.startDate} onChange={e=>setAcf({...acf,startDate:e.target.value})}/>
              {acf.startDate&&<span style={{fontSize:11,color:"#6366F1",marginTop:3}}>
                Premier loyer : {MONTHS[new Date(acf.startDate).getMonth()]} {new Date(acf.startDate).getFullYear()} — échéance le 05 {MONTHS_SHORT[new Date(acf.startDate).getMonth()===11?0:new Date(acf.startDate).getMonth()+1]}
              </span>}
            </Field>

            <div style={S.sectionDivider}>🪪 Pièce d'identité (recto / verso)</div>
            <Row2>
              <Field label="Recto CNI / Passeport">
                <input type="file" accept="image/*" style={{...S.input,padding:"7px 10px",fontSize:11}} onChange={e=>{
                  const file=e.target.files[0]; if(!file)return;
                  const r=new FileReader(); r.onload=ev=>setAcf({...acf,idRecto:{name:file.name,data:ev.target.result,type:file.type}}); r.readAsDataURL(file);
                }}/>
                {acf.idRecto&&<span style={{fontSize:11,color:"#10B981"}}>✓ {acf.idRecto.name}</span>}
              </Field>
              <Field label="Verso CNI / Passeport">
                <input type="file" accept="image/*" style={{...S.input,padding:"7px 10px",fontSize:11}} onChange={e=>{
                  const file=e.target.files[0]; if(!file)return;
                  const r=new FileReader(); r.onload=ev=>setAcf({...acf,idVerso:{name:file.name,data:ev.target.result,type:file.type}}); r.readAsDataURL(file);
                }}/>
                {acf.idVerso&&<span style={{fontSize:11,color:"#10B981"}}>✓ {acf.idVerso.name}</span>}
              </Field>
            </Row2>

            <div style={S.sectionDivider}>🆘 Contact d'urgence</div>
            <Row2>
              <Field label="Nom complet"><input style={S.input} value={acf.emergencyName} onChange={e=>setAcf({...acf,emergencyName:e.target.value})}/></Field>
              <Field label="Téléphone"><input style={S.input} value={acf.emergencyPhone} onChange={e=>setAcf({...acf,emergencyPhone:e.target.value})}/></Field>
            </Row2>
            <Field label="Relation"><input style={S.input} placeholder="ex: Épouse" value={acf.emergencyRelation} onChange={e=>setAcf({...acf,emergencyRelation:e.target.value})}/></Field>

            <div style={S.sectionDivider}>💰 Caution</div>
            <Row2>
              <Field label="Caution payée ?"><select style={S.input} value={acf.cautionPaid} onChange={e=>setAcf({...acf,cautionPaid:e.target.value})}><option value="oui">Oui</option><option value="non">Non</option></select></Field>
              <Field label="Montant (FCFA)"><input style={S.input} type="number" placeholder="150000" value={acf.cautionAmount} onChange={e=>setAcf({...acf,cautionAmount:e.target.value})}/></Field>
            </Row2>

            <div style={S.sectionDivider}>📅 Avance sur loyer</div>
            <Row2>
              <Field label="Avance payée ?"><select style={S.input} value={acf.advancePaid} onChange={e=>setAcf({...acf,advancePaid:e.target.value})}><option value="oui">Oui</option><option value="non">Non</option></select></Field>
              <Field label="Nombre de mois"><input style={S.input} type="number" min="0" max="12" value={acf.advanceMonths} onChange={e=>setAcf({...acf,advanceMonths:e.target.value})}/></Field>
            </Row2>
            <Field label="Montant total de l'avance (FCFA)"><input style={S.input} type="number" value={acf.advanceAmount} onChange={e=>setAcf({...acf,advanceAmount:e.target.value})}/></Field>
            {acf.startDate&&+acf.advanceMonths>0&&(
              <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#1D4ED8"}}>
                ℹ️ Mois couverts : {Array.from({length:+acf.advanceMonths},(_,i)=>{const d=new Date(acf.startDate);d.setMonth(d.getMonth()+i);return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;}).join(", ")}
              </div>
            )}
            <div style={{display:"flex",gap:12,marginTop:8}}>
              <button style={S.primaryBtn} onClick={handleAddContract}>✓ Créer & envoyer accès</button>
              <button style={S.ghostBtn} onClick={()=>setView("dashboard")}>Annuler</button>
            </div>
          </div>
        </>}
      </main>
    </div>
  );
}

// ── WELCOME / ACCESS MODAL ────────────────────────────────────────────────────
function WelcomeModal({data,onClose}){
  const {contract,house,pin}=data;
  // L'URL réelle de cette page (fonctionne dans claude.ai)
  const appUrl=typeof window!=="undefined"?window.location.href.split("?")[0]:("https://claude.ai");
  const loginInfo=`contract=${contract.id}&pin=${pin}`;
  const fullUrl=`${appUrl}${appUrl.includes("?")?"&":"?"}${loginInfo}`;

  const [copied,setCopied]=useState(false);
  const [sent,setSent]=useState(false);
  const [showInstall,setShowInstall]=useState(false);

  const msgText=
`Bonjour ${contract.tenantName} 👋

Votre bail RentFlow CI est prêt !

📋 N° contrat : ${contract.id}
🔐 Code PIN : ${pin}
🏠 Bien : ${house?.type}, ${house?.address} – ${house?.city}

📲 Connectez-vous ici :
${appUrl}

Puis saisissez :
• N° contrat : ${contract.id}
• PIN : ${pin}

💡 Vous pouvez aussi installer l'application sur votre téléphone (voir instructions).`;

  const copyAccess=()=>{
    const txt=`N° contrat : ${contract.id}\nCode PIN : ${pin}\nLien : ${appUrl}`;
    navigator.clipboard?.writeText(txt);
    setCopied(true); setTimeout(()=>setCopied(false),2500);
  };

  const sendWhatsApp=()=>{
    const phone=(contract.tenantPhone||"").replace(/[\s\-\+]/g,"");
    const intlPhone=phone.startsWith("0")?`225${phone.slice(1)}`:phone;
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msgText)}`,"_blank");
    setSent(true);
  };

  const sendSms=()=>{
    const phone=(contract.tenantPhone||"").replace(/\s/g,"");
    window.open(`sms:${phone}?body=${encodeURIComponent(msgText)}`,"_blank");
    setSent(true);
  };

  const sendEmail=()=>{
    if(!contract.tenantEmail){return;}
    window.open(`mailto:${contract.tenantEmail}?subject=${encodeURIComponent(`Accès RentFlow CI — Contrat ${contract.id}`)}&body=${encodeURIComponent(msgText)}`,"_blank");
    setSent(true);
  };

  return (
    <div style={S.overlay}>
      <div style={{...S.modal,maxWidth:500,padding:"26px 24px"}}>
        <button onClick={onClose} style={S.modalClose}>✕</button>
        <div style={{textAlign:"center",marginBottom:18}}>
          <div style={{fontSize:38,marginBottom:6}}>🎉</div>
          <h2 style={{fontSize:18,fontWeight:800,color:"#0F172A",margin:0}}>Contrat créé avec succès !</h2>
          <p style={{fontSize:13,color:"#6B7280",marginTop:4}}>Envoyez les accès à <b>{contract.tenantName}</b></p>
        </div>

        {/* Accès résumé */}
        <div style={{background:"#F8FAFC",border:"1px solid #E5E7EB",borderRadius:12,padding:"14px 16px",marginBottom:14}}>
          <div style={{fontSize:10,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Informations d'accès locataire</div>
          {[
            ["Locataire", contract.tenantName],
            ["N° contrat", contract.id],
            ["Code PIN", pin],
            ["Bien", `${house?.type} · ${house?.address}`],
          ].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0",borderBottom:"1px solid #F1F5F9"}}>
              <span style={{color:"#6B7280"}}>{k}</span>
              <span style={{fontWeight:k==="Code PIN"?800:700,color:k==="Code PIN"?"#10B981":k==="N° contrat"?"#6366F1":"#0F172A",letterSpacing:k==="Code PIN"?3:0,fontSize:k==="Code PIN"?15:13}}>{v}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0"}}>
            <span style={{color:"#6B7280"}}>Lien d'accès</span>
            <span style={{fontSize:10,color:"#6366F1",maxWidth:220,textAlign:"right",wordBreak:"break-all"}}>{appUrl}</span>
          </div>
        </div>

        {/* Boutons d'envoi */}
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:.5}}>Envoyer les accès</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <button style={{...S.primaryBtn,background:"#25D366",padding:"10px 12px",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:6}} onClick={sendWhatsApp}>📲 WhatsApp</button>
            <button style={{...S.primaryBtn,background:"#374151",padding:"10px 12px",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:6}} onClick={sendSms}>💬 SMS</button>
          </div>
          {contract.tenantEmail&&<button style={{...S.primaryBtn,background:"#6366F1",padding:"10px 12px",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:6}} onClick={sendEmail}>✉️ Envoyer par Email</button>}
          <button style={{...S.primaryBtn,background:copied?"#10B981":"#0F172A",padding:"10px 12px",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:6}} onClick={copyAccess}>
            {copied?"✓ Copié !":"📋 Copier les accès (contrat + PIN + lien)"}
          </button>
          {sent&&<div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:8,padding:"9px 12px",fontSize:12,color:"#166534",textAlign:"center"}}>
            ✅ Message envoyé à {contract.tenantPhone}
          </div>}
        </div>

        {/* Section installation PWA */}
        <div style={{border:"1px solid #E5E7EB",borderRadius:12,overflow:"hidden"}}>
          <button onClick={()=>setShowInstall(v=>!v)} style={{width:"100%",padding:"12px 16px",background:showInstall?"#F1F5F9":"#fff",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,fontWeight:700,color:"#0F172A"}}>
            <span>📱 Comment installer l'app sur mobile ?</span>
            <span style={{fontSize:11,color:"#6B7280"}}>{showInstall?"▲ Réduire":"▼ Voir les instructions"}</span>
          </button>
          {showInstall&&(
            <div style={{padding:"14px 16px",background:"#F8FAFC",borderTop:"1px solid #E5E7EB"}}>
              <InstallGuide appUrl={appUrl}/>
            </div>
          )}
        </div>

        <button style={{...S.ghostBtn,width:"100%",marginTop:12}} onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}

// ── INSTALL GUIDE ─────────────────────────────────────────────────────────────
function InstallGuide({appUrl}){
  const [os,setOs]=useState("android");
  const steps={
    android:[
      {icon:"🌐", text:"Ouvrir le lien dans Chrome sur Android"},
      {icon:"⋮",  text:"Appuyer sur les 3 points en haut à droite"},
      {icon:"📲", text:'Sélectionner "Ajouter à l\'écran d\'accueil"'},
      {icon:"✅", text:'Appuyer sur "Ajouter" pour confirmer'},
      {icon:"🏠", text:"L'icône RentFlow CI apparaît sur l'écran d'accueil"},
    ],
    ios:[
      {icon:"🌐", text:"Ouvrir le lien dans Safari sur iPhone/iPad"},
      {icon:"⬆️", text:'Appuyer sur le bouton "Partager" (carré avec flèche)'},
      {icon:"📲", text:'"Sur l\'écran d\'accueil"'},
      {icon:"✅", text:'Appuyer sur "Ajouter" en haut à droite'},
      {icon:"🏠", text:"L'icône RentFlow CI apparaît sur l'écran d'accueil"},
    ],
  };
  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {[["android","🤖 Android"],["ios","🍎 iPhone/iPad"]].map(([v,l])=>(
          <button key={v} onClick={()=>setOs(v)} style={{flex:1,padding:"7px 10px",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,background:os===v?"#6366F1":"#E5E7EB",color:os===v?"#fff":"#374151"}}>{l}</button>
        ))}
      </div>
      <ol style={{listStyle:"none",padding:0,margin:0,display:"flex",flexDirection:"column",gap:8}}>
        {steps[os].map((s,i)=>(
          <li key={i} style={{display:"flex",alignItems:"flex-start",gap:10,fontSize:13}}>
            <span style={{background:"#6366F1",color:"#fff",borderRadius:"50%",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>{i+1}</span>
            <span style={{color:"#374151"}}><span style={{marginRight:6}}>{s.icon}</span>{s.text}</span>
          </li>
        ))}
      </ol>
      <div style={{marginTop:12,background:"#EFF6FF",borderRadius:8,padding:"9px 12px",fontSize:12,color:"#1D4ED8"}}>
        💡 Une fois installée, l'application s'ouvre comme une vraie app, sans navigateur.
      </div>
      <div style={{marginTop:8,fontSize:11,color:"#94A3B8",wordBreak:"break-all"}}>🔗 Lien à partager : <b>{appUrl}</b></div>
    </div>
  );
}



// ── TENANT PORTAL ─────────────────────────────────────────────────────────────
function TenantPortal({contracts,houses,session,setSession,updatePayment,onBack,showToast}){
  const [contractId,setContractId]=useState(""); const [pin,setPin]=useState(""); const [error,setError]=useState("");
  const [payModal,setPayModal]=useState(null); const [showDetail,setShowDetail]=useState(false);

  const login=()=>{
    const c=contracts.find(x=>x.id.toLowerCase()===contractId.trim().toLowerCase()&&x.pin===pin.trim());
    if(!c){setError("Numéro de contrat ou PIN incorrect.");return;}
    if(c.status==="closed"){setError("❌ Ce contrat est clôturé. Accès refusé.");return;}
    setSession(c.id); setError("");
  };

  if(!session) return (
    <div style={S.landing}><style>{css}</style>
      <div style={S.authCard}>
        <button onClick={onBack} style={S.backLink}>← Retour</button>
        <div style={{fontSize:40,textAlign:"center"}}>🏡</div>
        <h2 style={S.authTitle}>Espace Locataire</h2>
        <p style={S.authSub}>Connectez-vous avec votre n° de contrat et PIN</p>
        <label style={S.label}>Numéro de contrat</label>
        <input style={S.input} placeholder="ex: C001" value={contractId} onChange={e=>setContractId(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/>
        <label style={S.label}>Code PIN</label>
        <input style={S.input} type="password" maxLength={4} placeholder="••••" value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/>
        {error&&<p style={{color:"#EF4444",fontSize:13}}>{error}</p>}
        <div style={S.hint}>💡 Démo : <b>C001</b>/<b>1234</b> · <b>C002</b>/<b>5678</b> · <b>C003</b>/<b>9999</b></div>
        <button style={{...S.primaryBtn,width:"100%",marginTop:8}} onClick={login}>Se connecter</button>
      </div>
    </div>
  );

  const contract=contracts.find(c=>c.id===session);
  if(contract.status==="closed") return (
    <div style={S.landing}><style>{css}</style>
      <div style={S.authCard}>
        <div style={{fontSize:40,textAlign:"center"}}>🔒</div>
        <h2 style={S.authTitle}>Accès révoqué</h2>
        <p style={{fontSize:13,color:"#6B7280",textAlign:"center"}}>Votre contrat <b>{contract.id}</b> a été clôturé.</p>
        <button style={{...S.primaryBtn,width:"100%",marginTop:8}} onClick={()=>{setSession(null);onBack();}}>Retour à l'accueil</button>
      </div>
    </div>
  );

  const house=houses.find(h=>h.id===contract.houseId);
  const advancePaid=Object.values(contract.payments).filter(p=>p.method==="Avance").length;
  const unpaid=Object.entries(contract.payments).filter(([,v])=>v.status==="unpaid").map(([k,v])=>({key:k,label:v.label,dueDate:v.dueDate,overdue:v.overdue,amount:v.amount}));
  const paid=Object.values(contract.payments).filter(p=>p.status==="paid").length;
  const total=Object.keys(contract.payments).length;

  return (
    <div style={S.tenantApp}><style>{css}</style>
      {payModal&&<PaymentModal month={payModal} onPay={(method)=>{updatePayment(contract.id,payModal.key,method);setPayModal(null);showToast(`Paiement effectué via ${method.name} ✓`);}} onClose={()=>setPayModal(null)}/>}
      {showDetail&&<ContractDetail contract={contract} house={house} onClose={()=>setShowDetail(false)} isOwner={false}/>}
      <header style={S.tenantAppHeader}>
        <div style={S.logo}>🏠 RentFlow CI</div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:13,color:"#94A3B8"}}>👤 {contract.tenantName}</span>
          <button style={S.logoutBtn} onClick={()=>{setSession(null);onBack();}}>Déconnexion</button>
        </div>
      </header>
      <div style={S.tenantMain}>
        <div style={S.welcomeCard}>
          <div>
            <div style={S.welcomeTitle}>Bonjour, {contract.tenantName.split(" ")[0]} 👋</div>
            <div style={S.welcomeSub}>{house?.type} · {house?.address} · 📍{house?.city}</div>
            <div style={{fontSize:12,color:"#A5B4FC",marginTop:2}}>Contrat {contract.id} · {house?.rooms} pièce{house?.rooms>1?"s":""} · Depuis {new Date(contract.startDate).toLocaleDateString("fr-FR")}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:12,color:"#A5B4FC",marginBottom:2}}>Loyer mensuel</div>
            <div style={{fontSize:22,fontWeight:800,color:"#fff"}}>{fmt(house?.rent)}</div>
            <button style={{...S.smallBtn,marginTop:8,background:"rgba(255,255,255,.15)",color:"#fff",border:"1px solid rgba(255,255,255,.3)"}} onClick={()=>setShowDetail(true)}>📄 Mon contrat</button>
          </div>
        </div>

        {advancePaid>0&&(
          <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:20}}>📅</span>
            <div><div style={{fontWeight:700,color:"#1D4ED8",fontSize:13}}>Avance sur loyer</div>
            <div style={{fontSize:12,color:"#3B82F6"}}>{advancePaid} mois couverts ({fmt(contract.advance?.amount||0)})</div></div>
          </div>
        )}

        <div style={S.tenantStats}>
          {[{label:"Mois payés",value:paid,color:"#10B981"},{label:"Impayés",value:unpaid.length,color:unpaid.length>0?"#EF4444":"#10B981"},{label:"Total mois",value:total,color:"#6366F1"}].map(s=>(
            <div key={s.label} style={S.tenantStatCard}><div style={{...S.tenantStatVal,color:s.color}}>{s.value}</div><div style={S.tenantStatLabel}>{s.label}</div></div>
          ))}
        </div>

        {unpaid.length>0?(
          <section style={S.section}>
            <h3 style={S.sectionTitle}>🔴 Loyers à payer</h3>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {unpaid.map(u=>(
                <div key={u.key} style={{...S.unpaidRow,background:u.overdue?"#FEF2F2":"#FFF7ED"}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13}}>{u.label}</div>
                    <div style={{fontSize:11,color:u.overdue?"#EF4444":"#92400E"}}>Échéance : {u.dueDate}{u.overdue?" 🔴 Dépassée":""}</div>
                  </div>
                  <div style={{fontWeight:800,color:u.overdue?"#EF4444":"#92400E"}}>{fmt(u.amount)}</div>
                  <button style={S.payNowBtn} onClick={()=>setPayModal(u)}>Payer →</button>
                </div>
              ))}
            </div>
          </section>
        ):<div style={S.allGood}>✅ Tous vos loyers sont à jour — Merci !</div>}

        <section style={S.section}>
          <h3 style={S.sectionTitle}>📋 Historique des paiements</h3>
          <div style={S.historyTable}>
            <div style={S.historyHead}><span>Mois</span><span>Échéance</span><span>Date paiement</span><span>Méthode</span><span>Statut</span></div>
            {Object.entries(contract.payments).sort(([a],[b])=>b.localeCompare(a)).map(([key,p])=>(
              <div key={key} style={{...S.historyRow,background:p.method==="Avance"?"#F5F3FF":p.status==="unpaid"&&p.overdue?"#FFF1F2":"transparent"}}>
                <span style={{fontWeight:600}}>{p.label}</span>
                <span style={{fontSize:11,color:"#6B7280"}}>{p.dueDate}</span>
                <span>{p.status==="paid"?p.date:"—"}</span>
                <span style={{color:p.method==="Avance"?"#7C3AED":"inherit"}}>{p.status==="paid"?p.method:"—"}</span>
                <span style={{color:p.status==="paid"?p.method==="Avance"?"#7C3AED":"#10B981":p.overdue?"#EF4444":"#F59E0B",fontWeight:700}}>
                  {p.status==="paid"?p.method==="Avance"?"✓ Avance":"✓ Payé":p.overdue?"🔴 En retard":"🟡 À payer"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ── CONTRACT DETAIL ───────────────────────────────────────────────────────────
function ContractDetail({contract,house,onClose,onNotif,onCloseContract,isOwner,onUpdateContract}){
  const [confirmClose,setConfirmClose]=useState(false);
  const [idTab,setIdTab]=useState("recto");
  const [localRecto,setLocalRecto]=useState(contract.idRecto||null);
  const [localVerso,setLocalVerso]=useState(contract.idVerso||null);

  const unpaidCount=Object.values(contract.payments).filter(p=>p.status==="unpaid").length;
  const paidCount=Object.values(contract.payments).filter(p=>p.status==="paid").length;
  const totalPaid=Object.values(contract.payments).filter(p=>p.status==="paid").reduce((s,p)=>s+p.amount,0);
  const advMonths=Object.values(contract.payments).filter(p=>p.method==="Avance").length;

  const uploadId=(side,file)=>{
    if(!file)return;
    const r=new FileReader();
    r.onload=ev=>{
      const d={name:file.name,data:ev.target.result,type:file.type};
      if(side==="recto"){setLocalRecto(d);onUpdateContract&&onUpdateContract({idRecto:d});}
      else{setLocalVerso(d);onUpdateContract&&onUpdateContract({idVerso:d});}
    };
    r.readAsDataURL(file);
  };

  return (
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{...S.modal,maxWidth:720,width:"96%",padding:"24px 26px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,gap:10}}>
          <div>
            <h2 style={{fontSize:19,fontWeight:800,color:"#0F172A",margin:0}}>Contrat {contract.id}</h2>
            <div style={{fontSize:12,color:"#6B7280",marginTop:2}}>
              {house?.type} · {house?.rooms} pièce{house?.rooms>1?"s":""} · {house?.address} · 📍{house?.city}
            </div>
            <div style={{fontSize:11,color:"#94A3B8",marginTop:2}}>
              Édité le {contract.editDate||"—"} · Effet le {new Date(contract.startDate).toLocaleDateString("fr-FR")}
            </div>
          </div>
          <button onClick={onClose} style={S.modalClose}>✕</button>
        </div>

        {isOwner&&unpaidCount>0&&(
          <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#991B1B",fontWeight:600}}>
            ⚠️ {unpaidCount} loyer(s) impayé(s) — clôture bloquée.
          </div>
        )}
        {confirmClose&&(
          <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,padding:"14px 16px",marginBottom:14}}>
            <div style={{fontWeight:700,color:"#991B1B",marginBottom:8}}>Confirmer la clôture du contrat {contract.id} ?</div>
            <div style={{fontSize:12,color:"#7F1D1D",marginBottom:12}}>La maison sera disponible et le locataire perdra l'accès.</div>
            <div style={{display:"flex",gap:8}}>
              <button style={{...S.primaryBtn,background:"#EF4444",padding:"8px 18px",fontSize:13}} onClick={()=>{setConfirmClose(false);onCloseContract();}}>✓ Oui, clôturer</button>
              <button style={{...S.ghostBtn,padding:"8px 18px",fontSize:13}} onClick={()=>setConfirmClose(false)}>Annuler</button>
            </div>
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {/* Locataire + Bien */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <InfoBox title="👤 Locataire">
              <InfoRow k="Nom" v={contract.tenantName}/>
              <InfoRow k="Téléphone" v={contract.tenantPhone||"—"}/>
              <InfoRow k="Email" v={contract.tenantEmail||"—"}/>
            </InfoBox>
            <InfoBox title="🏠 Bien loué">
              <InfoRow k="Réf." v={house?.id}/>
              <InfoRow k="Type" v={house?.type||"—"}/>
              <InfoRow k="Pièces" v={`${house?.rooms} pièce${house?.rooms>1?"s":""}`}/>
              <InfoRow k="Adresse" v={`${house?.address}, ${house?.city}`}/>
              <InfoRow k="Loyer" v={fmt(house?.rent)}/>
            </InfoBox>
          </div>

          {/* Bail + Caution + Avance */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <InfoBox title="📅 Bail">
              <InfoRow k="Édition" v={contract.editDate||"—"}/>
              <InfoRow k="Date d'effet" v={new Date(contract.startDate).toLocaleDateString("fr-FR")}/>
              {contract.endDate&&<InfoRow k="Clôture" v={contract.endDate}/>}
              <InfoRow k="Statut" v={<span style={{...S.badge,background:contract.status==="active"?"#10B981":"#6B7280"}}>{contract.status==="active"?"Actif":"Clôturé"}</span>}/>
            </InfoBox>
            <InfoBox title="🔒 Caution">
              <InfoRow k="Statut" v={<span style={{...S.badge,background:contract.caution?.paid?"#10B981":"#EF4444"}}>{contract.caution?.paid?"Payée":"Non payée"}</span>}/>
              <InfoRow k="Montant" v={fmt(contract.caution?.amount||0)}/>
            </InfoBox>
            <InfoBox title="💵 Avance">
              <InfoRow k="Mois couverts" v={`${advMonths}`}/>
              <InfoRow k="Montant" v={fmt(contract.advance?.amount||0)}/>
            </InfoBox>
          </div>

          {/* Bilan + Urgence */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <InfoBox title="💰 Bilan">
              <InfoRow k="Mois payés" v={<span style={{color:"#10B981",fontWeight:700}}>{paidCount}</span>}/>
              <InfoRow k="dont avance" v={<span style={{color:"#6366F1",fontWeight:700}}>{advMonths}</span>}/>
              <InfoRow k="Impayés" v={<span style={{color:unpaidCount>0?"#EF4444":"#10B981",fontWeight:700}}>{unpaidCount}</span>}/>
              <InfoRow k="Total encaissé" v={<span style={{color:"#10B981",fontWeight:700}}>{fmt(totalPaid)}</span>}/>
            </InfoBox>
            <InfoBox title="🆘 Urgence">
              <InfoRow k="Nom" v={contract.emergencyName||"—"}/>
              <InfoRow k="Relation" v={contract.emergencyRelation||"—"}/>
              <InfoRow k="Téléphone" v={contract.emergencyPhone||"—"}/>
            </InfoBox>
          </div>

          {/* Pièce d'identité recto/verso */}
          <InfoBox title="🪪 Pièce d'identité">
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              {["recto","verso"].map(s=>(
                <button key={s} onClick={()=>setIdTab(s)} style={{padding:"5px 14px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:600,fontSize:12,background:idTab===s?"#6366F1":"#F3F4F6",color:idTab===s?"#fff":"#374151"}}>
                  {s==="recto"?"Recto":"Verso"}
                  {((s==="recto"&&localRecto)||(s==="verso"&&localVerso))&&<span style={{marginLeft:4,color:idTab===s?"#fff":"#10B981"}}>✓</span>}
                </button>
              ))}
            </div>
            {idTab==="recto"&&(localRecto
              ?<img src={localRecto.data} alt="Recto CNI" style={{maxWidth:"100%",maxHeight:180,borderRadius:8,border:"1px solid #E5E7EB"}}/>
              :isOwner?<div style={{paddingTop:4}}><p style={{fontSize:12,color:"#6B7280",marginBottom:6}}>Aucune image (recto). Uploadez la CNI/Passeport.</p><input type="file" accept="image/*" style={{fontSize:12}} onChange={e=>uploadId("recto",e.target.files[0])}/></div>
              :<p style={{fontSize:12,color:"#6B7280"}}>Non disponible</p>
            )}
            {idTab==="verso"&&(localVerso
              ?<img src={localVerso.data} alt="Verso CNI" style={{maxWidth:"100%",maxHeight:180,borderRadius:8,border:"1px solid #E5E7EB"}}/>
              :isOwner?<div style={{paddingTop:4}}><p style={{fontSize:12,color:"#6B7280",marginBottom:6}}>Aucune image (verso). Uploadez la CNI/Passeport.</p><input type="file" accept="image/*" style={{fontSize:12}} onChange={e=>uploadId("verso",e.target.files[0])}/></div>
              :<p style={{fontSize:12,color:"#6B7280"}}>Non disponible</p>
            )}
          </InfoBox>

          {/* Historique */}
          <div>
            <div style={{fontSize:11,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>📋 Historique des paiements</div>
            <div style={S.historyTable}>
              <div style={S.historyHead}><span>Mois</span><span>Échéance</span><span>Date paiement</span><span>Méthode</span><span>Statut</span></div>
              {Object.entries(contract.payments).sort(([a],[b])=>b.localeCompare(a)).map(([key,p])=>(
                <div key={key} style={{...S.historyRow,background:p.method==="Avance"?"#F5F3FF":p.status==="unpaid"&&p.overdue?"#FFF1F2":"transparent"}}>
                  <span style={{fontWeight:600}}>{p.label}</span>
                  <span style={{fontSize:11,color:"#6B7280"}}>{p.dueDate}</span>
                  <span>{p.status==="paid"?p.date:"—"}</span>
                  <span style={{color:p.method==="Avance"?"#7C3AED":"inherit"}}>{p.status==="paid"?p.method:"—"}</span>
                  <span style={{color:p.status==="paid"?p.method==="Avance"?"#7C3AED":"#10B981":p.overdue?"#EF4444":"#F59E0B",fontWeight:700}}>
                    {p.status==="paid"?p.method==="Avance"?"✓ Avance":"✓ Payé":p.overdue?"🔴 En retard":"🟡 À payer"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isOwner&&(
          <div style={{display:"flex",gap:10,marginTop:16,paddingTop:14,borderTop:"1px solid #F1F5F9",flexWrap:"wrap"}}>
            {onNotif&&<button style={S.smallBtn} onClick={onNotif}>📲 Notifier</button>}
            {onCloseContract&&contract.status==="active"&&!confirmClose&&(
              <button style={{padding:"8px 16px",background:unpaidCount>0?"#9CA3AF":"#EF4444",color:"#fff",border:"none",borderRadius:8,cursor:unpaidCount>0?"not-allowed":"pointer",fontWeight:700,fontSize:13}}
                onClick={()=>{if(unpaidCount>0)return;setConfirmClose(true);}}>
                🚪 Clôturer{unpaidCount>0?` (${unpaidCount} impayé${unpaidCount>1?"s":""})` :""}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
const InfoBox=({title,children})=><div style={{border:"1px solid #E5E7EB",borderRadius:10,padding:"10px 14px"}}><div style={{fontSize:10,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:.5,marginBottom:7}}>{title}</div>{children}</div>;
const InfoRow=({k,v})=><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0",fontSize:12,borderBottom:"1px solid #F8FAFC"}}><span style={{color:"#6B7280"}}>{k}</span><span style={{fontWeight:600,color:"#0F172A",textAlign:"right",maxWidth:"55%",wordBreak:"break-word"}}>{v}</span></div>;
const Row2=({children})=><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{children}</div>;
const Field=({label,children})=><div style={{display:"flex",flexDirection:"column",gap:4}}><label style={S.label}>{label}</label>{children}</div>;

function FilterBar({search,setSearch,filterCity,setFilterCity,filterStatus,setFilterStatus,cities,showStatus}){
  return (
    <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
      <input style={{...S.input,maxWidth:260,flex:1}} placeholder="🔍 Rechercher..." value={search} onChange={e=>setSearch(e.target.value)}/>
      <select style={{...S.input,maxWidth:180}} value={filterCity} onChange={e=>setFilterCity(e.target.value)}>
        <option value="">📍 Toutes les villes</option>
        {cities.map(c=><option key={c}>{c}</option>)}
      </select>
      {showStatus&&<select style={{...S.input,maxWidth:150}} value={filterStatus||""} onChange={e=>setFilterStatus(e.target.value)}>
        <option value="">Tous statuts</option><option value="active">Actifs</option><option value="closed">Clôturés</option>
      </select>}
      {(search||filterCity||filterStatus)&&<button style={{...S.smallBtn,background:"#FEF2F2",color:"#EF4444"}} onClick={()=>{setSearch("");setFilterCity("");if(setFilterStatus)setFilterStatus("");}}>✕</button>}
    </div>
  );
}

function ContractRow({c,h,u,onClick,onNotif,showCity}){
  return (
    <div style={{...S.contractCard,cursor:"pointer"}} onClick={onClick}>
      <div style={S.contractLeft}>
        <div style={{fontWeight:700,color:"#0F172A",fontSize:14}}>{c.tenantName}</div>
        <div style={{fontSize:12,color:"#6B7280"}}>{h?.type} · {h?.address}{showCity?` · 📍${h?.city}`:""} · {c.id}</div>
        <div style={{fontSize:11,color:"#94A3B8"}}>Édité le {c.editDate||"—"} · Effet {new Date(c.startDate).toLocaleDateString("fr-FR")}</div>
        {u.length>0&&<span style={S.unpaidTag}>{u.length} impayé{u.length>1?"s":""}</span>}
      </div>
      <div style={S.contractRight}>
        <span style={{...S.badge,background:c.status==="active"?"#10B981":"#6B7280"}}>{c.status==="active"?"Actif":"Clôturé"}</span>
        <div style={{fontWeight:700,color:"#6366F1",fontSize:13}}>{fmt(h?.rent)}/mois</div>
        <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
          {onNotif&&c.status==="active"&&<button style={S.smallBtn} onClick={onNotif}>📲</button>}
          <button style={S.smallBtn} onClick={onClick}>Détails →</button>
        </div>
      </div>
    </div>
  );
}

function PaymentModal({month,onPay,onClose}){
  const [sel,setSel]=useState(null); const [step,setStep]=useState(1);
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <button onClick={onClose} style={S.modalClose}>✕</button>
        <h2 style={S.modalTitle}>💳 Paiement du loyer</h2>
        <div style={S.modalSub}>{month.label}</div>
        <div style={{fontSize:12,color:"#6B7280",marginBottom:4}}>Échéance : {month.dueDate}</div>
        <div style={{fontWeight:800,color:"#6366F1",fontSize:16,marginBottom:12}}>{fmt(month.amount)}</div>
        {step===1&&<>
          <p style={{fontWeight:600,fontSize:13,color:"#374151",marginBottom:8}}>Moyen de paiement</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {PAYMENT_METHODS.map(m=>(
              <button key={m.id} onClick={()=>setSel(m)} style={{padding:14,borderRadius:10,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6,background:"#fff",border:`2px solid ${sel?.id===m.id?m.color:"#E5E7EB"}`}}>
                <span style={{fontSize:26}}>{m.icon}</span><span style={{fontSize:12,fontWeight:600}}>{m.name}</span>
              </button>
            ))}
          </div>
          <button disabled={!sel} onClick={()=>setStep(2)} style={{...S.primaryBtn,width:"100%",marginTop:14,opacity:sel?1:.4}}>Continuer →</button>
        </>}
        {step===2&&<>
          <div style={{background:"#F3F4F6",padding:"10px 14px",borderRadius:8,fontWeight:600,margin:"12px 0"}}>{sel.icon} {sel.name}</div>
          {sel.id!=="card"&&<><label style={S.label}>Numéro de téléphone</label><input style={S.input} placeholder="+225 07 xx xx xx"/></>}
          {sel.id==="card"&&<><label style={S.label}>Numéro de carte</label><input style={S.input} placeholder="1234 5678 9012 3456"/></>}
          <div style={{display:"flex",gap:8,marginTop:14}}>
            <button onClick={()=>setStep(1)} style={S.ghostBtn}>← Retour</button>
            <button onClick={()=>onPay(sel)} style={{...S.primaryBtn,flex:1}}>✓ Confirmer</button>
          </div>
        </>}
      </div>
    </div>
  );
}

function NotifModal({contract,onSend,onClose}){
  const [msg,setMsg]=useState(`Bonjour ${contract.tenantName}, votre loyer est en attente. Merci de régulariser.`);
  const [ch,setCh]=useState("sms");
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <button onClick={onClose} style={S.modalClose}>✕</button>
        <h2 style={S.modalTitle}>📲 Notification</h2>
        <div style={S.modalSub}>À : {contract.tenantName} · {contract.tenantPhone}</div>
        <div style={{display:"flex",gap:8,margin:"12px 0"}}>
          {[["sms","SMS"],["email","Email"],["whatsapp","WhatsApp"]].map(([v,l])=>(
            <button key={v} onClick={()=>setCh(v)} style={{padding:"8px 14px",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:13,background:ch===v?"#6366F1":"#F3F4F6",color:ch===v?"#fff":"#374151"}}>{l}</button>
          ))}
        </div>
        <textarea style={{...S.input,resize:"vertical",minHeight:90,width:"100%"}} value={msg} onChange={e=>setMsg(e.target.value)}/>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button onClick={onClose} style={S.ghostBtn}>Annuler</button>
          <button onClick={onSend} style={{...S.primaryBtn,flex:1}}>Envoyer</button>
        </div>
      </div>
    </div>
  );
}

function Toast({t}){return <div style={{...S.toast,background:t.type==="error"?"#EF4444":"#10B981"}}>{t.msg}</div>;}

// ── Styles ─────────────────────────────────────────────────────────────────────
const S={
  app:{display:"flex",minHeight:"100vh",background:"#F8FAFC",fontFamily:"'Sora',sans-serif"},
  sidebar:{width:216,background:"#0F172A",display:"flex",flexDirection:"column",padding:"20px 14px",gap:6,position:"fixed",height:"100vh",overflowY:"auto"},
  logo:{display:"flex",alignItems:"center",gap:8,marginBottom:20,padding:"0 4px"},
  nav:{display:"flex",flexDirection:"column",gap:3,flex:1},
  navBtn:{display:"flex",alignItems:"center",gap:8,padding:"9px 10px",background:"transparent",border:"none",color:"#94A3B8",cursor:"pointer",borderRadius:8,fontSize:12,fontWeight:500,textAlign:"left"},
  navBtnActive:{background:"#1E293B",color:"#F8FAFC"},
  sidebarActions:{display:"flex",flexDirection:"column",gap:6,paddingTop:12,borderTop:"1px solid #1E293B"},
  actionBtn:{padding:"9px 12px",background:"#6366F1",border:"none",color:"#fff",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600},
  main:{marginLeft:216,flex:1,padding:"26px 34px",maxWidth:"calc(100vw - 216px)",overflowX:"hidden"},
  pageTitle:{fontSize:22,fontWeight:800,color:"#0F172A",marginBottom:18,letterSpacing:"-0.5px"},
  sectionTitle:{fontSize:13,fontWeight:700,color:"#374151",margin:"0 0 10px"},
  section:{marginBottom:22},
  sectionDivider:{background:"#F1F5F9",borderRadius:6,padding:"7px 12px",fontWeight:700,fontSize:12,color:"#475569",marginTop:4},
  statsGrid:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:14},
  statCard:{background:"#fff",borderRadius:12,padding:"16px 14px",boxShadow:"0 1px 3px rgba(0,0,0,.07)"},
  contractList:{display:"flex",flexDirection:"column",gap:10},
  contractCard:{background:"#fff",borderRadius:12,padding:"13px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 3px rgba(0,0,0,.06)",border:"1px solid #F1F5F9",flexWrap:"wrap",gap:10},
  contractLeft:{display:"flex",flexDirection:"column",gap:3},
  contractRight:{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6},
  unpaidTag:{display:"inline-block",background:"#FEF2F2",color:"#EF4444",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20},
  smallBtn:{padding:"6px 11px",background:"#F3F4F6",border:"none",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:600,color:"#374151"},
  badge:{padding:"3px 9px",borderRadius:20,fontSize:11,fontWeight:700,color:"#fff"},
  housesGrid:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20},
  houseCard:{background:"#fff",borderRadius:12,padding:16,boxShadow:"0 1px 3px rgba(0,0,0,.06)",border:"1px solid #F1F5F9"},
  formCard:{background:"#fff",borderRadius:14,padding:24,maxWidth:640,boxShadow:"0 1px 3px rgba(0,0,0,.07)",display:"flex",flexDirection:"column",gap:11},
  label:{fontSize:12,fontWeight:600,color:"#374151"},
  input:{padding:"9px 12px",border:"1.5px solid #E5E7EB",borderRadius:8,fontSize:13,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box"},
  primaryBtn:{padding:"11px 20px",background:"#6366F1",border:"none",color:"#fff",borderRadius:10,cursor:"pointer",fontSize:13,fontWeight:700},
  ghostBtn:{padding:"11px 20px",background:"#F3F4F6",border:"none",color:"#374151",borderRadius:10,cursor:"pointer",fontSize:13,fontWeight:600},
  allGood:{background:"#F0FDF4",border:"1px solid #BBF7D0",color:"#166534",padding:18,borderRadius:12,textAlign:"center",fontSize:14,fontWeight:600},
  historyTable:{background:"#fff",borderRadius:10,overflow:"hidden",border:"1px solid #F1F5F9"},
  historyHead:{display:"grid",gridTemplateColumns:"1.2fr 1fr 1fr 1fr 1fr",padding:"8px 12px",background:"#F8FAFC",fontWeight:700,fontSize:11,color:"#6B7280"},
  historyRow:{display:"grid",gridTemplateColumns:"1.2fr 1fr 1fr 1fr 1fr",padding:"9px 12px",borderTop:"1px solid #F1F5F9",fontSize:12,color:"#374151"},
  unpaidRow:{display:"flex",alignItems:"center",gap:12,borderRadius:10,padding:"12px 14px",flexWrap:"wrap"},
  payNowBtn:{padding:"9px 16px",background:"#6366F1",border:"none",color:"#fff",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,marginLeft:"auto"},
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
  tenantAppHeader:{background:"#0F172A",padding:"13px 26px",display:"flex",justifyContent:"space-between",alignItems:"center"},
  tenantMain:{maxWidth:740,margin:"0 auto",padding:"26px 18px"},
  welcomeCard:{background:"linear-gradient(135deg,#6366F1,#8B5CF6)",borderRadius:14,padding:"22px 26px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:12},
  welcomeTitle:{fontSize:19,fontWeight:800,color:"#fff",marginBottom:4},
  welcomeSub:{fontSize:13,color:"#C7D2FE"},
  tenantStats:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20},
  tenantStatCard:{background:"#fff",borderRadius:12,padding:14,textAlign:"center",boxShadow:"0 1px 3px rgba(0,0,0,.06)"},
  tenantStatVal:{fontSize:24,fontWeight:800,marginBottom:4},
  tenantStatLabel:{fontSize:11,color:"#6B7280",fontWeight:500},
  logoutBtn:{padding:"6px 12px",background:"#1E293B",border:"none",color:"#94A3B8",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16},
  modal:{background:"#fff",borderRadius:16,padding:26,maxWidth:480,width:"100%",position:"relative",maxHeight:"92vh",overflowY:"auto"},
  modalClose:{position:"absolute",top:12,right:12,background:"none",border:"none",fontSize:17,cursor:"pointer",color:"#6B7280"},
  modalTitle:{fontSize:18,fontWeight:800,color:"#0F172A",marginBottom:4},
  modalSub:{fontSize:13,color:"#6B7280",marginBottom:4},
  toast:{position:"fixed",bottom:20,right:20,color:"#fff",padding:"12px 18px",borderRadius:10,fontWeight:600,fontSize:13,zIndex:2000,boxShadow:"0 4px 12px rgba(0,0,0,.15)"},
};

const css=`
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  button:hover{opacity:.88;}
  input:focus,textarea:focus,select:focus{border-color:#6366F1!important;}
`;
