import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { useLocationDisplay } from "../../contexts/LocationDisplayContext";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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

// Custom icon for driver marker
const createCustomIcon = (color = '#28c76f') => {
  return L.divIcon({
    html: `<div style="
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
    ">📍</div>`,
    className: 'custom-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
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
        // Extract the most relevant part of the address
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

    // Listen to the specific driver's document
    const driverDocRef = doc(db, "driver", driverId);
    const unsubscribe = onSnapshot(driverDocRef, (doc) => {
      if (doc.exists()) {
        const driverData = { id: doc.id, ...doc.data() };
        setDriver(driverData);
        
        // Get nearest place name when location changes
        if (driverData.location && driverData.location.latitude && driverData.location.longitude) {
          console.log("Driver location found, calling getNearestPlace");
          getNearestPlace(driverData.location.latitude, driverData.location.longitude);
        } else {
          console.log("No driver location found");
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

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Loading driver information...</h2>
      </div>
    );
  }

  if (!driver) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Driver not found</h2>
        <button
          style={{
            padding: '0.7em 2em',
            background: '#1c6954',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: '1.1em',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: '1rem'
          }}
          onClick={() => navigate('/admin-dashboard', { state: { name: adminName || localStorage.getItem('userName') || "User" } })}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const isLocationVisible = driverLocationStates[driver.id]?.showLocation;
  const hasLocation = driver.location && driver.location.latitude && driver.location.longitude;

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
              background: 'linear-gradient(90deg, #28c76f 0%, #20c997 100%)',
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
              e.currentTarget.style.background = 'linear-gradient(90deg, #20c997 0%, #28c76f 100%)';
              e.currentTarget.style.transform = 'scale(1.06)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'linear-gradient(90deg, #28c76f 0%, #20c997 100%)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onClick={() => {
              if (mapControllerRef.current && mapControllerRef.current.centerOnDriver) {
                mapControllerRef.current.centerOnDriver();
                setIsDriverCentered(true);
              }
            }}
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
            
            {/* Driver marker - Only show if location is visible and available */}
            {isLocationVisible && hasLocation && (
              <Marker
                position={[driver.location.latitude, driver.location.longitude]}
                icon={createCustomIcon('#28c76f')}
              >
                <Popup>
                  <div style={{ textAlign: 'center', minWidth: '200px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1em', marginBottom: '0.5rem' }}>
                      {driverName}
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '0.5rem' }}>
                      Driver ID: {driverUserId}
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '0.5rem' }}>
                      Location: {driver.location.latitude.toFixed(4)}, {driver.location.longitude.toFixed(4)}
                    </div>
                    <div style={{ 
                      fontSize: '0.8em', 
                      color: '#28c76f',
                      fontWeight: '600',
                      marginTop: '4px'
                    }}>
                      📍 Location Tracking Active
                    </div>
                    {nearestPlace && (
                      <div style={{ 
                        fontSize: '0.8em', 
                        color: '#666',
                        marginTop: '4px',
                        fontStyle: 'italic'
                      }}>
                        📍 {nearestPlace}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
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
            minWidth: '200px',
            fontSize: '0.9em',
            fontWeight: 500,
            textAlign: 'left',
          }}>
            <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#fff', minWidth: '70px' }}>Driver Name:</span>
              <span style={{ color: '#fff', marginLeft: 4 }}>{driverName}</span>
            </div>
            <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#fff', minWidth: '60px' }}>Driver ID:</span>
              <span style={{ color: '#fff', marginLeft: 4 }}>{driverUserId}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#fff', minWidth: '70px' }}>Network Status:</span>
              <span style={{ color: driver.networkStatus === 'online' ? '#28c76f' : '#fca5a5', marginLeft: 4 }}>
                {driver.networkStatus ? driver.networkStatus : 'Unknown'}
              </span>
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