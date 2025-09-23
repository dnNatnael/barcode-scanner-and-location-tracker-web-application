import React, { useEffect, useState, useRef } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "../Styles/IT.css";

const formatDate = (date) => {
  if (!date) return "-";
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const Resignated = () => {
  const [adminUsers, setAdminUsers] = useState([]);
  const [driverUsers, setDriverUsers] = useState([]);
  const [adminSortField, setAdminSortField] = useState("userId");
  const [adminSortAsc, setAdminSortAsc] = useState(true);
  const [driverSortField, setDriverSortField] = useState("userId");
  const [driverSortAsc, setDriverSortAsc] = useState(true);
  // Unified sorting for combined removed users table
  const [sortField, setSortField] = useState("userId");
  const [sortAsc, setSortAsc] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchRole, setSearchRole] = useState(""); // '' | 'admin' | 'driver'
  const [searchStatus, setSearchStatus] = useState("removed"); // keep default to removed
  const [searchActive, setSearchActive] = useState(false); // retained but unused like IT
  const searchResultsRef = useRef(null);
  const adminsBtnRef = useRef(null);
  const driversBtnRef = useRef(null);
  const searchInputRef = useRef(null);
  const [highlightedRowId, setHighlightedRowId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const resignatedAdminCol = collection(db, "resignated_admin");
    const resignatedDriverCol = collection(db, "resignated_driver");
    const unsubAdmin = onSnapshot(resignatedAdminCol, (snapshot) => {
      const adminList = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          joinedAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : null,
          removedAt: data.resignedAt ? (data.resignedAt.toDate ? data.resignedAt.toDate() : new Date(data.resignedAt)) : null,
        };
      });
      setAdminUsers(adminList);
    });
    const unsubDriver = onSnapshot(resignatedDriverCol, (snapshot) => {
      const driverList = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          joinedAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : null,
          removedAt: data.resignedAt ? (data.resignedAt.toDate ? data.resignedAt.toDate() : new Date(data.resignedAt)) : null,
        };
      });
      setDriverUsers(driverList);
    });
    return () => {
      unsubAdmin();
      unsubDriver();
    };
  }, []);

  // Sorting logic for admins
  const handleAdminSort = (field) => {
    if (adminSortField === field) {
      setAdminSortAsc((asc) => !asc);
    } else {
      setAdminSortField(field);
      setAdminSortAsc(true);
    }
  };
  // Always sort by userId ascending by default
  const sortedAdminUsers = [...adminUsers].sort((a, b) => {
    if (adminSortField === 'userId') {
      return adminSortAsc
        ? (a.userId || '').localeCompare(b.userId || '')
        : (b.userId || '').localeCompare(a.userId || '');
    }
    let aVal = a[adminSortField];
    let bVal = b[adminSortField];
    if (aVal instanceof Date && bVal instanceof Date) {
      return adminSortAsc ? aVal - bVal : bVal - aVal;
    }
    if (typeof aVal === "string" && typeof bVal === "string") {
      return adminSortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return 0;
  });

  // Sorting logic for drivers
  const handleDriverSort = (field) => {
    if (driverSortField === field) {
      setDriverSortAsc((asc) => !asc);
    } else {
      setDriverSortField(field);
      setDriverSortAsc(true);
    }
  };
  // Always sort by userId ascending by default
  const sortedDriverUsers = [...driverUsers].sort((a, b) => {
    if (driverSortField === 'userId') {
      return driverSortAsc
        ? (a.userId || '').localeCompare(b.userId || '')
        : (b.userId || '').localeCompare(a.userId || '');
    }
    let aVal = a[driverSortField];
    let bVal = b[driverSortField];
    if (aVal instanceof Date && bVal instanceof Date) {
      return driverSortAsc ? aVal - bVal : bVal - aVal;
    }
    if (typeof aVal === "string" && typeof bVal === "string") {
      return driverSortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return 0;
  });

  // IT-like filtering
  const filterUsers = (users, roleLabel) => {
    return users.filter(user => {
      const term = searchTerm.trim().toLowerCase();
      const matchesText = !term ||
        (user.name || "").toLowerCase().includes(term) ||
        (user.email || "").toLowerCase().includes(term) ||
        (user.userId || "").toLowerCase().includes(term);

      const matchesRole = !searchRole || (user.role === searchRole);
      const matchesStatus = !searchStatus || searchStatus === 'removed'; // all entries are removed on this page

      return matchesText && matchesRole && matchesStatus;
    });
  };
  const filteredAdmins = filterUsers(adminUsers, 'admin');
  const filteredDrivers = filterUsers(driverUsers, 'driver');

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

  // Scroll and highlight handler (optional, for UX)
  const handleResultClick = (userId, category) => {
    setHighlightedRowId(`${category}-row-${userId}`);
    const row = document.getElementById(`${category}-row-${userId}`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('highlighted');
      setTimeout(() => {
        row.classList.remove('highlighted');
        setHighlightedRowId(null);
      }, 2000);
    }
  };

  // Sort handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc((asc) => !asc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Get sort icon
  const getSortIcon = (field) => {
    if (field !== sortField) return '';
    return sortAsc ? 'sort-asc' : 'sort-desc';
  };

  // Unified sorted groups (match IT grouping and comparator)
  const getSortValue = (u) => {
    switch (sortField) {
      case 'role': return (u.role || '').toString();
      case 'userId': return (u.userId || '').toString();
      case 'name': return (u.name || '').toString();
      case 'email': return (u.email || '').toString();
      case 'status': return 'removed';
      default: return (u.userId || '').toString();
    }
  };

  const sortGroup = (arr) => [...arr].sort((a, b) => {
    const av = getSortValue(a);
    const bv = getSortValue(b);
    return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const sortedAdminsGroup = sortGroup(filteredAdmins);
  const sortedDriversGroup = sortGroup(filteredDrivers);

  const renderRemovedRows = () => {
    const rows = [];
    let addedAdmin = false;
    if (sortedAdminsGroup.length > 0) {
      // Spacer heading for Admins at the top of the table
      rows.push(
        <tr key={`spacer-admins`} className="spacer-row">
          <td className="spacer-label">Admins</td>
          <td colSpan={4} style={{ padding: 0, height: '28px', border: 'none' }}></td>
        </tr>
      );
      sortedAdminsGroup.forEach((user) => {
        rows.push(
          <tr key={user.id} id={`user-row-${user.id}`}>
            <td>{user.userId || '-'}</td>
            <td>{user.name || '-'}</td>
            <td>{user.email || '-'}</td>
            <td><span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{user.role || 'admin'}</span></td>
            <td><span className="status-inactive">REMOVED</span></td>
          </tr>
        );
      });
      addedAdmin = true;
    }
    if (sortedDriversGroup.length > 0) {
      if (addedAdmin) {
        rows.push(
          <tr key={`spacer-removed`} className="spacer-row">
            <td className="spacer-label">Drivers</td>
            <td colSpan={4} style={{ padding: 0, height: '28px', border: 'none' }}></td>
          </tr>
        );
      }
      sortedDriversGroup.forEach((user) => {
        rows.push(
          <tr key={user.id} id={`user-row-${user.id}`}>
            <td>{user.userId || '-'}</td>
            <td>{user.name || '-'}</td>
            <td>{user.email || '-'}</td>
            <td><span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{user.role || 'driver'}</span></td>
            <td><span className="status-inactive">REMOVED</span></td>
          </tr>
        );
      });
    }
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
                <h1 className="main-title">Removed Users</h1>
              </div>
            </div>
          </div>

          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="action-btn btn-view"
            style={{
              position: 'absolute',
              top: 20,
              left: 20,
              padding: '0.5rem 1rem',
              fontSize: '0.9rem',
              borderRadius: '6px',
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

          {/* Filters (IT-like) */}
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
                  <option value="removed">Removed</option>
                </select>
              </div>
            </div>

            <div className="filter-summary">
              <div className="active-filters">
                <span>Active Filters:</span>
                <div id="filterBadges">
                  {searchTerm && <span className="filter-badge">Search: {searchTerm}</span>}
                  {searchRole && <span className="filter-badge">Role: {searchRole}</span>}
                  {searchStatus && <span className="filter-badge">Status: {searchStatus}</span>}
                </div>
              </div>
              <button 
                className="clear-button"
                onClick={() => {
                  setSearchTerm("");
                  setSearchRole("");
                  setSearchStatus("removed");
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
                  </tr>
                </thead>
                <tbody>
                  {sortedAdminsGroup.length + sortedDriversGroup.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#93c5fd' }}>
                        No removed users found.
                      </td>
                    </tr>
                  ) : (
                    renderRemovedRows()
                  )}
                </tbody>
              </table>
              <div className="table-footer">
                <span>Showing: {sortedAdminsGroup.length + sortedDriversGroup.length} removed users | Total Admins: {filteredAdmins.length} | Total Drivers: {filteredDrivers.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Resignated;
