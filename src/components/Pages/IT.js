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
  const [searchRole, setSearchRole] = useState(""); // '' means none selected
  const [searchStatus, setSearchStatus] = useState(""); // '' means none selected
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
  // Table sorting state (align with Resignated/Samples behavior)
  const [sortField, setSortField] = useState("userId");
  const [sortAsc, setSortAsc] = useState(true);

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
      online: true, // drivers are always online once registered
      networkStatus: 'online', // drivers are always online once registered
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
      online: true, // drivers are always online once registered
      networkStatus: 'online', // drivers are always online once registered
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

  // Functional filtering logic
  const filterUsers = (users, userType) => {
    return users.filter(user => {
      // Text search filter
      const searchMatch = !searchTerm.trim() || 
        (user.name || "").toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
        (user.email || "").toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
        (user.userId || "").toLowerCase().includes(searchTerm.trim().toLowerCase());

      // Category filter
      const categoryMatch = !searchCategory || 
        (searchCategory === "admins" && userType === "admin") ||
        (searchCategory === "drivers" && userType === "driver") ||
        (searchCategory === "pending" && userType === "pending");

      // Role filter
      const roleMatch = !searchRole || user.role === searchRole;

      // Status filter
      const statusMatch = !searchStatus || 
        (searchStatus === "approved" && user.approved === true) ||
        (searchStatus === "pending" && user.approved !== true);

      return searchMatch && categoryMatch && roleMatch && statusMatch;
    });
  };

  // Apply filters to different user types
  const filteredPendingUsers = filterUsers(pendingUsers, "pending");
  const filteredAdmins = filterUsers(sortedAdminUsers, "admin");
  const filteredDrivers = filterUsers(sortedDriverUsers, "driver");

  // Combine all filtered results (keep group order: pending -> admin -> driver)
  const allFilteredUsers = [...filteredPendingUsers, ...filteredAdmins, ...filteredDrivers];

  // Define common sort accessor based on current sortField
  const getSortValue = (u) => {
    switch (sortField) {
      case 'status':
        return (u.approved === true ? 'approved' : (u.approved !== true && u.approved !== false ? 'pending' : 'pending'));
      case 'role':
        return (u.role || '').toString();
      case 'userId':
        return (u.userId || '').toString();
      case 'name':
        return (u.name || '').toString();
      case 'email':
        return (u.email || '').toString();
      default:
        return (u.userId || '').toString();
    }
  };

  const sortGroup = (arr) => [...arr].sort((a, b) => {
    const aVal = getSortValue(a);
    const bVal = getSortValue(b);
    return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  const sortedAllFilteredUsers = [
    ...sortGroup(filteredPendingUsers),
    ...sortGroup(filteredAdmins),
    ...sortGroup(filteredDrivers)
  ];

  // Sort controls
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc((asc) => !asc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const getSortIcon = (field) => {
    if (field !== sortField) return '';
    return sortAsc ? 'sort-asc' : 'sort-desc';
  };

  // Calculate stats
  const totalUsers = sortedAdminUsers.length + sortedDriverUsers.length;
  const activeUsers = totalUsers;
  const pendingCount = pendingUsers.length;
  const systemLoad = totalUsers > 0 ? Math.round((activeUsers / (totalUsers + pendingCount)) * 100) : 0;

  // Render rows with spacer between sections (pending -> admin -> driver)
  const renderUserRows = () => {
    const rows = [];
    let lastType = null;

    sortedAllFilteredUsers.forEach((user) => {
      const isPending = user.approved !== true && user.approved !== false;
      const isAdmin = user.role === "admin" && user.approved === true;
      const isDriver = user.role === "driver" && user.approved === true;
      const type = isPending ? 'pending' : (isAdmin ? 'admin' : 'driver');

      if (lastType && lastType !== type) {
        const nextLabel = type === 'admin' ? 'Admins' : 'Drivers';
        rows.push(
          <tr key={`spacer-${rows.length}`} className="spacer-row">
            <td className="spacer-label">{nextLabel}</td>
            <td colSpan={5} style={{ padding: 0, height: '12px', border: 'none' }}></td>
          </tr>
        );
      }

      rows.push(
        <tr key={user.id} id={`user-row-${user.id}`}>
          <td>{user.userId || "-"}</td>
          <td>{user.name || "-"}</td>
          <td>{user.email || "-"}</td>
          <td>
            {isPending ? (
              user.role && user.role !== 'role' ? (
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
              )
            ) : (
              <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                {user.role || (isAdmin ? "admin" : "driver")}
              </span>
            )}
          </td>
          <td>
            {isPending ? (
              <span className="status-pending">PENDING</span>
            ) : (
              <span className="status-active">APPROVED</span>
            )}
          </td>
          <td>
            <div className="action-buttons">
              {isPending ? (
                <>
                  <button
                    className="btn"
                    onClick={() => handleApprovePending(user.id)}
                    disabled={!pendingRoles[user.id]}
                  >
                    <span>APPROVE</span>
                    <div className="ripple-container">
                      <span></span><span></span><span></span><span></span><span></span>
                      <span></span><span></span><span></span><span></span><span></span>
                    </div>
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleReject(user.id)}
                  >
                    <span>REJECT</span>
                    <div className="ripple-container">
                      <span></span><span></span><span></span><span></span><span></span>
                      <span></span><span></span><span></span><span></span><span></span>
                    </div>
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-danger"
                  onClick={() => handleRemove(user.id)}
                >
                  <span>REMOVE</span>
                  <div className="ripple-container">
                    <span></span><span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span><span></span>
                  </div>
                </button>
              )}
            </div>
          </td>
        </tr>
      );

      lastType = type;
    });

    return rows;
  };

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

          {/* Functional Search System */}
          <div className="filter-card">
            <div className="filter-grid">
              <div className="filter-input">
                <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
                <input
                  type="text"
                  placeholder="Search by name, email, or ID..." 
                  className="search-field"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>



              <div className="filter-select">
                <select 
                  className="select-field select-indigo"
                  value={searchRole}
                  onChange={(e) => setSearchRole(e.target.value)}
                >
                  <option value="">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="driver">Driver</option>
                </select>
              </div>

              <div className="filter-select">
                <select 
                  className="select-field select-sky"
                  value={searchStatus}
                  onChange={(e) => setSearchStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            <div className="filter-summary">
              <div className="active-filters">
                <span>Active Filters:</span>
                <div id="filterBadges">
                  {searchTerm && <span className="filter-badge">Search: {searchTerm}</span>}
                  {searchCategory && <span className="filter-badge">Category: {searchCategory}</span>}
                  {searchRole && <span className="filter-badge">Role: {searchRole}</span>}
                  {searchStatus && <span className="filter-badge">Status: {searchStatus}</span>}
                </div>
              </div>
              <button 
                className="clear-button"
                onClick={() => {
                  setSearchTerm("");
                  setSearchCategory("");
                  setSearchRole("");
                  setSearchStatus("");
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                Clear All
              </button>
            </div>
          </div>

          {/* Top-right action button (outside table container) */}
          <div className="table-top-actions" style={{ width: '100%' }}>
            <button
              className="btn btn-wide"
              onClick={() => navigate('/resignated')}
            >
              <span>View Removed Users</span>
              <div className="ripple-container">
                <span></span><span></span><span></span><span></span><span></span>
                <span></span><span></span><span></span><span></span><span></span>
              </div>
            </button>
          </div>

          {/* Data Table */}
          <div style={{ width: '100%', maxWidth: '100%', margin: '0 auto', padding: '0 5px' }}>
            <div className="table-container">
              <div className="table-wrapper">
                <table className="excel-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th className={getSortIcon('userId')} onClick={() => handleSort('userId')}>ID</th>
                      <th className={getSortIcon('name')} onClick={() => handleSort('name')}>USER NAME</th>
                      <th className={getSortIcon('email')} onClick={() => handleSort('email')}>EMAIL</th>
                      <th className={getSortIcon('role')} onClick={() => handleSort('role')}>ROLE</th>
                      <th className={getSortIcon('status')} onClick={() => handleSort('status')}>STATUS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAllFilteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#93c5fd' }}>
                          No users found matching the current filters.
                        </td>
                      </tr>
                    ) : (
                      renderUserRows()
                    )}
                  </tbody>
                </table>
                <div className="table-footer">
                  <span>Showing: {allFilteredUsers.length} of {totalUsers} users | Pending: {pendingCount} | Total Admins: {sortedAdminUsers.length} | Total Drivers: {sortedDriverUsers.length}</span>
                </div>
              </div>
            </div>
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
