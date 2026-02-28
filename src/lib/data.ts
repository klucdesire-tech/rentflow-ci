import { Contract, House, PaymentEntry } from "@/types";

export const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
export const MONTHS_SHORT = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

export const PAYMENT_METHODS = [
  { id: "orange", name: "Orange Money", icon: "🟠", color: "#FF6600" },
  { id: "wave",   name: "Wave",         icon: "🔵", color: "#1A73E8" },
  { id: "mtn",    name: "MTN MoMo",     icon: "🟡", color: "#FFCC00" },
  { id: "card",   name: "Carte bancaire",icon: "💳", color: "#2D3748" },
];

export const CITIES = ["Abidjan","Bouaké","Daloa","San-Pédro","Yamoussoukro","Korhogo","Man","Gagnoa","Abengourou","Divo"];
export const HOUSE_TYPES = ["Appartement","Villa","Studio","Chambre","Duplex","Maison simple"];

export const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
export const genPin = () => String(Math.floor(1000 + Math.random() * 9000));
export const today = () => new Date().toLocaleDateString("fr-FR");

// Génération déterministe des paiements (seed basé sur startDate + rent)
export const genPayments = (startDateStr: string, rent: number, advanceMonths = 0): Record<string, PaymentEntry> => {
  const p: Record<string, PaymentEntry> = {};
  const start = new Date(startDateStr);
  const now = new Date();
  let year = start.getFullYear();
  let month = start.getMonth();
  let idx = 0;

  // Seed pseudo-aléatoire déterministe basé sur startDate + rent
  const seedStr = startDateStr + rent;
  let seed = Array.from(seedStr).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const seededRandom = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  };

  while (true) {
    if (year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth())) break;
    const k = `${year}-${month}`;
    const dueMonth = month === 11 ? 0 : month + 1;
    const dueYear = month === 11 ? year + 1 : year;
    const dueDate = new Date(dueYear, dueMonth, 5);
    const isOverdue = now > dueDate;
    const label = `${MONTHS[month]} ${year}`;
    const dueDateStr = `05 ${MONTHS_SHORT[dueMonth]} ${dueYear}`;

    if (idx < advanceMonths) {
      p[k] = {
        status: "paid", label, dueDate: dueDateStr,
        date: new Date(year, month, 1).toLocaleDateString("fr-FR"),
        method: "Avance", amount: rent,
      };
    } else {
      const paid = seededRandom() > 0.3;
      const dayOffset = Math.floor(seededRandom() * 10) + 1;
      const methods = ["Orange Money", "Wave", "MTN MoMo"];
      const methodIdx = Math.floor(seededRandom() * 3);
      p[k] = paid
        ? { status: "paid", label, dueDate: dueDateStr, date: new Date(year, month, dayOffset).toLocaleDateString("fr-FR"), method: methods[methodIdx], amount: rent }
        : { status: "unpaid", label, dueDate: dueDateStr, overdue: isOverdue, amount: rent };
    }

    month++;
    if (month > 11) { month = 0; year++; }
    idx++;
  }
  return p;
};

export const INIT_HOUSES: House[] = [
  { id:"H001", address:"12 Rue des Lilas",       city:"Abidjan",       type:"Appartement",   rooms:3, rent:150000, available:false },
  { id:"H002", address:"45 Av. Houphouët",        city:"Abidjan",       type:"Studio",        rooms:2, rent:95000,  available:false },
  { id:"H003", address:"8 Résid. Palm Beach",     city:"San-Pédro",     type:"Villa",         rooms:4, rent:220000, available:true  },
  { id:"H004", address:"22 Rue du Commerce",      city:"Bouaké",        type:"Maison simple", rooms:3, rent:80000,  available:true  },
  { id:"H005", address:"14 Av. de la Paix",       city:"Yamoussoukro",  type:"Appartement",   rooms:2, rent:70000,  available:false },
];

export const INIT_CONTRACTS: Contract[] = [
  {
    id:"C001", houseId:"H001", tenantName:"Kouassi Jean-Baptiste", tenantPhone:"+225 07 12 34 56",
    tenantEmail:"jb.kouassi@email.com", pin:"1234", startDate:"2025-01-15", editDate:"15/01/2025",
    status:"active", idRecto:null, idVerso:null, emergencyName:"Kouassi Ama",
    emergencyPhone:"+225 07 99 11 22", emergencyRelation:"Épouse",
    caution:{ paid:true, amount:300000 }, advance:{ paid:true, amount:300000, months:2 },
    payments: genPayments("2025-01-15", 150000, 2),
  },
  {
    id:"C002", houseId:"H002", tenantName:"Aya Fatima Diabaté", tenantPhone:"+225 05 98 76 54",
    tenantEmail:"aya.diabate@email.com", pin:"5678", startDate:"2024-10-01", editDate:"01/10/2024",
    status:"active", idRecto:null, idVerso:null, emergencyName:"Diabaté Moussa",
    emergencyPhone:"+225 05 44 55 66", emergencyRelation:"Frère",
    caution:{ paid:true, amount:190000 }, advance:{ paid:true, amount:285000, months:3 },
    payments: genPayments("2024-10-01", 95000, 3),
  },
  {
    id:"C003", houseId:"H005", tenantName:"Koné Ibrahim", tenantPhone:"+225 01 23 45 67",
    tenantEmail:"kone.ibrahim@email.com", pin:"9999", startDate:"2024-06-01", editDate:"01/06/2024",
    status:"active", idRecto:null, idVerso:null, emergencyName:"Koné Fatou",
    emergencyPhone:"+225 07 77 88 99", emergencyRelation:"Mère",
    caution:{ paid:false, amount:140000 }, advance:{ paid:true, amount:140000, months:2 },
    payments: genPayments("2024-06-01", 70000, 2),
  },
];
