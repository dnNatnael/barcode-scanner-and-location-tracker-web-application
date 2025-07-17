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
    });
    // Optionally, delete from users collection if it exists
    await deleteDoc(doc(db, "users", userId));
  };

  const handleReject = async (userId) => {
    const user = users.find((u) => u.id === userId);
    // Only delete from 'users' collection, do not add to resignated collection
    await deleteDoc(doc(db, "users", userId));
    setPendingRoles((prev) => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });
  };

  const handleRemove = async (userId) => {
    const user = users.find((u) => u.id === userId) || adminUsers.find((u) => u.id === userId) || driverUsers.find((u) => u.id === userId);
    if (!user) return;
    const confirmed = window.confirm("Are you sure you want to remove this user from the database? This action cannot be undone.");
    if (!confirmed) return;
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

  return (
    <div className="it-container">
      <h1>Manage Registered Users</h1>
      {/* Search Bar and Category Toggle */}
      <div style={{ marginBottom: '1.5em', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1em' }}>
        <input
          type="text"
          placeholder={searchCategory ? "Search users by name..." : "First select role"}
          value={searchTerm}
          onFocus={() => searchCategory && setSearchActive(true)}
          onChange={e => {
            if (searchCategory) {
              setSearchTerm(e.target.value);
              setSearchActive(true);
            }
          }}
          disabled={!searchCategory}
          ref={searchInputRef}
          style={{
            width: '40%', // reduced from 60%
            maxWidth: 250, // reduced from 400
            padding: '0.4em 0.8em', // reduced padding
            fontSize: '0.95em', // reduced font size
            borderRadius: '6px', // slightly smaller
            border: '1px solid #bfc9d9',
            marginBottom: '0.3em',
            outline: 'none',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            background: !searchCategory ? '#f3f3f3' : undefined,
            color: !searchCategory ? '#aaa' : undefined,
            cursor: !searchCategory ? 'not-allowed' : undefined,
          }}
        />
        {searchTerm && searchCategory && (
          <button
            onClick={() => setSearchTerm("")}
            style={{
              marginLeft: 8,
              padding: '0.3em 0.7em', // reduced
              fontSize: '0.9em', // reduced
              borderRadius: '5px',
              border: 'none',
              background: '#eee',
              cursor: 'pointer',
              color: '#333'
            }}
          >
            Clear
          </button>
        )}
        {/* Category Toggle Buttons */}
        <div style={{ display: 'flex', gap: '0.5em', marginLeft: 16 }}>
          <button
            ref={adminsBtnRef}
            onClick={() => {
              setSearchCategory('admins');
              setSearchTerm("");
              setTimeout(() => {
                if (searchInputRef.current) searchInputRef.current.focus();
              }, 0);
            }}
            style={{
              padding: '0.3em 0.8em', // reduced
              borderRadius: '5px',
              border: searchCategory === 'admins' ? '2px solid #457b9d' : '1px solid #bfc9d9',
              background: searchCategory === 'admins' ? '#e9f0fa' : '#f8fafc',
              color: searchCategory === 'admins' ? '#1d3557' : '#333',
              fontWeight: searchCategory === 'admins' ? 700 : 500,
              cursor: 'pointer',
              fontSize: '0.95em', // reduced
              transition: 'all 0.2s',
            }}
          >
            Admins
          </button>
          <button
            ref={driversBtnRef}
            onClick={() => {
              setSearchCategory('drivers');
              setSearchTerm("");
              setTimeout(() => {
                if (searchInputRef.current) searchInputRef.current.focus();
              }, 0);
            }}
            style={{
              padding: '0.3em 0.8em', // reduced
              borderRadius: '5px',
              border: searchCategory === 'drivers' ? '2px solid #457b9d' : '1px solid #bfc9d9',
              background: searchCategory === 'drivers' ? '#e9f0fa' : '#f8fafc',
              color: searchCategory === 'drivers' ? '#1d3557' : '#333',
              fontWeight: searchCategory === 'drivers' ? 700 : 500,
              cursor: 'pointer',
              fontSize: '0.95em', // reduced
              transition: 'all 0.2s',
            }}
          >
            Drivers
          </button>
        </div>
      </div>
      {searchActive && searchTerm && searchCategory && (
        <div ref={searchResultsRef} style={{ marginBottom: '2em', display: 'flex', justifyContent: 'center' }}>
            {searchCategory === 'admins' && (
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: '100%',
                  maxWidth: 800,
                background: '#1c6954', // highlight color
                color: '#fff', // white text
                  borderRadius: '8px',
                padding: '0.3em 0',
                  marginBottom: 6,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontWeight: 700,
                fontSize: '1.05em',
                  letterSpacing: '0.5px',
                border: 'none',
                boxShadow: 'none',
                }}>
                  <span style={{ textAlign: 'center', width: '100%' }}>Admins</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, minHeight: 32, width: '100%', maxWidth: 800 }}>
                  {filteredAdminsSorted.length === 0 ? (
                    <li style={{ color: '#888', fontStyle: 'italic' }}>No matching admins found.</li>
                  ) : (
                    filteredAdminsSorted.map(user => (
                      <li
                        key={user.id}
                        style={{
                          padding: '4px 0',
                          borderBottom: '1px solid #eee',
                          display: 'flex',
                          width: '100%',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        fontSize: '0.6rem', // was 0.7rem
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onClick={() => handleResultClick(user.id)}
                        title={`Go to ${user.name} in table`}
                      >
                        <span style={{ fontWeight: 500, textAlign: 'left', flex: 1 }}>{user.name}</span>
                      <span style={{ color: '#888', fontSize: '0.7rem', textAlign: 'right', flex: 1 }}>{user.userId || '-'}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
            {searchCategory === 'drivers' && (
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: '100%',
                  maxWidth: 800,
                background: '#1c6954', // highlight color
                color: '#fff', // white text
                  borderRadius: '8px',
                padding: '0.3em 0',
                  marginBottom: 6,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontWeight: 700,
                fontSize: '1.05em',
                  letterSpacing: '0.5px',
                border: 'none',
                boxShadow: 'none',
                }}>
                  <span style={{ textAlign: 'center', width: '100%' }}>Drivers</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, minHeight: 32, width: '100%', maxWidth: 800 }}>
                  {filteredDriversSorted.length === 0 ? (
                    <li style={{ color: '#888', fontStyle: 'italic' }}>No matching drivers found.</li>
                  ) : (
                    filteredDriversSorted.map(user => (
                      <li
                        key={user.id}
                        style={{
                          padding: '4px 0',
                          borderBottom: '1px solid #eee',
                          display: 'flex',
                          width: '100%',
                          alignItems: 'center',
                          fontSize: '1em',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                          justifyContent: 'space-between',
                        }}
                        onClick={() => handleResultClick(user.id)}
                        title={`Go to ${user.name} in table`}
                      >
                        <span style={{ fontWeight: 500, textAlign: 'left', flex: 1, fontSize: '0.7rem' }}>{user.name}</span>
                        <span style={{ color: '#888', fontSize: '0.7rem', textAlign: 'right', flex: 1 }}>{user.userId || '-'}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
        </div>
      )}
      {loading ? (
        <div>Loading users...</div>
      ) : (
        <>
          <h2>New Registrations</h2>
          <table className="it-users-table">
            <thead>
              <tr>
                <th style={{ width: '15%' }}>Name</th>
                <th style={{ width: '22%' }}>Email</th>
                <th style={{ width: '13%', textAlign: 'left', paddingLeft: 8 }}>Role</th>
                <th style={{ width: '13%' }}>Status</th>
                <th style={{ width: '18%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingUsers.map((user) => (
                <tr key={user.id} className="pending">
                  <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{user.name || "-"}</td>
                  <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>{user.email || "-"}</td>
                  <td style={{ width: '13%', textAlign: 'left', paddingLeft: 8 }}>
                    {user.role && user.role !== 'role' ? (
                      <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                        {user.role}
                      </span>
                    ) : (
                      <select
                        value={pendingRoles[user.id] || ""}
                        onChange={(e) => handlePendingRoleChange(user.id, e.target.value)}
                        className="role-select"
                        style={{
                          width: '80px',
                          minWidth: 60,
                          fontSize: '0.85rem',
                          padding: '0.18rem 0.8rem',
                          textTransform: 'capitalize',
                          fontWeight: 500,
                          borderRadius: '9999px',
                          border: '1px solid #bfc9d9',
                          background: '#f8fafc',
                          height: '1.7rem',
                          outline: 'none',
                          transition: 'border 0.2s',
                          textAlign: 'left',
                          display: 'inline-block',
                          marginLeft: 0,
                        }}
                      >
                        <option value="" disabled style={{ fontWeight: 700, color: '#22223b', background: '#fff' }}>Role</option>
                        <option value="admin">Admin</option>
                        <option value="driver">Driver</option>
                      </select>
                    )}
                  </td>
                  <td style={{ fontWeight: 700, color: '#b8860b', fontSize: '0.75rem' }}>Pending</td>
                  <td>
                    <button
                      className="approve-btn"
                      onClick={() => handleApprovePending(user.id)}
                      disabled={!pendingRoles[user.id]}
                      style={{ marginRight: '0.2rem' }}
                    >
                      Approve
                    </button>
                    <button
                      className="reject-btn"
                      onClick={() => handleReject(user.id)}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: '0.9em', marginTop: '0.3em', color: '#555' }}>
            Total New Registrations: {pendingUsers.length}
          </div>

          <h2>Admins</h2>
          <table className="it-users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Approved Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedAdminUsers.map((user) => (
                <tr
                  key={user.id}
                  id={`user-row-${user.id}`}
                  className={user.approved === false ? "rejected" : user.approved ? "approved" : "pending"}
                  style={highlightedRowId === user.id ? { background: '#ffe082', transition: 'background 0.5s' } : {}}
                >
                  <td>{user.userId || "-"}</td>
                  <td>{user.name || "-"}</td>
                  <td>{user.email || "-"}</td>
                  <td>{user.role || "admin"}</td>
                  <td>
                    {user.approved === true ? (
                      <span style={{ color: '#1c6954', fontWeight: 700 }}>Approved</span>
                    ) : user.approved === false ? (
                      'Rejected'
                    ) : (
                      'Pending'
                    )}
                  </td>
                  <td>{user.createdAt ? formatDateTime(user.createdAt) : "-"}</td>
                  <td>
                    <button
                      className="remove-btn"
                      onClick={() => handleRemove(user.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: '0.9em', marginTop: '0.3em', color: '#555' }}>
            Total Admins: {sortedAdminUsers.length}
          </div>

          <h2>Drivers</h2>
          <table className="it-users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Approved Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedDriverUsers.map((user) => (
                <tr
                  key={user.id}
                  id={`user-row-${user.id}`}
                  className={user.approved === false ? "rejected" : user.approved ? "approved" : "pending"}
                  style={highlightedRowId === user.id ? { background: '#ffe082', transition: 'background 0.5s' } : {}}
                >
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
                  <td>{user.createdAt ? formatDateTime(user.createdAt) : "-"}</td>
                  <td>
                    <button
                      className="remove-btn"
                      onClick={() => handleRemove(user.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: '0.9em', marginTop: '0.3em', color: '#555' }}>
            Total Drivers: {sortedDriverUsers.length}
          </div>

          <div style={{ fontWeight: 'bold', fontSize: '1em', marginTop: '1.5em', textAlign: 'right', color: '#1c6954' }}>
            Total Registered Users: {sortedAdminUsers.length + sortedDriverUsers.length}
          </div>
          
          <div style={{ textAlign: 'center', marginTop: '30px', padding: '20px', borderTop: '2px solid #eee' }}>
            <button
              className="resigned-btn"
              onClick={() => navigate('/resignated')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#c82333';
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = '#dc3545';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              View Removed Users
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default IT;
