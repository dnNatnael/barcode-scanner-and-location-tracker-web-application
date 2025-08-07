import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import { getDoc, doc, collection, onSnapshot, query, where, updateDoc } from "firebase/firestore";
import LocationTrackingMap from "./LocationTrackingMap";
import { useLocationDisplay } from "../../contexts/LocationDisplayContext";
import iclLogo from "../Assets/icl-logo-form.png";

const LocationTracker = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { driverLocationStates } = useLocationDisplay();
  const name = location.state?.name || localStorage.getItem('userName') || "User";
  const [userId, setUserId] = useState(localStorage.getItem('userId') || "");
  const [drivers, setDrivers] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [warningDriverId, setWarningDriverId] = useState(null); // Track which driver has warning
  const mapRef = useRef(null); // Add ref for map container

  // Scroll to map when a driver is selected
  useEffect(() => {
    if (selectedDriver && mapRef.current && selectedDriver.networkStatus === 'online') {
      mapRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedDriver]);

  useEffect(() => {
    const fetchUserId = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const newUserId = userData.userId || "";
          setUserId(newUserId);
          // Store in localStorage for persistence
          localStorage.setItem('userId', newUserId);
          localStorage.setItem('userName', userData.name || name);
        }
      }
    };
    fetchUserId();
  }, [name]);

  // Fetch all drivers from Firestore in real-time
  useEffect(() => {
    let unsubscribe = null;
    
    try {
      const driverCol = collection(db, "driver");
      unsubscribe = onSnapshot(
        driverCol, 
        (snapshot) => {
          try {
            const driverList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            
            // Check for drivers who should be marked offline (no heartbeat for 60 seconds)
            const now = new Date();
            const updatedDriverList = driverList.map(driver => {
              if (driver.lastActive) {
                const lastActiveTime = driver.lastActive.toDate ? driver.lastActive.toDate() : new Date(driver.lastActive);
                const timeSinceLastActive = now.getTime() - lastActiveTime.getTime();
                
                // If driver hasn't been active for 60 seconds and is currently online, mark them offline
                if (timeSinceLastActive > 60000 && driver.networkStatus === 'online') {
                  console.log(`Driver ${driver.name} (${driver.userId}) has been inactive for ${Math.round(timeSinceLastActive/1000)}s, marking offline`);
                  
                  // Update the driver to offline status
                  updateDoc(doc(db, 'driver', driver.id), {
                    networkStatus: 'offline',
                    showLocation: false,
                    online: false
                  }).catch(err => {
                    console.error("Error marking driver offline:", err);
                  });
                  
                  // Return updated driver data
                  return {
                    ...driver,
                    networkStatus: 'offline',
                    showLocation: false,
                    online: false
                  };
                }
              }
              return driver;
            });
            
            setDrivers(updatedDriverList);
            // Store in localStorage for persistence
            localStorage.setItem('drivers', JSON.stringify(updatedDriverList));
          } catch (error) {
            console.error("Error processing driver data:", error);
            // Fallback to localStorage if Firebase fails
            const storedDrivers = localStorage.getItem('drivers');
            if (storedDrivers) {
              setDrivers(JSON.parse(storedDrivers));
            }
          }
        }, 
        (error) => {
          console.error("Error fetching drivers:", error);
          // Fallback to localStorage if Firebase fails
          const storedDrivers = localStorage.getItem('drivers');
          if (storedDrivers) {
            setDrivers(JSON.parse(storedDrivers));
          }
        }
      );
      
      // Load initial data from localStorage if available
      const storedDrivers = localStorage.getItem('drivers');
      if (storedDrivers && drivers.length === 0) {
        setDrivers(JSON.parse(storedDrivers));
      }
    } catch (error) {
      console.error("Error setting up driver listener:", error);
      // Fallback to localStorage if setup fails
      const storedDrivers = localStorage.getItem('drivers');
      if (storedDrivers) {
        setDrivers(JSON.parse(storedDrivers));
      }
    }
    
    return () => {
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (error) {
          console.error("Error unsubscribing from driver listener:", error);
        }
      }
    };
  }, []);

  // Periodic check for inactive drivers
  useEffect(() => {
    const checkInactiveDrivers = () => {
      const now = new Date();
      drivers.forEach(driver => {
        if (driver.lastActive && driver.networkStatus === 'online') {
          const lastActiveTime = driver.lastActive.toDate ? driver.lastActive.toDate() : new Date(driver.lastActive);
          const timeSinceLastActive = now.getTime() - lastActiveTime.getTime();
          
          // If driver hasn't been active for 60 seconds, mark them offline
          if (timeSinceLastActive > 60000) {
            console.log(`Marking driver ${driver.name} (${driver.userId}) offline due to inactivity`);
            
            updateDoc(doc(db, 'driver', driver.id), {
              networkStatus: 'offline',
              showLocation: false,
              online: false
            }).catch(err => {
              console.error("Error marking driver offline:", err);
            });
          }
        }
      });
    };

    // Check every 10 seconds
    const intervalId = setInterval(checkInactiveDrivers, 10000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [drivers]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Handle page unload to preserve data
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Ensure current data is saved before page unload
      if (drivers.length > 0) {
        localStorage.setItem('drivers', JSON.stringify(drivers));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [drivers]);

  const handleSample = (driver) => {
    // Placeholder for sample collection logic
    alert(`Sample collection for ${driver.name}`);
  };

  const handleDriverRowClick = (driver) => {
    if (selectedDriver && selectedDriver.id === driver.id) {
      // If the same driver is clicked, deselect it
      setSelectedDriver(null);
      localStorage.removeItem('selectedDriver');
      setWarningDriverId(null); // Clear warning when deselecting
    } else {
      // If a different driver is clicked, select it
      setSelectedDriver(driver);
      localStorage.setItem('selectedDriver', JSON.stringify(driver));
      
      // Show warning for offline drivers
      if (driver.networkStatus !== 'online') {
        setWarningDriverId(driver.id);
        // Auto-hide warning after 5 seconds
        setTimeout(() => {
          setWarningDriverId(null);
        }, 5000);
      } else {
        setWarningDriverId(null); // Clear warning for online drivers
      }
    }
  };


  return (
    <div className="location-tracker-container" style={{ width: '100vw', height: '100vh', padding: 0, margin: 0, overflow: 'auto' }}>
      <div style={{ padding: '1rem 0 0 0', textAlign: 'center', width: '100%', height: '100%', margin: 0, maxWidth: 'none' }}>
        {/* Header with Logo, Welcome Text in Middle, and Buttons */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '0 20px 10px 20px',
          marginBottom: '10px'
        }}>
          <img 
            src={iclLogo} 
            alt="ICL Logo" 
            style={{ 
              height: '80px', 
              objectFit: 'contain'
            }} 
          />
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0.2em 0' }}>Welcome {name}!</p>
            {userId && <p style={{ margin: '0.2em 0' }}>Your ID: {userId}</p>}
            <p style={{ margin: '0.2em 0' }}>Here you can track all locations.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              style={{
                padding: '0.5em 1.2em',
                background: '#1c6954',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: '0.9em',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'all 0.2s',
              }}
              onClick={() => navigate('/drivers-list')}
            >
              Driver
            </button>
            <button
              className="samples-btn-custom"
              style={{
                padding: '0.5em 1.2em',
                borderRadius: 6,
                fontSize: '0.9em',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={() => navigate('/samples')}
            >
              Sample
            </button>
          </div>
        </div>
        
        {/* Location Tracking Map */}
        <div ref={mapRef} style={{ marginBottom: '1rem', marginTop: '-15px', position: 'relative' }}>
          {/* Offline Driver Message */}
          {selectedDriver && selectedDriver.networkStatus !== 'online' && (
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(255, 193, 7, 0.9)',
              color: '#856404',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '0.9em',
              fontWeight: '600',
              zIndex: 1001,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              backdropFilter: 'blur(4px)'
            }}>
              ⚠️ {selectedDriver.name} is offline - No location available
            </div>
          )}
          <LocationTrackingMap 
            drivers={drivers} 
            selectedDriver={selectedDriver}
          />
          {/* Fullscreen Button - Only show when NOT in fullscreen */}
          {!isFullscreen && (
            <button
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                padding: '0.5em',
                background: 'rgba(0, 0, 0, 0.7)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1.1em',
                fontWeight: 600,
                cursor: 'pointer',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                transition: 'all 0.2s',
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.9)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.7)';
              }}
              onClick={() => {
                const mapContainer = document.querySelector('.leaflet-container');
                if (mapContainer) {
                  mapContainer.requestFullscreen();
                }
              }}
            >
              ⛶
            </button>
          )}
          {/* Minimize Button - Only show when IN fullscreen */}
          {isFullscreen && (
            <button
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                padding: '0.5em',
                background: 'rgba(255, 0, 0, 0.8)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1.1em',
                fontWeight: 600,
                cursor: 'pointer',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(255, 0, 0, 0.3)',
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = 'rgba(255, 0, 0, 0.9)';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = 'rgba(255, 0, 0, 0.8)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onClick={() => {
                document.exitFullscreen();
              }}
            >
              ⊖
            </button>
          )}
        </div>
        
      {/* Drivers Table */}
        <div style={{ fontWeight: 700, fontSize: '1.15em', margin: '1em 0 0.5em 0', textAlign: 'left', color: '#ffffff', letterSpacing: '0.2px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {selectedDriver ? (
            <>
              <span>
                Drivers (🎯 {selectedDriver.name} selected)
              </span>
              <button
                onClick={() => {
                  setSelectedDriver(null);
                  localStorage.removeItem('selectedDriver');
                }}
                style={{
                  background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 3px 8px rgba(220, 53, 69, 0.3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  minWidth: '60px',
                  height: '28px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #c82333 0%, #bd2130 100%)';
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 5px 15px rgba(220, 53, 69, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 3px 8px rgba(220, 53, 69, 0.3)';
                }}
                title="Cancel selection"
              >
                ✕
              </button>
            </>
          ) : (
            <span>Drivers</span>
          )}
        </div>
      <div style={{ overflowX: 'auto', margin: '0 auto', maxWidth: '100%' }}>
        <table className="it-users-table">
          <thead>
            <tr>
              <th>Network Status</th>
              <th>Driver ID</th>
              <th>Name</th>
              <th>Sample</th>
              <th>Track</th>
            </tr>
          </thead>
          <tbody>
            {drivers.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: '1.5em', color: '#888' }}>No drivers found.</td></tr>
            ) : (
              drivers.map(driver => {
                // Use networkStatus from database (set by Start/Finished buttons)
                const isOnline = driver.networkStatus === 'online';
                return (
                  <tr 
                    key={driver.id} 
                    style={{ 
                      borderBottom: '1px solid #f0f0f0',
                      backgroundColor: selectedDriver?.id === driver.id ? '#e8f5e8' : 'transparent',
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    <td 
                      style={{ 
                        cursor: 'pointer',
                        padding: '0.5em',
                        transition: 'background-color 0.2s ease',
                        position: 'relative'
                      }}
                      onClick={() => handleDriverRowClick(driver)}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8f9fa';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {/* Warning message for offline drivers */}
                      {warningDriverId === driver.id && !isOnline && (
                        <div style={{
                          position: 'absolute',
                          top: '-15px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: '#fff3cd',
                          color: '#856404',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.8em',
                          fontWeight: 'bold',
                          border: '1px solid #ffeaa7',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                          zIndex: 1000,
                          whiteSpace: 'nowrap',
                          animation: 'fadeInOut 5s ease-in-out'
                        }}>
                          ⚠️ {driver.name} is offline - No location available
                        </div>
                      )}
                      {isOnline ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#1c6954', fontWeight: 600 }}>
                          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#28c76f', marginRight: 2, border: '1.5px solid #1c6954' }}></span>
                          Online
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#b71c1c', fontWeight: 600 }}>
                          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#fa1d1d', marginRight: 2, border: '1.5px solid #b71c1c' }}></span>
                          Offline
                        </span>
                      )}
                    </td>
                    <td>{driver.userId || '-'}</td>
                    <td>
                      {driver.name || '-'}
                      {selectedDriver?.id === driver.id && (
                        <span style={{ 
                          marginLeft: '8px', 
                          fontSize: '0.8em', 
                          color: '#ff6b35',
                          fontWeight: '600'
                        }}>
                          🎯 Selected
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        style={{ padding: '0.4em 1.1em', background: '#457b9d', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.98em' }}
                        onClick={() => navigate('/driver-view', { state: { driverId: driver.userId, driverName: driver.name, isAdminAccess: true } })}
                      >
                        Sample
                      </button>
                    </td>
                    <td>
                      <button
                          style={{ padding: '0.4em 1.1em', background: '#28c76f', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.98em' }}
                          onClick={() => navigate('/one-driver', { state: { driverId: driver.id, driverName: driver.name, driverUserId: driver.userId, adminName: name } })}
                      >
                        Track
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {/* Responsive styles */}
      <style>{`
        @media (max-width: 600px) {
          div[style*='padding: 2rem'] { padding: 0.7rem !important; }
          table { font-size: 0.93em; }
          th, td { padding: 0.5em 0.2em !important; }
          button { font-size: 0.95em !important; }
        }
        .samples-btn-custom {
          background: #fff !important;
          color: #457b9d !important;
          border: 2px solid #457b9d !important;
          box-shadow: 0 1px 4px rgba(69,123,157,0.08) !important;
          font-weight: 700 !important;
          transition: all 0.2s !important;
        }
        .samples-btn-custom:hover {
          background: #457b9d !important;
          color: #fff !important;
          border-color: #457b9d !important;
        }
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          10% { opacity: 1; transform: translateX(-50%) translateY(0); }
          80% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        }
      `}</style>
      </div>
    </div>
  );
};

export default LocationTracker;
