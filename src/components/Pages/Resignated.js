import React, { useEffect, useState, useRef } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [searchCategory, setSearchCategory] = useState("");
  const [searchActive, setSearchActive] = useState(false);
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

  // Search logic (same as IT page)
  const filterByName = (arr) => {
    if (!searchTerm.trim()) return [];
    return arr.filter(user =>
      (user.name || "").toLowerCase().startsWith(searchTerm.trim().toLowerCase())
    );
  };
  const filteredAdmins = filterByName(sortedAdminUsers);
  const filteredDrivers = filterByName(sortedDriverUsers);
  const filteredAdminsSorted = [...filteredAdmins].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const filteredDriversSorted = [...filteredDrivers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

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
      <h1 style={{ textAlign: 'center' }}>Removed Users</h1>
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
                      onClick={() => handleResultClick(user.userId, 'admin')}
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
                        fontSize: '0.6rem', // was 0.7rem
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        justifyContent: 'space-between',
                      }}
                      onClick={() => handleResultClick(user.userId, 'driver')}
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
      <h2>Admins</h2>
      <table className="resignated-users-table">
        <thead>
          <tr>
            <th onClick={() => handleAdminSort("userId")}>ID</th>
            <th onClick={() => handleAdminSort("name")}>Name</th>
            <th onClick={() => handleAdminSort("email")}>Email</th>
            <th onClick={() => handleAdminSort("role")}>Role</th>
            <th onClick={() => handleAdminSort("joinedAt")}>Joined Date</th>
            <th onClick={() => handleAdminSort("removedAt")}>Removed Date</th>
          </tr>
        </thead>
        <tbody>
          {sortedAdminUsers.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', color: '#888' }}>
                No removed admins found.
              </td>
            </tr>
          ) : (
            sortedAdminUsers.map((user) => (
              <tr key={user.id} className={`removed${highlightedRowId === `admin-row-${user.userId}` ? ' highlighted' : ''}`} id={`admin-row-${user.userId}`}>
                <td>{user.userId || "-"}</td>
                <td>{user.name || "-"}</td>
                <td>{user.email || "-"}</td>
                <td>{user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "-"}</td>
                <td>{user.joinedAt ? formatDate(user.joinedAt) : "-"}</td>
                <td>{user.removedAt ? formatDate(user.removedAt) : "-"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div style={{ fontSize: '0.8em', marginTop: '0.5em', color: '#ffffff', textAlign: 'left' }}>
        Total Removed Admins: {sortedAdminUsers.length}
      </div>
      <h2>Drivers</h2>
      <table className="resignated-users-table">
        <thead>
          <tr>
            <th onClick={() => handleDriverSort("userId")}>ID</th>
            <th onClick={() => handleDriverSort("name")}>Name</th>
            <th onClick={() => handleDriverSort("email")}>Email</th>
            <th onClick={() => handleDriverSort("role")}>Role</th>
            <th onClick={() => handleDriverSort("joinedAt")}>Joined Date</th>
            <th onClick={() => handleDriverSort("removedAt")}>Removed Date</th>
          </tr>
        </thead>
        <tbody>
          {sortedDriverUsers.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', color: '#888' }}>
                No removed drivers found.
              </td>
            </tr>
          ) : (
            sortedDriverUsers.map((user) => (
              <tr key={user.id} className={`removed${highlightedRowId === `driver-row-${user.userId}` ? ' highlighted' : ''}`} id={`driver-row-${user.userId}`}>
                <td>{user.userId || "-"}</td>
                <td>{user.name || "-"}</td>
                <td>{user.email || "-"}</td>
                <td>{user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "-"}</td>
                <td>{user.joinedAt ? formatDate(user.joinedAt) : "-"}</td>
                <td>{user.removedAt ? formatDate(user.removedAt) : "-"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div style={{ fontSize: '0.8em', marginTop: '0.5em', color: '#ffffff', textAlign: 'left' }}>
        Total Removed Drivers: {sortedDriverUsers.length}
      </div>
      <div style={{ fontSize: '0.9em', marginTop: '1em', color: '#000000', textAlign: 'right', fontWeight: 700 }}>
        Total Removed Users: {sortedAdminUsers.length + sortedDriverUsers.length}
      </div>
    </div>
  );
};

export default Resignated;
