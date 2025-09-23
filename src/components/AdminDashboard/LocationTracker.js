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
  const [driverMovementStates, setDriverMovementStates] = useState({}); // Track driver movement states
  const previousLocationsRef = useRef({}); // Store previous locations for comparison
  const [driverAddresses, setDriverAddresses] = useState({}); // Store detailed addresses for each driver
  const addressCacheRef = useRef({}); // Cache addresses to avoid repeated API calls
  const [driverPaths, setDriverPaths] = useState({}); // Store movement paths for each driver
  const pathHistoryRef = useRef({}); // Store path history for continuous tracking

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

  // Fetch all drivers from Firestore in real-time with location-based visibility
  useEffect(() => {
    let unsubscribe = null;
    
    try {
      const driverCol = collection(db, "driver");
      unsubscribe = onSnapshot(
        driverCol, 
        (snapshot) => {
          try {
            const driverList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            
            // Apply location tracking working principles:
            // 1. Online Location - drivers with location services enabled show on map
            // 2. Offline Location - drivers with disabled location services hidden from map
            // 3. Movement Detection - continuous updates for online drivers
            const processedDriverList = driverList.map(driver => {
              // Determine if driver should be visible based on location services and network status
              const hasLocationServices = driver.showLocation === true;
              const isNetworkOnline = driver.networkStatus === 'online';
              const hasValidLocation = driver.location && 
                                    driver.location.latitude && 
                                    driver.location.longitude;
              
              // Working Principle 1 & 2: Show location only if services enabled AND online
              const shouldShowOnMap = hasLocationServices && isNetworkOnline && hasValidLocation;
              
              console.log(`Driver ${driver.name}: Location Services=${hasLocationServices}, Network=${isNetworkOnline}, ValidLocation=${hasValidLocation}, ShowOnMap=${shouldShowOnMap}`);
              
              return {
                ...driver,
                // Add computed visibility flag for map display
                isLocationVisible: shouldShowOnMap,
                locationServicesEnabled: hasLocationServices
              };
            });
            
            setDrivers(processedDriverList);
            // Store in localStorage for persistence
            localStorage.setItem('drivers', JSON.stringify(processedDriverList));
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

  // High-Precision Movement Detection System - Enhanced Working Principle 3
  // Detect and update driver movements in real-time with 0.5m sensitivity
  useEffect(() => {
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      // Haversine formula for calculating distance between two GPS coordinates
      const R = 6371000; // Earth's radius in meters
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c; // Distance in meters
    };

    const detectMovement = () => {
      const movementUpdates = {};
      
      drivers.forEach(driver => {
        // Only monitor drivers with location services enabled and online status
        if (driver.locationServicesEnabled && driver.networkStatus === 'online' && driver.location) {
          const currentLat = driver.location.latitude;
          const currentLon = driver.location.longitude;
          const currentTime = driver.location.timestamp;
          const driverId = driver.id;
          
          // Get previous location for comparison
          const previousLocation = previousLocationsRef.current[driverId];
          let distance = 0; // Initialize distance variable
          
          if (previousLocation) {
            distance = calculateDistance(
              previousLocation.lat, 
              previousLocation.lon, 
              currentLat, 
              currentLon
            );
            
            const timeDiff = currentTime ? new Date(currentTime).getTime() - previousLocation.timestamp : 0;
            const speed = timeDiff > 0 ? (distance / (timeDiff / 1000)) : 0; // m/s
            
            // Detect movement with 0.1m sensitivity
            if (distance >= 0.1) {
              console.log(`🚗 Movement detected: ${driver.name} moved ${distance.toFixed(2)}m at ${speed.toFixed(2)}m/s`);
              
              movementUpdates[driverId] = {
                isMoving: true,
                distance: distance,
                speed: speed,
                lastMovement: Date.now(),
                accuracy: driver.location.accuracy || 'Unknown'
              };
            } else {
              // Check if driver was previously moving but now stationary
              const wasMoving = driverMovementStates[driverId]?.isMoving;
              if (wasMoving && distance < 0.1) {
                console.log(`⏸️ Driver ${driver.name} stopped moving (${distance.toFixed(2)}m displacement)`);
                movementUpdates[driverId] = {
                  isMoving: false,
                  distance: distance,
                  speed: 0,
                  lastMovement: driverMovementStates[driverId]?.lastMovement || Date.now(),
                  accuracy: driver.location.accuracy || 'Unknown'
                };
              }
            }
          }
          
          // Update previous location for next comparison
          previousLocationsRef.current[driverId] = {
            lat: currentLat,
            lon: currentLon,
            timestamp: currentTime ? new Date(currentTime).getTime() : Date.now()
          };
          
          // Update movement path for continuous tracking
          updateDriverPath(driverId, currentLat, currentLon, distance);
          
          // Fetch detailed address if location changed significantly (>5m) or not cached
          const cacheKey = `${currentLat.toFixed(5)}_${currentLon.toFixed(5)}`;
          if (distance >= 5 || !addressCacheRef.current[cacheKey]) {
            fetchDetailedAddress(driverId, currentLat, currentLon, cacheKey);
          }
          
          // Check location data freshness (within last 10 seconds for real-time)
          const now = Date.now();
          const lastUpdate = currentTime ? new Date(currentTime).getTime() : 0;
          const timeSinceUpdate = now - lastUpdate;
          
          if (timeSinceUpdate > 10000) { // 10 seconds for real-time tracking
            console.log(`⚠️ Real-time tracking: Driver ${driver.name} location may be stale (${Math.round(timeSinceUpdate/1000)}s ago)`);
          }
        }
      });
      
      // Update movement states if there are changes
      if (Object.keys(movementUpdates).length > 0) {
        setDriverMovementStates(prev => ({
          ...prev,
          ...movementUpdates
        }));
      }
    };

    // Update driver movement path for continuous tracking
    const updateDriverPath = (driverId, lat, lon, distance) => {
      const currentTime = Date.now();
      const newPoint = [lat, lon];
      
      // Initialize path if it doesn't exist
      if (!pathHistoryRef.current[driverId]) {
        pathHistoryRef.current[driverId] = {
          points: [newPoint],
          lastUpdate: currentTime,
          totalDistance: 0
        };
        setDriverPaths(prev => ({
          ...prev,
          [driverId]: [newPoint]
        }));
        return;
      }
      
      const pathHistory = pathHistoryRef.current[driverId];
      
      // Only add point if there's significant movement (>0.1m) or time gap (>5s)
      const timeSinceLastUpdate = currentTime - pathHistory.lastUpdate;
      if (distance >= 0.1 || timeSinceLastUpdate > 5000) {
        // Add new point to path
        const updatedPoints = [...pathHistory.points, newPoint];
        
        // Keep only last 50 points to prevent memory issues
        const maxPoints = 50;
        const trimmedPoints = updatedPoints.length > maxPoints 
          ? updatedPoints.slice(-maxPoints) 
          : updatedPoints;
        
        // Update path history
        pathHistoryRef.current[driverId] = {
          points: trimmedPoints,
          lastUpdate: currentTime,
          totalDistance: pathHistory.totalDistance + (distance || 0)
        };
        
        // Update state for map display
        setDriverPaths(prev => ({
          ...prev,
          [driverId]: trimmedPoints
        }));
        
        console.log(`📍 Path updated for ${drivers.find(d => d.id === driverId)?.name}: ${trimmedPoints.length} points, ${pathHistory.totalDistance.toFixed(1)}m total`);
      }
    };

    // Enhanced address fetching function
    const fetchDetailedAddress = async (driverId, lat, lon, cacheKey) => {
      try {
        // Check cache first
        if (addressCacheRef.current[cacheKey]) {
          setDriverAddresses(prev => ({
            ...prev,
            [driverId]: addressCacheRef.current[cacheKey]
          }));
          return;
        }
        
        // Fetch from Nominatim with detailed address components
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&extratags=1`
        );
        const data = await response.json();
        
        if (data && data.address) {
          const address = data.address;
          const detailedAddress = {
            fullAddress: data.display_name || 'Address not found',
            street: address.road || address.street || address.pedestrian || address.path || '',
            houseNumber: address.house_number || '',
            neighborhood: address.neighbourhood || address.suburb || address.quarter || '',
            city: address.city || address.town || address.village || address.municipality || '',
            state: address.state || address.province || address.region || '',
            country: address.country || '',
            postcode: address.postcode || '',
            coordinates: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
            formattedAddress: ''
          };
          
          // Create formatted address string
          let formatted = [];
          if (detailedAddress.houseNumber && detailedAddress.street) {
            formatted.push(`${detailedAddress.houseNumber} ${detailedAddress.street}`);
          } else if (detailedAddress.street) {
            formatted.push(detailedAddress.street);
          }
          
          if (detailedAddress.neighborhood && detailedAddress.neighborhood !== detailedAddress.city) {
            formatted.push(detailedAddress.neighborhood);
          }
          
          if (detailedAddress.city) {
            formatted.push(detailedAddress.city);
          }
          
          if (detailedAddress.state && detailedAddress.state !== detailedAddress.city) {
            formatted.push(detailedAddress.state);
          }
          
          detailedAddress.formattedAddress = formatted.join(', ') || detailedAddress.fullAddress;
          
          // Cache the result
          addressCacheRef.current[cacheKey] = detailedAddress;
          
          // Update state
          setDriverAddresses(prev => ({
            ...prev,
            [driverId]: detailedAddress
          }));
          
          console.log(`📍 Address updated for ${drivers.find(d => d.id === driverId)?.name}: ${detailedAddress.formattedAddress}`);
        }
      } catch (error) {
        console.error('Error fetching detailed address:', error);
        // Fallback address
        const fallbackAddress = {
          fullAddress: 'Location services available',
          formattedAddress: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          coordinates: `${lat.toFixed(6)}, ${lon.toFixed(6)}`
        };
        setDriverAddresses(prev => ({
          ...prev,
          [driverId]: fallbackAddress
        }));
      }
    };
    
    // Check every 500ms for ultra-responsive real-time movement detection
    const intervalId = setInterval(detectMovement, 500);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [drivers, driverMovementStates]);

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
        <div className="header-container" style={{ 
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
          {/* Location Services Status Messages */}
          {selectedDriver && (
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: selectedDriver.isLocationVisible 
                ? 'rgba(40, 199, 111, 0.9)' 
                : selectedDriver.locationServicesEnabled 
                  ? 'rgba(255, 193, 7, 0.9)' 
                  : 'rgba(220, 53, 69, 0.9)',
              color: selectedDriver.isLocationVisible 
                ? '#fff' 
                : selectedDriver.locationServicesEnabled 
                  ? '#856404' 
                  : '#fff',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '0.9em',
              fontWeight: '600',
              zIndex: 1001,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              backdropFilter: 'blur(4px)'
            }}>
              {selectedDriver.isLocationVisible 
                ? `📍 ${selectedDriver.name} - Real-time location tracking active` 
                : selectedDriver.locationServicesEnabled 
                  ? `⚠️ ${selectedDriver.name} - Location services enabled but offline` 
                  : `🚫 ${selectedDriver.name} - Location services disabled`}
            </div>
          )}
          <LocationTrackingMap 
            drivers={drivers.filter(driver => driver.isLocationVisible).map(driver => ({
              ...driver,
              movementState: driverMovementStates[driver.id] || { isMoving: false, distance: 0, speed: 0 },
              detailedAddress: driverAddresses[driver.id] || null,
              movementPath: driverPaths[driver.id] || []
            }))}
            selectedDriver={selectedDriver && selectedDriver.isLocationVisible ? {
              ...selectedDriver,
              movementState: driverMovementStates[selectedDriver.id] || { isMoving: false, distance: 0, speed: 0 },
              detailedAddress: driverAddresses[selectedDriver.id] || null,
              movementPath: driverPaths[selectedDriver.id] || []
            } : null}
            driverPaths={driverPaths}
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
        <div style={{ fontWeight: 700, fontSize: '1.15em', margin: '1em 0 0.5em 0', textAlign: 'left', color: '#ffffff', letterSpacing: '0.2px', display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between', paddingRight: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
          
          {/* Logout Button */}
          <button
            onClick={() => navigate('/login')}
            style={{
              backgroundColor: '#e0f2fe',
              color: '#0277bd',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              transition: 'all 300ms ease-in-out',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              transform: 'scale(1)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#b3e5fc';
              e.currentTarget.style.color = '#01579b';
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#e0f2fe';
              e.currentTarget.style.color = '#0277bd';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.backgroundColor = '#81d4fa';
              e.currentTarget.style.transform = 'scale(0.95)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.backgroundColor = '#b3e5fc';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            title="Log out and return to login page"
          >
            <svg 
              style={{
                width: '1rem',
                height: '1rem',
                stroke: 'currentColor',
                fill: 'none',
                strokeWidth: '2'
              }}
              viewBox="0 0 24 24"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16,17 21,12 16,7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Log Out
          </button>
        </div>
      <div style={{ width: '100%', maxWidth: '100%', margin: '0 auto', padding: '0' }}>
        <div className="table-container" style={{ margin: '0', padding: '0' }}>
          <table className="excel-table">
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
                  <tr key={driver.id}>
                    <td 
                      style={{ 
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                      onClick={() => handleDriverRowClick(driver)}
                    >
                      {/* Warning message for location service issues */}
                      {warningDriverId === driver.id && !driver.isLocationVisible && (
                        <div style={{
                          position: 'absolute',
                          top: '-15px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: driver.locationServicesEnabled ? '#fff3cd' : '#f8d7da',
                          color: driver.locationServicesEnabled ? '#856404' : '#721c24',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.8em',
                          fontWeight: 'bold',
                          border: driver.locationServicesEnabled ? '1px solid #ffeaa7' : '1px solid #f5c6cb',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                          zIndex: 1000,
                          whiteSpace: 'nowrap',
                          animation: 'fadeInOut 5s ease-in-out'
                        }}>
                          {driver.locationServicesEnabled 
                            ? `⚠️ ${driver.name} - Location services enabled but offline` 
                            : `🚫 ${driver.name} - Location services disabled`}
                        </div>
                      )}
                      
                      {/* Location Services & Network Status Display */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        {/* Network Status */}
                        {isOnline ? (
                          <span className="status-online" style={{ fontSize: '0.85em' }}>
                            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#28c76f', marginRight: 2, border: '1.5px solid #1c6954' }}></span>
                            Online
                          </span>
                        ) : (
                          <span className="status-offline" style={{ fontSize: '0.85em' }}>
                            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#fa1d1d', marginRight: 2, border: '1.5px solid #b71c1c' }}></span>
                            Offline
                          </span>
                        )}
                        
                        {/* Location Services Status */}
                        <span style={{ 
                          fontSize: '0.75em', 
                          color: driver.locationServicesEnabled ? '#28c76f' : '#fa1d1d',
                          fontWeight: '600'
                        }}>
                          {driver.locationServicesEnabled ? '📍 GPS On' : '🚫 GPS Off'}
                        </span>
                        
                        {/* Movement Status - Show for visible drivers */}
                        {driver.isLocationVisible && driverMovementStates[driver.id] && (
                          <span style={{ 
                            fontSize: '0.7em', 
                            color: driverMovementStates[driver.id].isMoving ? '#ff6b35' : '#6c757d',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            {driverMovementStates[driver.id].isMoving ? (
                              <>
                                🚗 Moving
                                <span style={{ fontSize: '0.9em', marginLeft: '2px' }}>
                                  {driverMovementStates[driver.id].speed.toFixed(1)}m/s
                                </span>
                              </>
                            ) : (
                              '⏸️ Stationary'
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{driver.userId || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div>
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
                        </div>
                        {/* Real-time address display */}
                        {driver.isLocationVisible && driverAddresses[driver.id] && (
                          <div style={{
                            fontSize: '0.7em',
                            color: '#666',
                            fontStyle: 'italic',
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            📍 {driverAddresses[driver.id].formattedAddress}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        className="btn sample-btn"
                        onClick={() => navigate('/admin-view', { state: { driverId: driver.userId, driverName: driver.name } })}
                      >
                        Sample
                      </button>
                    </td>
                    <td>
                      <button
                        className="btn track-btn"
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
      </div>
      {/* Responsive styles */}
      <style>{`
        /* Mobile and Tablet Responsive Design - Match Desktop Layout */
        @media (max-width: 1024px) {
          .location-tracker-container {
            width: 100vw !important;
            height: 100vh !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: auto !important;
          }
          
          /* Header Layout - Center aligned for Mobile/Tablet */
          .header-container {
            flex-direction: column !important;
            align-items: center !important;
            padding: 15px !important;
            margin-bottom: 15px !important;
            gap: 10px !important;
            justify-content: center !important;
          }
          
          /* Logo and Text Row - Centered */
          .header-container > img[alt="ICL Logo"] {
            height: 50px !important;
            min-height: 50px !important;
            align-self: center !important;
          }
          
          /* Welcome Text - Centered below logo */
          .header-container > div[style*='textAlign: center'] {
            text-align: center !important;
            margin: 0 !important;
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
          }
          
          .header-container > div[style*='textAlign: center'] p {
            margin: 0.05em 0 !important;
            font-size: 0.8em !important;
            line-height: 1.2 !important;
            text-align: center !important;
          }
          
          /* Button Container - Centered below */
          .header-container > div[style*='display: flex'][style*='gap: 0.5rem'] {
            flex-direction: row !important;
            gap: 0.4rem !important;
            align-self: center !important;
            margin-top: 5px !important;
          }
          
          /* Header Buttons */
          div[style*='display: flex'][style*='gap: 0.5rem'] button {
            padding: 0.4em 0.8em !important;
            font-size: 0.8em !important;
            white-space: nowrap !important;
          }
          
          /* Drivers Title Section */
          div[style*='justifyContent: space-between'][style*='paddingRight: 20px'] {
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: center !important;
            padding-right: 15px !important;
            flex-wrap: nowrap !important;
          }
          
          /* Drivers Title Text */
          div[style*='justifyContent: space-between'] > div:first-child {
            flex: 1 !important;
            text-align: left !important;
          }
          
          /* Logout Button in Drivers Section */
          div[style*='justifyContent: space-between'] button {
            flex-shrink: 0 !important;
            padding: 0.6rem 1.2rem !important;
            font-size: 0.9rem !important;
          }
          
          /* Table Container */
          .table-container {
            margin: 0 !important;
            padding: 0 !important;
            overflow-x: auto !important;
          }
          
          /* Table Styling */
          .excel-table {
            width: 100% !important;
            min-width: 600px !important;
            font-size: 0.85em !important;
          }
          
          .excel-table th,
          .excel-table td {
            padding: 0.6em 0.4em !important;
            white-space: nowrap !important;
          }
          
          /* Table Buttons */
          .excel-table button {
            font-size: 0.8em !important;
            padding: 0.4em 0.8em !important;
          }
          
          /* Map Container */
          div[style*='marginBottom: 1rem'] {
            margin: 0 15px 1rem 15px !important;
          }
        }
        
        @media (max-width: 768px) {
          /* Additional Mobile Optimizations */
          img[alt="ICL Logo"] {
            height: 50px !important;
          }
          
          div[style*='textAlign: center'] p {
            font-size: 0.8em !important;
          }
          
          .excel-table {
            min-width: 500px !important;
            font-size: 0.8em !important;
          }
          
          .excel-table th,
          .excel-table td {
            padding: 0.5em 0.3em !important;
          }
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
