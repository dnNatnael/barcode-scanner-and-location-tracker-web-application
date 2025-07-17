import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";

function SamplesTable({ driverName }) {
  const [samples, setSamples] = useState([]);
  useEffect(() => {
    const q = query(collection(db, "d_sample"), orderBy("date", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setSamples(snap.docs.map(doc => doc.data()));
    });
    return unsub;
  }, []);
  return (
    <div style={{ width: '100%', maxWidth: 1050, margin: '70px auto 0 auto' }}>
      <h2 style={{ margin: '1.5em 0 0.5em 0', textAlign: 'left' }}>Sample collected by {driverName}</h2>
      <table className="it-users-table">
        <thead>
          <tr>
            <th style={{ width: '25%', fontSize: '1.35em' }}>ID</th>
            <th style={{ width: '25%', fontSize: '1.35em' }}>Barcode</th>
            <th style={{ width: '25%', fontSize: '1.35em' }}>Location</th>
            <th style={{ width: '25%', fontSize: '1.35em' }}>Date and Time</th>
          </tr>
        </thead>
        <tbody>
          {samples.map(s => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.barcode}</td>
              <td>{s.location}</td>
              <td>{s.date?.toDate ? s.date.toDate().toLocaleString() : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: '0.9em', marginTop: '0.3em', color: '#555' }}>
        Total Samples: {samples.length}
      </div>
    </div>
  );
}

const DriverSampleScan = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const driverName = location.state?.driverName || "Driver";
  return (
    <>
      <button
        onClick={() => navigate(-1)}
        style={{
          position: 'absolute',
          top: 60,
          left: 100,
          padding: '0.18em 0.7em',
          fontSize: '0.85em',
          borderRadius: '8px',
          border: 'none',
          background: 'linear-gradient(90deg, #1c6954 0%, #23a393 100%)',
          color: '#fff',
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(44, 62, 80, 0.10)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transition: 'all 0.2s',
        }}
        onMouseOver={e => {
          e.currentTarget.style.background = 'linear-gradient(90deg, #155c47 0%, #1c6954 100%)';
          e.currentTarget.style.transform = 'scale(1.06)';
        }}
        onMouseOut={e => {
          e.currentTarget.style.background = 'linear-gradient(90deg, #1c6954 0%, #23a393 100%)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <span style={{ fontSize: '1em', marginRight: 3 }}>&larr;</span> <span style={{ fontSize: '0.95em' }}>Back</span>
      </button>
      <SamplesTable driverName={driverName} />
    </>
  );
};

export default DriverSampleScan;
