

//removed page

import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

const Scan = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Try to get name from location.state or localStorage
  const name = location.state?.name || localStorage.getItem('driverName') || "";

  // Store name in localStorage for Scanner fallback
  if (name) localStorage.setItem('driverName', name);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <h1>Scan Page</h1>
      <button
        style={{ padding: '1em 2.5em', fontSize: '1.2em', background: '#1c6954', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', marginTop: 24 }}
        onClick={() => navigate('/driver-dashboard', { state: { name } })}
      >
        Scan
      </button>
    </div>
  );
};

export default Scan;
