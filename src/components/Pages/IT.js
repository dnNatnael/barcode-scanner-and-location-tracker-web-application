import React, { useEffect, useState, useRef } from "react";
import { db } from "../../firebase";
import { collection, getDocs, updateDoc, doc, deleteDoc, onSnapshot, setDoc } from "firebase/firestore";
import "../Styles/IT.css";
import { useNavigate } from "react-router-dom";

const padId = (num) => {
  return num.toString().padStart(4, "0");
};

const getNextId = async (users, role) => {
  const prefix = role === "admin" ? "AID-" : "DID-";

  // Get all users (including resigned ones) to check for used IDs
  const usersCol = collection(db, "users");
  const adminCol = collection(db, "admin");
  const driverCol = collection(db, "driver");
  const resignatedAdminCol = collection(db, "resignated_admin");
  const resignatedDriverCol = collection(db, "resignated_driver");

  const [allUsersSnapshot, adminSnapshot, driverSnapshot, resignatedAdminSnapshot, resignatedDriverSnapshot] = await Promise.all([
    getDocs(usersCol),
    getDocs(adminCol),
    getDocs(driverCol),
    getDocs(resignatedAdminCol),
    getDocs(resignatedDriverCol)
  ]);

  const allUsers = allUsersSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const adminUsers = adminSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const driverUsers = driverSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const resignatedAdmins = resignatedAdminSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const resignatedDrivers = resignatedDriverSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Combine all users from all collections
  const allUsersCombined = [...allUsers, ...adminUsers, ...driverUsers, ...resignatedAdmins, ...resignatedDrivers];

  // Extract all used IDs from all collections
  const usedIds = allUsersCombined
    .filter((u) => u.userId && u.userId.startsWith(prefix))
    .map((u) => parseInt(u.userId.replace(prefix, "")))
    .filter((n) => !isNaN(n));

  let next = 1;
  while (usedIds.includes(next)) next++;
  return prefix + padId(next);
};

// Add a date formatting helper
const formatDate = (date) => {
  if (!date) return "-";
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

// Update the formatDate function to include time
const formatDateTime = (date) => {
  if (!date) return "-";
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const IT = () => {
  const [users, setUsers] = useState([]); // Pending users
  const [adminUsers, setAdminUsers] = useState([]); // Approved admins
  const [driverUsers, setDriverUsers] = useState([]); // Approved drivers
  const [loading, setLoading] = useState(true);
  const [pendingRoles, setPendingRoles] = useState({}); // Track selected role for pending users
  const [searchTerm, setSearchTerm] = useState(""); // Search input state
  const navigate = useNavigate();
  const [highlightedRowId, setHighlightedRowId] = useState(null); // For row highlight
  const [searchCategory, setSearchCategory] = useState(""); // '' means none selected
  const adminsBtnRef = useRef(null);
  const driversBtnRef = useRef(null);
  const searchInputRef = useRef(null);
  const [adminSortAsc, setAdminSortAsc] = useState(true);
  const [driverSortAsc, setDriverSortAsc] = useState(true);
  const [searchActive, setSearchActive] = useState(false);
  const searchResultsRef = useRef(null);
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({ userId: null, userName: null });
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Enhanced outside click handler
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target) &&
        searchResultsRef.current &&
        !searchResultsRef.current.contains(event.target)
      ) {
        setSearchActive(false);
        setSearchTerm("");
        setSearchCategory("");
      }
    }
    if (searchActive) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [searchActive]);

  // Scroll and highlight handler
  const handleResultClick = (userId) => {
    const row = document.getElementById(`user-row-${userId}`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedRowId(userId);
      setTimeout(() => setHighlightedRowId(null), 2000);
    }
  };

  useEffect(() => {
    setLoading(true);
    const usersCol = collection(db, "users");
    const adminCol = collection(db, "admin");
    const driverCol = collection(db, "driver");

    // Listen for pending users
    const unsubscribeUsers = onSnapshot(usersCol, (userSnapshot) => {
      const userList = userSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsers(userList);
      setLoading(false);
    });
    // Listen for admins
    const unsubscribeAdmins = onSnapshot(adminCol, (adminSnapshot) => {
      const adminList = adminSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAdminUsers(adminList);
    });
    // Listen for drivers
    const unsubscribeDrivers = onSnapshot(driverCol, (driverSnapshot) => {
      const driverList = driverSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setDriverUsers(driverList);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeAdmins();
      unsubscribeDrivers();
    };
  }, []);

  // For new registrations, allow IT to select a role (status)
  const handlePendingRoleChange = (userId, newRole) => {
    setPendingRoles((prev) => ({ ...prev, [userId]: newRole }));
  };

  // Approve for new registrations uses selected status
  const handleApprovePending = async (userId) => {
    const role = pendingRoles[userId] || "driver";
    const user = users.find((u) => u.id === userId);
    const userIdVal = await getNextId(users, role);
    // Generate new document ID based on role and userId
    const newDocId = `${userIdVal}: ${user.name}`;
    const targetCollection = role === "admin" ? "admin" : "driver";
    setUsers((prev) => {
      return prev.map((u) =>
        u.id === userId ? { ...u, approved: true, role, userId: userIdVal } : u
      );
    });
    // Create new document in the correct collection and delete old pending document
    await setDoc(doc(db, targetCollection, newDocId), {
      name: user.name,
      email: user.email,
      approved: true,
      authUid: user.authUid || user.uid || null,
      role,
      userId: userIdVal,
      createdAt: user.createdAt || new Date(),
      online: false, // default offline
      networkStatus: 'offline', // default offline
    });
    await deleteDoc(doc(db, "users", userId));
    setPendingRoles((prev) => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });
  };

  // Approve for existing users (admins/drivers)
  const handleApprove = async (userId, role) => {
    const user = users.find((u) => u.id === userId);
    let userIdVal = user.userId;
    if (!userIdVal || !userIdVal.startsWith(role === "admin" ? "AID-" : "DID-")) {
      userIdVal = await getNextId(users, role);
    }
    // Generate new document ID based on role and userId
    const newDocId = `${userIdVal}: ${user.name}`;
    const targetCollection = role === "admin" ? "admin" : "driver";
    setUsers((prev) => {
      return prev.map((u) =>
        u.id === userId ? { ...u, approved: true, role, userId: userIdVal } : u
      );
    });
    // Create or update document in the correct collection
    await setDoc(doc(db, targetCollection, newDocId), {
      name: user.name,
      email: user.email,
      approved: true,
      authUid: user.authUid || user.uid || null,
      role,
      userId: userIdVal,
      createdAt: user.createdAt || new Date(),
      online: false, // default offline
      networkStatus: 'offline', // default offline
    });
    // Optionally, delete from users collection if it exists
    await deleteDoc(doc(db, "users", userId));
  };

  const handleReject = async (userId) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    
    // Show modal for rejection confirmation
    setModalData({ userId: userId, userName: user.name, action: 'reject' });
    setShowModal(true);
  };

  const confirmReject = async () => {
    const { userId } = modalData;
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    
    // Only delete from 'users' collection, do not add to resignated collection
    await deleteDoc(doc(db, "users", userId));
    setPendingRoles((prev) => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });
    
    // Close modal
    setShowModal(false);
    setModalData({ userId: null, userName: null, action: null });
    
    // Show success message
    setSuccessMessage(`${user.name} has been rejected successfully.`);
    setShowSuccessMessage(true);
    
    // Hide success message after 3 seconds
    setTimeout(() => {
      setShowSuccessMessage(false);
      setSuccessMessage("");
    }, 3000);
  };

  const handleRemove = async (userId) => {
    const user = users.find((u) => u.id === userId) || adminUsers.find((u) => u.id === userId) || driverUsers.find((u) => u.id === userId);
    if (!user) return;
    
    // Show modal instead of alert
    setModalData({ userId: userId, userName: user.name, action: 'remove' });
    setShowModal(true);
  };

  const confirmRemove = async () => {
    const { userId } = modalData;
    const user = users.find((u) => u.id === userId) || adminUsers.find((u) => u.id === userId) || driverUsers.find((u) => u.id === userId);
    if (!user) return;
    
    const role = user.role || "driver";
    const userIdVal = user.userId || await getNextId(users, role);
    // Use the existing document ID
    const docId = user.id;
    // Store in resignated collection using the same document ID
    const resignatedCollection = role === "admin" ? "resignated_admin" : "resignated_driver";
    await setDoc(doc(db, resignatedCollection, docId), {
      name: user.name,
      email: user.email,
      approved: false,
      role: role,
      userId: userIdVal,
      createdAt: user.createdAt || new Date(),
      resignedAt: new Date(),
      status: "Removed",
    });
    // Delete the original document from the correct collection
    if (users.find((u) => u.id === userId)) {
      await deleteDoc(doc(db, "users", userId));
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } else if (adminUsers.find((u) => u.id === userId)) {
      await deleteDoc(doc(db, "admin", userId));
      setAdminUsers((prev) => prev.filter((u) => u.id !== userId));
    } else if (driverUsers.find((u) => u.id === userId)) {
      await deleteDoc(doc(db, "driver", userId));
      setDriverUsers((prev) => prev.filter((u) => u.id !== userId));
    }
    setPendingRoles((prev) => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });
    
    // Close modal
    setShowModal(false);
    setModalData({ userId: null, userName: null, action: null });
    
    // Show success message
    setSuccessMessage(`${user.name} has been removed successfully.`);
    setShowSuccessMessage(true);
    
    // Hide success message after 3 seconds
    setTimeout(() => {
      setShowSuccessMessage(false);
      setSuccessMessage("");
    }, 3000);
  };

  const cancelRemove = () => {
    setShowModal(false);
    setModalData({ userId: null, userName: null });
  };

  // New Registrations: approved is null or missing
  const pendingUsers = users.filter((user) => user.approved !== true && user.approved !== false);
  // Admins: use adminUsers state, sorted by userId
  const sortedAdminUsers = adminUsers.sort((a, b) => (a.userId || '').localeCompare(b.userId || ''));
  // Drivers: use driverUsers state, sorted by userId
  const sortedDriverUsers = driverUsers.sort((a, b) => (a.userId || '').localeCompare(b.userId || ''));

  // Filtered lists based on searchTerm (character-by-character, starts-with, case-insensitive)
  const filterByName = (arr) => {
    if (!searchTerm.trim()) return [];
    return arr.filter(user =>
      (user.name || "").toLowerCase().startsWith(searchTerm.trim().toLowerCase())
    );
  };
  const filteredAdmins = filterByName(sortedAdminUsers);
  const filteredDrivers = filterByName(sortedDriverUsers);

  // Sort search results alphabetically by name (ascending)
  const filteredAdminsSorted = [...filteredAdmins].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const filteredDriversSorted = [...filteredDrivers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Calculate stats
  const totalUsers = sortedAdminUsers.length + sortedDriverUsers.length;
  const activeUsers = totalUsers;
  const pendingCount = pendingUsers.length;
  const systemLoad = totalUsers > 0 ? Math.round((activeUsers / (totalUsers + pendingCount)) * 100) : 0;

  return (
    <div className="retro-wave-page">
      <div className="container">
        {/* Retro Grid Background */}
        <div className="grid-background"></div>

        {/* Geometric Shapes */}
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
        <div className="shape shape-4"></div>

        <div className="content">
          {/* Header */}
          <div className="header-card">
            <div className="header-content">
              <div className="title-section">
                <h1 className="main-title">Manage Registered Users</h1>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="filter-card">
            <div className="filter-grid">
              <div className="filter-input">
                <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
        <input
          type="text"
                  placeholder="SEARCH USERS..." 
                  className="search-field"
          value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setSearchActive(true)}
          ref={searchInputRef}
                />
        </div>

              <div className="filter-select">
                <select className="select-field select-blue" value={searchCategory} onChange={(e) => setSearchCategory(e.target.value)}>
                  <option value="">SEARCH IN: ALL</option>
                  <option value="admins">SEARCH IN: ADMINS</option>
                  <option value="drivers">SEARCH IN: DRIVERS</option>
                </select>
      </div>

              <div className="filter-select">
                <select className="select-field select-indigo">
                  <option value="all">ROLE: ALL</option>
                  <option value="admin">ROLE: ADMIN</option>
                  <option value="driver">ROLE: DRIVER</option>
                </select>
                </div>

              <div className="filter-select">
                <select className="select-field select-sky">
                  <option value="all">STATUS: ALL</option>
                  <option value="approved">STATUS: APPROVED</option>
                  <option value="pending">STATUS: PENDING</option>
                </select>
              </div>
            </div>

            <div className="filter-summary">
              <div className="active-filters">
                <span>◄ FILTERS ACTIVE ►</span>
                <div id="filterBadges">
                  {searchTerm && <span className="filter-badge">SEARCH: {searchTerm}</span>}
                  {searchCategory && <span className="filter-badge">CATEGORY: {searchCategory.toUpperCase()}</span>}
                </div>
              </div>
              <button 
                className="clear-button"
                onClick={() => {
                  setSearchTerm("");
                  setSearchCategory("");
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                CLEAR ALL
              </button>
            </div>
        </div>

          {/* Data Table */}
          <div className="table-card">
            <div className="table-container">
              <table className="data-table">
            <thead>
                  <tr className="table-header">
                    <th className="th-cell">ID</th>
                    <th className="th-cell">USER NAME</th>
                    <th className="th-cell">EMAIL</th>
                    <th className="th-cell">ROLE</th>
                    <th className="th-cell">STATUS</th>
                    <th className="th-cell th-actions">ACTIONS</th>
              </tr>
            </thead>
                <tbody id="tableBody">
                  {/* New Registrations */}
              {pendingUsers.map((user) => (
                    <tr key={user.id} className="table-row pending">
                      <td className="td-cell td-id">{user.userId || "-"}</td>
                      <td className="td-cell td-name">{user.name || "-"}</td>
                      <td className="td-cell td-email">{user.email || "-"}</td>
                      <td className="td-cell td-role">
                    {user.role && user.role !== 'role' ? (
                      <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                        {user.role}
                      </span>
                    ) : (
                      <div className="paste-button">
                        <button className="button">
                          {pendingRoles[user.id] ? `${pendingRoles[user.id].charAt(0).toUpperCase() + pendingRoles[user.id].slice(1)} ▼` : 'Role ▼'}
                        </button>
                        <div className="dropdown-content">
                          <a id="top" href="#" onClick={(e) => { e.preventDefault(); handlePendingRoleChange(user.id, 'admin'); }}>Admin</a>
                          <a id="middle" href="#" onClick={(e) => { e.preventDefault(); handlePendingRoleChange(user.id, 'driver'); }}>Driver</a>
                        </div>
                      </div>
                    )}
                  </td>
                      <td className="td-cell td-status">
                        <span style={{ color: '#facc15', fontWeight: 700 }}>PENDING</span>
                      </td>
                      <td className="td-cell td-actions">
                        <div className="action-buttons">
                    <button
                            className="action-btn btn-approve"
                      onClick={() => handleApprovePending(user.id)}
                      disabled={!pendingRoles[user.id]}
                    >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 6L9 17l-5-5"></path>
                            </svg>
                            APPROVE
                    </button>
                    <button
                            className="action-btn btn-view"
                      onClick={() => handleReject(user.id)}
                    >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 6L6 18M6 6l12 12"></path>
                            </svg>
                            REJECT
                    </button>
                        </div>
                  </td>
                </tr>
              ))}
                  
                  {/* Admins */}
              {sortedAdminUsers.map((user) => (
                    <tr key={user.id} className="table-row approved" id={`user-row-${user.id}`}>
                      <td className="td-cell td-id">{user.userId || "-"}</td>
                      <td className="td-cell td-name">{user.name || "-"}</td>
                      <td className="td-cell td-email">{user.email || "-"}</td>
                      <td className="td-cell td-role">{user.role || "admin"}</td>
                      <td className="td-cell td-status">
                        <span style={{ color: '#22c55e', fontWeight: 700 }}>APPROVED</span>
                  </td>
                      <td className="td-cell td-actions">
                        <div className="action-buttons">
                    <button
                            className="action-btn btn-view"
                      onClick={() => handleRemove(user.id)}
                    >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            REMOVE
                    </button>
                        </div>
                  </td>
                </tr>
              ))}
                  
                  {/* Drivers */}
              {sortedDriverUsers.map((user) => (
                    <tr key={user.id} className="table-row approved" id={`user-row-${user.id}`}>
                      <td className="td-cell td-id">{user.userId || "-"}</td>
                      <td className="td-cell td-name">{user.name || "-"}</td>
                      <td className="td-cell td-email">{user.email || "-"}</td>
                      <td className="td-cell td-role">{user.role || "driver"}</td>
                      <td className="td-cell td-status">
                        <span style={{ color: '#22c55e', fontWeight: 700 }}>APPROVED</span>
                  </td>
                      <td className="td-cell td-actions">
                        <div className="action-buttons">
                    <button
                            className="action-btn btn-view"
                      onClick={() => handleRemove(user.id)}
                    >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            REMOVE
                    </button>
                        </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
            </div>
          </div>

          {/* Stats - At Bottom */}
          <div className="stats-grid">
            <div className="stat-card stat-blue">
              <p className="stat-number">{totalUsers}</p>
              <p className="stat-label">TOTAL USERS</p>
              <div className="stat-bar stat-bar-blue"></div>
            </div>

            <div className="stat-card stat-cyan">
              <p className="stat-number">{sortedDriverUsers.length}</p>
              <p className="stat-label">TOTAL DRIVERS</p>
              <div className="stat-bar stat-bar-cyan"></div>
            </div>

            <div className="stat-card stat-yellow">
              <p className="stat-number">{pendingCount}</p>
              <p className="stat-label">PENDING</p>
              <div className="stat-bar stat-bar-yellow"></div>
            </div>

            <div className="stat-card stat-green">
              <p className="stat-number">{sortedAdminUsers.length}</p>
              <p className="stat-label">TOTAL ADMINS</p>
              <div className="stat-bar stat-bar-green"></div>
            </div>
          </div>
          
          {/* View Removed Users Button */}
          <div style={{ textAlign: 'center', marginTop: '30px', padding: '20px', borderTop: '2px solid #374151' }}>
            <button
              className="action-btn btn-view"
              onClick={() => navigate('/resignated')}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                transition: 'all 0.3s ease'
              }}
            >
              View Removed Users
            </button>
          </div>
        </div>
      
      {/* Custom Confirmation Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-title">
              {modalData.action === 'reject' ? 'Confirm Rejection' : 'Confirm Removal'}
            </div>
            <div className="modal-message">
              Are you sure you want to {modalData.action === 'reject' ? 'reject' : 'remove'} <strong>{modalData.userName}</strong>? This action cannot be undone.
            </div>
            <div className="modal-buttons">
              <button className="modal-btn modal-btn-cancel" onClick={cancelRemove}>
                Cancel
              </button>
              <button 
                className="modal-btn modal-btn-confirm" 
                onClick={modalData.action === 'reject' ? confirmReject : confirmRemove}
              >
                {modalData.action === 'reject' ? 'Reject User' : 'Remove User'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}
      </div>
    </div>
  );
};

export default IT;
