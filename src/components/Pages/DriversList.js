import React, { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import "../Styles/ExcelTable.css";
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
        className="back-button"
      >
        <span>&larr;</span> <span>Back</span>
      </button>
      <div className="table-container" style={{ margin: '0', padding: '0' }}>
        <h1 className="page-title">Registered Drivers</h1>
        <table className="excel-table">
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
              <tr key={user.id}>
                <td>{user.userId || "-"}</td>
                <td>{user.name || "-"}</td>
                <td>{user.email || "-"}</td>
                <td>{user.role || "driver"}</td>
                <td>
                  {user.approved === true ? (
                    <span className="status-active">Approved</span>
                  ) : user.approved === false ? (
                    <span className="status-inactive">Rejected</span>
                  ) : (
                    <span className="status-pending">Pending</span>
                  )}
                </td>
                <td>{user.createdAt && user.createdAt.toDate ? user.createdAt.toDate().toLocaleString() : "-"}</td>
                <td>
                  <button
                    className="btn sample-btn"
                    onClick={() => navigate('/admin-view', { state: { driverId: user.userId, driverName: user.name } })}
                  >
                    Samples
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
              </table>
        <div className="table-footer">
          <span>Total Drivers: {sortedDrivers.length}</span>
        </div>
      </div>
    </div>
  );
};

export default DriversList;
