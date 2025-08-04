import React, { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import "../Styles/IT.css";
import { useNavigate } from "react-router-dom";

const DriversList = () => {
  const [drivers, setDrivers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const driverCol = collection(db, "driver");
    const unsubscribe = onSnapshot(driverCol, (snapshot) => {
      const driverList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setDrivers(driverList);
    });
    return () => unsubscribe();
  }, []);

  // Sort drivers by userId
  const sortedDrivers = drivers.sort((a, b) => (a.userId || '').localeCompare(b.userId || ''));

  return (
    <div style={{ width: '100%', maxWidth: '100%', margin: '40px auto 0 auto', padding: '0' }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
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
      <h1 style={{ fontSize: '1.5em', marginBottom: '1em', marginTop: '50px' }}>Registered Drivers</h1>
      <table className="it-users-table" style={{ marginTop: '-15px', width: '100%' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Approved Date</th>
            <th>Samples</th>
          </tr>
        </thead>
        <tbody>
          {sortedDrivers.length === 0 ? (
            <tr><td colSpan="7" style={{ padding: '1.5em', color: '#888' }}>No registered drivers found.</td></tr>
          ) : (
            sortedDrivers.map((user) => (
              <tr key={user.id} className={user.approved === false ? "rejected" : user.approved ? "approved" : "pending"}>
                <td>{user.userId || "-"}</td>
                <td>{user.name || "-"}</td>
                <td>{user.email || "-"}</td>
                <td>{user.role || "driver"}</td>
                <td>
                  {user.approved === true ? (
                    <span style={{ color: '#1c6954', fontWeight: 700 }}>Approved</span>
                  ) : user.approved === false ? (
                    'Rejected'
                  ) : (
                    'Pending'
                  )}
                </td>
                <td>{user.createdAt && user.createdAt.toDate ? user.createdAt.toDate().toLocaleString() : "-"}</td>
                <td>
                  <button
                    style={{ padding: '0.4em 1.1em', background: '#457b9d', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.98em' }}
                    onClick={() => navigate('/driver-sample-scan', { state: { driverId: user.userId, driverName: user.name, isAdminAccess: true } })}
                  >
                    Samples
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div style={{ fontSize: '0.9em', marginTop: '0.3em', color: '#555' }}>
        Total Drivers: {sortedDrivers.length}
      </div>
    </div>
  );
};

export default DriversList;
