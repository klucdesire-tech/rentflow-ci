import React, { useState } from "react";

/* ================================
   TYPES
================================ */
type House = {
  id: string;
  address: string;
  city: string;
  rent: number;
  available: boolean;
};

type Contract = {
  id: string;
  houseId: string;
  tenantName: string;
  pin: string;
  status: "active" | "closed";
};

/* ================================
   DATA INITIALE
================================ */
const initialHouses: House[] = [
  { id: "H001", address: "Cocody Angré", city: "Abidjan", rent: 150000, available: false },
  { id: "H002", address: "Marcory", city: "Abidjan", rent: 100000, available: true },
];

const initialContracts: Contract[] = [
  { id: "C001", houseId: "H001", tenantName: "Kouassi Jean", pin: "1234", status: "active" },
];

/* ================================
   APP
================================ */
export default function App() {
  const [mode, setMode] = useState<"home" | "owner" | "tenant">("home");
  const [houses] = useState<House[]>(initialHouses);
  const [contracts] = useState<Contract[]>(initialContracts);

  /* ================================
     HOME
  ================================= */
  if (mode === "home") {
    return (
      <div style={containerStyle}>
        <h1>🏠 RentFlow CI</h1>
        <button style={buttonStyle} onClick={() => setMode("owner")}>
          👔 Espace Propriétaire
        </button>
        <button style={buttonStyle} onClick={() => setMode("tenant")}>
          🏡 Espace Locataire
        </button>
      </div>
    );
  }

  /* ================================
     OWNER
  ================================= */
  if (mode === "owner") {
    return (
      <div style={containerStyle}>
        <h2>👔 Tableau Propriétaire</h2>

        <p>Maisons totales : {houses.length}</p>
        <p>
          Maisons disponibles : {houses.filter((h) => h.available).length}
        </p>
        <p>
          Contrats actifs :{" "}
          {contracts.filter((c) => c.status === "active").length}
        </p>

        <button style={buttonStyle} onClick={() => setMode("home")}>
          ← Retour
        </button>
      </div>
    );
  }

  /* ================================
     TENANT LOGIN
  ================================= */
  return <TenantPortal contracts={contracts} onBack={() => setMode("home")} />;
}

/* ================================
   TENANT PORTAL
================================ */
function TenantPortal({
  contracts,
  onBack,
}: {
  contracts: Contract[];
  onBack: () => void;
}) {
  const [contractId, setContractId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const login = () => {
    const found = contracts.find(
      (c) => c.id === contractId && c.pin === pin
    );

    if (!found) {
      setError("Contrat ou PIN incorrect.");
      return;
    }

    alert("Connexion réussie !");
  };

  return (
    <div style={containerStyle}>
      <h2>🏡 Connexion Locataire</h2>

      <input
        style={inputStyle}
        placeholder="Numéro contrat"
        value={contractId}
        onChange={(e) => setContractId(e.target.value)}
      />

      <input
        style={inputStyle}
        placeholder="PIN"
        type="password"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
      />

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button style={buttonStyle} onClick={login}>
        Se connecter
      </button>

      <button style={buttonStyle} onClick={onBack}>
        ← Retour
      </button>
    </div>
  );
}

/* ================================
   STYLES (100% TypeScript SAFE)
================================ */
const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: "20px",
  fontFamily: "sans-serif",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 20px",
  backgroundColor: "#6366F1",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  width: "200px",
};