import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { useLocationDisplay } from "../../contexts/LocationDisplayContext";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import "../Styles/LocationTrackingMap.css";

// Component to handle map centering
const MapController = React.forwardRef(({ driver, isLocationVisible, hasLocation }, ref) => {
  const map = useMap();
  
  const centerOnDriver = () => {
    if (driver && driver.location && driver.location.latitude && driver.location.longitude && isLocationVisible && hasLocation) {
      map.setView([driver.location.latitude, driver.location.longitude], 16);
    } else {
      map.setView([9.145, 40.4897], 6); // Reset to Ethiopia center
    }
  };
  
  const resetToEthiopia = () => {
    map.setView([9.145, 40.4897], 6);
  };
  
  // Expose the centerOnDriver function and map to parent component
  React.useImperativeHandle(ref, () => ({
    centerOnDriver,
    resetToEthiopia,
    map
  }));
  
  return null;
});

// Fix default Leaflet markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom icon for driver marker with accuracy indicator
const createCustomIcon = (color = '#28c76f', accuracy = null) => {
  const accuracyRadius = accuracy ? Math.min(Math.max(accuracy / 2, 5), 20) : 10;
  
  return L.divIcon({
    html: `<div style="
      position: relative;
      width: 20px;
      height: 20px;
    ">
      <div style="
      width: 20px;
      height: 20px;
      background: ${color};
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 12px;
        position: relative;
        z-index: 2;
      ">📍</div>
      ${accuracy ? `<div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: ${accuracyRadius * 2}px;
        height: ${accuracyRadius * 2}px;
        border: 2px solid ${color};
        border-radius: 50%;
        opacity: 0.3;
        z-index: 1;
      "></div>` : ''}
    </div>`,
    className: 'custom-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

// Animated marker for smooth transitions
const AnimatedMarker = ({ position, icon, children, duration = 800 }) => {
  const [animatedPos, setAnimatedPos] = useState(position);
  const animRef = useRef(null);
  const startRef = useRef(null);
  const fromRef = useRef(position);
  const toRef = useRef(position);

  useEffect(() => {
    if (!position || !Array.isArray(position)) return;

    if (!fromRef.current) {
      fromRef.current = position;
      setAnimatedPos(position);
      return;
    }

    if (fromRef.current[0] === position[0] && fromRef.current[1] === position[1]) {
      return;
    }

    startRef.current = null;
    const currentFrom = animatedPos || fromRef.current;
    const currentTo = position;
    fromRef.current = currentFrom;
    toRef.current = currentTo;

    const step = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const lat = currentFrom[0] + (currentTo[0] - currentFrom[0]) * eased;
      const lng = currentFrom[1] + (currentTo[1] - currentFrom[1]) * eased;
      setAnimatedPos([lat, lng]);
      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        setAnimatedPos(currentTo);
      }
    };

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(step);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [position, duration]);

  return (
    <Marker position={animatedPos} icon={icon}>
      {children}
    </Marker>
  );
};

const OneDriver = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { driverLocationStates } = useLocationDisplay();
  const { driverId, driverName, driverUserId, adminName: incomingAdminName } = location.state || {};
  
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const mapControllerRef = useRef(null);
  const [adminName, setAdminName] = useState(incomingAdminName || localStorage.getItem('userName') || "");
  const [adminUserId, setAdminUserId] = useState(localStorage.getItem('userId') || "");
  const [nearestPlace, setNearestPlace] = useState("");
  const [isDriverCentered, setIsDriverCentered] = useState(false);
  const [driverMovementState, setDriverMovementState] = useState({ isMoving: false, distance: 0, speed: 0 });
  const [driverPath, setDriverPath] = useState([]);
  const previousLocationRef = useRef(null);
  const pathHistoryRef = useRef({ points: [], lastUpdate: 0, totalDistance: 0 });

  // Function to get nearest place name
  const getNearestPlace = async (latitude, longitude) => {
    try {
      console.log("Fetching place name for:", latitude, longitude);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      console.log("Nominatim response:", data);
      
      if (data.display_name) {
        const addressParts = data.display_name.split(', ');
        const nearestPlace = addressParts.slice(0, 3).join(', '); // Take first 3 parts
        console.log("Setting nearest place:", nearestPlace);
        setNearestPlace(nearestPlace);
      } else {
        console.log("No display_name found in response");
        setNearestPlace("Location not found");
      }
    } catch (error) {
      console.error("Error fetching place name:", error);
      setNearestPlace("Location unavailable");
    }
  };

  // Format GPS coordinates for display
  const formatCoordinates = (latitude, longitude) => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  // Format accuracy for display - ensure 20m maximum
  const formatAccuracy = (accuracy) => {
    if (!accuracy) return '20m';
    const constrainedAccuracy = Math.min(Math.round(accuracy), 20);
    return `${constrainedAccuracy}m`;
  };

  // Get location timestamp
  const getLocationTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch (error) {
      return 'Unknown';
    }
  };

  // Haversine formula for calculating distance between two GPS coordinates
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in meters
  };

  // Update driver movement path for continuous tracking
  const updateDriverPath = (lat, lon, distance) => {
    const currentTime = Date.now();
    const newPoint = [lat, lon];
    
    // Initialize path if it doesn't exist
    if (pathHistoryRef.current.points.length === 0) {
      pathHistoryRef.current = {
        points: [newPoint],
        lastUpdate: currentTime,
        totalDistance: 0
      };
      setDriverPath([newPoint]);
      return;
    }
    
    // Only add point if there's significant movement (>0.1m) or time gap (>5s)
    const timeSinceLastUpdate = currentTime - pathHistoryRef.current.lastUpdate;
    if (distance >= 0.1 || timeSinceLastUpdate > 5000) {
      // Add new point to path
      const updatedPoints = [...pathHistoryRef.current.points, newPoint];
      
      // Keep only last 50 points to prevent memory issues
      const maxPoints = 50;
      const trimmedPoints = updatedPoints.length > maxPoints 
        ? updatedPoints.slice(-maxPoints) 
        : updatedPoints;
      
      // Update path history
      pathHistoryRef.current = {
        points: trimmedPoints,
        lastUpdate: currentTime,
        totalDistance: pathHistoryRef.current.totalDistance + (distance || 0)
      };
      
      // Update state for map display
      setDriverPath(trimmedPoints);
      
      console.log(`📍 Path updated for ${driverName}: ${trimmedPoints.length} points, ${pathHistoryRef.current.totalDistance.toFixed(1)}m total`);
    }
  };

  // Fetch current admin information
  useEffect(() => {
    const fetchAdminInfo = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const newAdminName = userData.name || localStorage.getItem('userName') || "Admin";
          const newAdminUserId = userData.userId || localStorage.getItem('userId') || "";
          setAdminName(newAdminName);
          setAdminUserId(newAdminUserId);
          // Store in localStorage for persistence
          localStorage.setItem('userName', newAdminName);
          localStorage.setItem('userId', newAdminUserId);
        }
      }
    };
    fetchAdminInfo();
  }, []);

  useEffect(() => {
    if (!driverId) {
      setLoading(false);
      return;
    }

    // Listen to the specific driver's document with location visibility principles
    const driverDocRef = doc(db, "driver", driverId);
    const unsubscribe = onSnapshot(driverDocRef, (doc) => {
      if (doc.exists()) {
        const driverData = { id: doc.id, ...doc.data() };
        
        // Apply location tracking working principles:
        // 1. Online Location - show location only if services enabled and online
        // 2. Offline Location - hide location if services disabled or offline
        // 3. Movement Detection - monitor location updates for online drivers
        const hasLocationServices = driverData.showLocation === true;
        const isNetworkOnline = driverData.networkStatus === 'online';
        const hasValidLocation = driverData.location && 
                              driverData.location.latitude && 
                              driverData.location.longitude;
        
        const shouldShowLocation = hasLocationServices && isNetworkOnline && hasValidLocation;
        
        const processedDriver = {
          ...driverData,
          isLocationVisible: shouldShowLocation,
          locationServicesEnabled: hasLocationServices
        };
        
        setDriver(processedDriver);
        
        // Only fetch place name if location should be visible
        if (shouldShowLocation) {
          console.log("Driver location visible, calling getNearestPlace");
          getNearestPlace(driverData.location.latitude, driverData.location.longitude);
        } else {
          console.log(`Driver location not visible - Services: ${hasLocationServices}, Online: ${isNetworkOnline}, ValidLocation: ${hasValidLocation}`);
          setNearestPlace(""); // Clear place name when location not visible
        }
      } else {
        setDriver(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to driver:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [driverId]);

  // Real-time movement detection for single driver
  useEffect(() => {
    if (!driver || !driver.isLocationVisible || !driver.location) {
      return;
    }

    const detectMovement = () => {
      const currentLat = driver.location.latitude;
      const currentLon = driver.location.longitude;
      const currentTime = driver.location.timestamp;
      
      let distance = 0;
      let speed = 0;
      
      if (previousLocationRef.current) {
        distance = calculateDistance(
          previousLocationRef.current.lat,
          previousLocationRef.current.lon,
          currentLat,
          currentLon
        );
        
        const timeDiff = currentTime ? new Date(currentTime).getTime() - previousLocationRef.current.timestamp : 0;
        speed = timeDiff > 0 ? (distance / (timeDiff / 1000)) : 0; // m/s
        
        // Detect movement with 0.1m sensitivity
        if (distance >= 0.1) {
          console.log(`🚗 Movement detected: ${driverName} moved ${distance.toFixed(2)}m at ${speed.toFixed(2)}m/s`);
          
          setDriverMovementState({
            isMoving: true,
            distance: distance,
            speed: speed,
            lastMovement: Date.now(),
            accuracy: driver.location.accuracy || 'Unknown'
          });
        } else {
          // Check if driver was previously moving but now stationary
          if (driverMovementState.isMoving && distance < 0.1) {
            console.log(`⏸️ Driver ${driverName} stopped moving (${distance.toFixed(2)}m displacement)`);
            setDriverMovementState(prev => ({
              ...prev,
              isMoving: false,
              distance: distance,
              speed: 0
            }));
          }
        }
      }
      
      // Update previous location for next comparison
      previousLocationRef.current = {
        lat: currentLat,
        lon: currentLon,
        timestamp: currentTime ? new Date(currentTime).getTime() : Date.now()
      };
      
      // Update movement path for continuous tracking
      updateDriverPath(currentLat, currentLon, distance);
    };

    // Check every 500ms for ultra-responsive real-time movement detection
    const intervalId = setInterval(detectMovement, 500);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [driver, driverMovementState, driverName]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Loading driver information...</h2>
      </div>
    );
  }

  // Use the computed visibility from driver data (follows working principles)
  const isLocationVisible = driver?.isLocationVisible || false;
  const hasLocation = driver?.location && driver.location.latitude && driver.location.longitude;

  return (
    <div className="one-driver-container" style={{ width: '100vw', height: '100vh', padding: 0, margin: 0, overflow: 'auto' }}>
      <div style={{ padding: '1rem 0 0 0', textAlign: 'center', width: '100%', height: '100%', margin: 0, maxWidth: 'none' }}>
        <div style={{
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'row',
          gap: '1rem',
        }}>
          <button
            style={{
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
            onClick={() => navigate('/admin-dashboard', { state: { name: adminName || localStorage.getItem('userName') || "User" } })}
          >
            <span style={{ fontSize: '1em', marginRight: 3 }}>&larr;</span> <span style={{ fontSize: '0.95em' }}>Back</span>
          </button>
          
          <button
            style={{
              padding: '0.18em 0.7em',
              fontSize: '0.85em',
              borderRadius: '8px',
              border: 'none',
              background: isLocationVisible 
                ? 'linear-gradient(90deg, #28c76f 0%, #20c997 100%)' 
                : 'linear-gradient(90deg, #6c757d 0%, #5a6268 100%)',
              color: '#fff',
              fontWeight: 700,
              cursor: isLocationVisible ? 'pointer' : 'not-allowed',
              boxShadow: '0 2px 8px rgba(44, 62, 80, 0.10)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
              opacity: isLocationVisible ? 1 : 0.6
            }}
            onMouseOver={e => {
              if (isLocationVisible) {
                e.currentTarget.style.background = 'linear-gradient(90deg, #20c997 0%, #28c76f 100%)';
                e.currentTarget.style.transform = 'scale(1.06)';
              }
            }}
            onMouseOut={e => {
              if (isLocationVisible) {
                e.currentTarget.style.background = 'linear-gradient(90deg, #28c76f 0%, #20c997 100%)';
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
            onClick={() => {
              if (isLocationVisible && mapControllerRef.current && mapControllerRef.current.centerOnDriver) {
                mapControllerRef.current.centerOnDriver();
                setIsDriverCentered(true);
              } else if (!isLocationVisible) {
                alert(driver?.locationServicesEnabled 
                  ? 'Cannot center on driver: Driver is offline' 
                  : 'Cannot center on driver: Location services are disabled');
              }
            }}
            disabled={!isLocationVisible}
          >
            <span style={{ fontSize: '1em', marginRight: 3 }}>📍</span> <span style={{ fontSize: '0.95em' }}>Center Driver</span>
          </button>
          
          {isDriverCentered && (
            <button
              onClick={() => {
                if (mapControllerRef.current && mapControllerRef.current.resetToEthiopia) {
                  mapControllerRef.current.resetToEthiopia();
                  setIsDriverCentered(false);
                }
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
              title="Reset map view"
            >
              ✕
            </button>
          )}
        </div>

        {/* Map Container with Driver Details Overlay */}
        <div style={{ height: 'calc(100vh - 120px)', width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e9ecef', position: 'relative' }}>
          <MapContainer
            center={[9.145, 40.4897]} // Ethiopia center
            zoom={6} // Zoom out to show more of Ethiopia
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
            attributionControl={false}
          >
            <MapController 
              ref={mapControllerRef}
              driver={driver}
              isLocationVisible={isLocationVisible}
              hasLocation={hasLocation}
            />
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {/* Movement path polyline for continuous tracking */}
            {isLocationVisible && driverPath.length > 1 && (
              <Polyline
                positions={driverPath}
                pathOptions={{
                  color: driverMovementState.isMoving ? '#28c76f' : '#6c757d',
                  weight: driverMovementState.isMoving ? 3 : 2,
                  opacity: driverMovementState.isMoving ? 0.8 : 0.6,
                  dashArray: driverMovementState.isMoving ? null : '5, 10',
                  lineCap: 'round',
                  lineJoin: 'round'
                }}
              />
            )}

            {/* Driver marker - Only show if location is visible (follows working principles) */}
            {isLocationVisible && hasLocation && (
              <AnimatedMarker
                position={[driver.location.latitude, driver.location.longitude]}
                icon={createCustomIcon(
                  driverMovementState.isMoving ? '#ff6b35' : '#28c76f', 
                  driver.location.accuracy
                )}
                duration={driverMovementState.isMoving ? 100 : 300}
              >
                <Popup>
                  <div style={{ textAlign: 'center', minWidth: '250px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1em', marginBottom: '0.5rem' }}>
                      {driverName}
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '0.5rem' }}>
                      Driver ID: {driverUserId}
                    </div>
                    <div style={{ 
                      fontSize: '0.85em', 
                      color: driverMovementState.isMoving ? '#ff6b35' : '#28c76f',
                      fontWeight: '600',
                      marginBottom: '0.5rem',
                      backgroundColor: driverMovementState.isMoving ? '#fff5f0' : '#f0f9ff',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: `1px solid ${driverMovementState.isMoving ? '#ff6b35' : '#28c76f'}`
                    }}>
                      {driverMovementState.isMoving ? (
                        `🚗 Moving at ${driverMovementState.speed.toFixed(1)}m/s`
                      ) : (
                        '📍 Real-time GPS Tracking Active'
                      )}
                    </div>
                    
                    {/* Movement Details */}
                    {driverMovementState.distance > 0 && (
                      <div style={{ 
                        fontSize: '0.8em', 
                        color: '#666',
                        marginBottom: '0.4rem',
                        backgroundColor: '#f8f9fa',
                        padding: '3px 6px',
                        borderRadius: '3px'
                      }}>
                        📏 Last movement: {driverMovementState.distance.toFixed(2)}m
                      </div>
                    )}
                    
                    {/* Path Information */}
                    {driverPath.length > 1 && (
                      <div style={{ 
                        fontSize: '0.8em', 
                        color: '#666',
                        marginBottom: '0.4rem',
                        backgroundColor: '#f8f9fa',
                        padding: '3px 6px',
                        borderRadius: '3px'
                      }}>
                        🛤️ Path points: {driverPath.length} | Total: {pathHistoryRef.current.totalDistance.toFixed(1)}m
                      </div>
                    )}
                    <div style={{ 
                      fontSize: '0.8em', 
                      color: '#333',
                      marginBottom: '0.4rem',
                      fontFamily: 'monospace',
                      backgroundColor: '#f8f9fa',
                      padding: '4px 6px',
                      borderRadius: '3px'
                    }}>
                      📍 {formatCoordinates(driver.location.latitude, driver.location.longitude)}
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#666', marginBottom: '0.4rem' }}>
                      🎯 Accuracy: {formatAccuracy(driver.location.accuracy)}
                    </div>
                    {driver.location.timestamp && (
                      <div style={{ fontSize: '0.8em', color: '#666', marginBottom: '0.4rem' }}>
                        ⏰ Updated: {getLocationTime(driver.location.timestamp)}
                      </div>
                    )}
                    {nearestPlace && (
                      <div style={{ 
                        fontSize: '0.8em', 
                        color: '#666',
                        marginTop: '0.5rem',
                        fontStyle: 'italic',
                        borderTop: '1px solid #eee',
                        paddingTop: '0.5rem'
                      }}>
                        📍 {nearestPlace}
                      </div>
                    )}
                  </div>
                </Popup>
              </AnimatedMarker>
            )}
            
            {/* Location Status Overlay - Show when location is not visible */}
            {!isLocationVisible && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: driver?.locationServicesEnabled 
                  ? 'rgba(255, 193, 7, 0.95)' 
                  : 'rgba(220, 53, 69, 0.95)',
                color: '#fff',
                padding: '20px 30px',
                borderRadius: '12px',
                fontSize: '1.1em',
                fontWeight: '600',
                zIndex: 1000,
                boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
                textAlign: 'center',
                backdropFilter: 'blur(8px)',
                border: '2px solid rgba(255,255,255,0.2)'
              }}>
                <div style={{ fontSize: '2em', marginBottom: '10px' }}>
                  {driver?.locationServicesEnabled ? '⚠️' : '🚫'}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  {driver?.locationServicesEnabled 
                    ? 'Location Services Enabled' 
                    : 'Location Services Disabled'}
                </div>
                <div style={{ fontSize: '0.9em', opacity: 0.9 }}>
                  {driver?.locationServicesEnabled 
                    ? 'Driver is offline - No location available' 
                    : 'Driver location tracking is turned off'}
                </div>
              </div>
            )}
          </MapContainer>
          
          {/* Driver Details Overlay - Top Right Corner */}
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: '#1e3a8a',
            color: '#fff',
            padding: '1rem',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            minWidth: '220px',
            fontSize: '0.9em',
            fontWeight: 500,
            textAlign: 'left',
          }}>
            <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#fff', minWidth: '80px' }}>Driver Name:</span>
              <span style={{ color: '#fff', marginLeft: 4 }}>{driverName}</span>
            </div>
            <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#fff', minWidth: '70px' }}>Driver ID:</span>
              <span style={{ color: '#fff', marginLeft: 4 }}>{driverUserId}</span>
            </div>
            <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#fff', minWidth: '80px' }}>Network Status:</span>
              <span style={{ color: driver?.networkStatus === 'online' ? '#28c76f' : '#fca5a5', marginLeft: 4 }}>
                {driver?.networkStatus ? driver.networkStatus : 'Unknown'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#fff', minWidth: '80px' }}>GPS Services:</span>
              <span style={{ 
                color: driver?.locationServicesEnabled ? '#28c76f' : '#fca5a5', 
                marginLeft: 4,
                fontSize: '0.85em'
              }}>
                {driver?.locationServicesEnabled ? '📍 Enabled' : '🚫 Disabled'}
              </span>
            </div>
            <div style={{ 
              marginTop: '0.5rem', 
              padding: '0.5rem', 
              borderRadius: '4px',
              background: isLocationVisible ? 'rgba(40, 199, 111, 0.2)' : 'rgba(220, 53, 69, 0.2)',
              border: `1px solid ${isLocationVisible ? '#28c76f' : '#dc3545'}`,
              fontSize: '0.8em',
              textAlign: 'center'
            }}>
              {isLocationVisible ? '📍 Location Visible' : '🚫 Location Hidden'}
            </div>
          </div>
        </div>

        {/* Status Message */}
        {/* (Removed as per user request) */}
      </div>
    </div>
  );
};

export default OneDriver; 