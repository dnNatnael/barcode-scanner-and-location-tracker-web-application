import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../Styles/LocationTrackingMap.css';
import { useLocationDisplay } from '../../contexts/LocationDisplayContext';

// Component to handle map centering
const MapController = ({ selectedDriver }) => {
  const map = useMap();
  
  useEffect(() => {
    if (selectedDriver && selectedDriver.networkStatus === 'online' && selectedDriver.location && selectedDriver.location.latitude && selectedDriver.location.longitude) {
      // Only center on driver if they are online and have location data
      map.setView([selectedDriver.location.latitude, selectedDriver.location.longitude], 16);
    } else {
      // Reset to Ethiopia center if driver is offline or no location data
      map.setView([9.145, 40.4897], 6);
    }
  }, [selectedDriver, map]);
  
  return null;
};

// Enhanced animated marker with faster updates for real-time movement
const AnimatedMarker = ({ position, icon, children, duration = 400, isMoving = false }) => {
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

    // Use faster animation for moving drivers
    const animationDuration = isMoving ? Math.min(duration, 200) : duration;

    const step = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / animationDuration);
      // Use linear interpolation for moving drivers for smoother real-time updates
      const eased = isMoving ? t : (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
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
  }, [position, duration, isMoving]);

  return (
    <Marker position={animatedPos} icon={icon}>
      {children}
    </Marker>
  );
};

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Enhanced custom marker icon with movement indicators
const createCustomIcon = (color = '#1c6954', accuracy = null, movementState = null, detailedAddress = null) => {
  const accuracyRadius = accuracy ? Math.min(Math.max(accuracy / 2, 5), 20) : 10;
  const isMoving = movementState?.isMoving || false;
  const speed = movementState?.speed || 0;
  
  // Dynamic size based on movement - larger when moving
  const markerSize = isMoving ? 24 : 20;
  const pulseAnimation = isMoving ? 'pulse 1.5s ease-in-out infinite' : 'none';
  const movementIndicator = isMoving ? '🚗' : '📍';
  
  return L.divIcon({
    html: `
    <style>
      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.7; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes ripple {
        0% { transform: scale(0.8); opacity: 1; }
        100% { transform: scale(2.5); opacity: 0; }
      }
    </style>
    <div style="
      position: relative;
      width: ${markerSize}px;
      height: ${markerSize}px;
    ">
      ${isMoving ? `<div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: ${markerSize}px;
        height: ${markerSize}px;
        border: 2px solid ${color};
        border-radius: 50%;
        animation: ripple 2s linear infinite;
        z-index: 0;
      "></div>` : ''}
      <div style="
        width: ${markerSize}px;
        height: ${markerSize}px;
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        position: relative;
        z-index: 2;
        animation: ${pulseAnimation};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isMoving ? '10px' : '8px'};
      ">
        <span style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));">${movementIndicator}</span>
      </div>
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
      ${isMoving && speed > 0 ? `<div style="
        position: absolute;
        top: -8px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 107, 53, 0.9);
        color: white;
        padding: 1px 4px;
        border-radius: 8px;
        font-size: 8px;
        font-weight: bold;
        white-space: nowrap;
        z-index: 3;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      ">${speed.toFixed(1)}m/s</div>` : ''}
      ${movementState && movementState.detailedAddress && movementState.detailedAddress.street ? `<div style="
        position: absolute;
        bottom: -12px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 7px;
        font-weight: bold;
        white-space: nowrap;
        z-index: 3;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      ">${movementState.detailedAddress.street}</div>` : ''}
    </div>`,
    className: 'custom-marker',
    iconSize: [markerSize, markerSize],
    iconAnchor: [markerSize/2, markerSize/2],
  });
};

const LocationTrackingMap = ({ drivers = [], currentUserLocation = null, selectedDriver = null, driverPaths = {} }) => {
  const { getVisibleDrivers } = useLocationDisplay();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [driverPlaces, setDriverPlaces] = useState({});

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

  // Function to get nearest place name
  const getNearestPlace = async (driverId, latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      
      if (data.display_name) {
        const addressParts = data.display_name.split(', ');
        const nearestPlace = addressParts.slice(0, 3).join(', ');
        setDriverPlaces(prev => ({
          ...prev,
          [driverId]: nearestPlace
        }));
      } else {
        setDriverPlaces(prev => ({
          ...prev,
          [driverId]: "Location not found"
        }));
      }
    } catch (error) {
      console.error("Error fetching place name:", error);
      setDriverPlaces(prev => ({
        ...prev,
        [driverId]: "Location unavailable"
      }));
    }
  };

  useEffect(() => {
    const list = drivers || [];
    list.forEach(driver => {
      if (driver.location && driver.location.latitude && driver.location.longitude) {
        if (!driverPlaces[driver.id]) {
          getNearestPlace(driver.id, driver.location.latitude, driver.location.longitude);
        }
      }
    });
  }, [drivers]);

  const formatCoordinates = (latitude, longitude) => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };
  const formatAccuracy = (accuracy) => {
    if (accuracy === undefined || accuracy === null) return '20m';
    const constrainedAccuracy = Math.min(Math.round(Number(accuracy)), 20);
    return `${constrainedAccuracy}m`;
  };
  const getLocationTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch (error) {
      return 'Unknown';
    }
  };

  const visibleDriverIds = new Set((getVisibleDrivers(drivers) || []).map(d => d.id));
  const mergedDrivers = (drivers || []).filter(d => {
    const isSelected = selectedDriver && d.id === selectedDriver.id;
    return visibleDriverIds.has(d.id) || isSelected;
  });

  return (
    <div className="location-tracking-map">
      {/* Map Container */}
      <div className="map-container" style={{ position: 'relative' }}>
        <MapContainer
          center={[9.145, 40.4897]}
          zoom={6}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          attributionControl={false}
        >
          <MapController selectedDriver={selectedDriver} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Movement path polylines for continuous tracking */}
          {Object.entries(driverPaths).map(([driverId, path]) => {
            if (!path || path.length < 2) return null;
            
            const driver = mergedDrivers.find(d => d.id === driverId);
            if (!driver) return null;
            
            const isSelected = selectedDriver && selectedDriver.id === driverId;
            const movementState = driver.movementState || { isMoving: false };
            
            return (
              <Polyline
                key={`path-${driverId}`}
                positions={path}
                pathOptions={{
                  color: isSelected ? '#ff6b35' : 
                         movementState.isMoving ? '#28c76f' : '#6c757d',
                  weight: isSelected ? 4 : movementState.isMoving ? 3 : 2,
                  opacity: isSelected ? 0.9 : movementState.isMoving ? 0.8 : 0.6,
                  dashArray: movementState.isMoving ? null : '5, 10',
                  lineCap: 'round',
                  lineJoin: 'round'
                }}
              />
            );
          })}

          {/* Enhanced driver markers with real-time movement indicators */}
          {mergedDrivers.map(driver => {
            const lat = driver?.location?.latitude;
            const lng = driver?.location?.longitude;
            if (lat === undefined || lng === undefined || lat === null || lng === null) return null;
            const latNum = Number(lat);
            const lngNum = Number(lng);
            if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;

            const isSelected = selectedDriver && selectedDriver.id === driver.id;
            const movementState = driver.movementState || { isMoving: false, speed: 0, distance: 0 };
            const isMoving = movementState.isMoving;
              
            return (
              <AnimatedMarker
                key={driver.id || driver.userId}
                position={[latNum, lngNum]}
                icon={createCustomIcon(
                  isSelected ? '#ff6b35' : 
                  driver.networkStatus === 'online' ? '#28c76f' : '#b71c1c',
                  driver.location.accuracy,
                  { ...movementState, detailedAddress: driver.detailedAddress },
                  driver.detailedAddress
                )}
                isMoving={isMoving}
                duration={isMoving ? 100 : 300}
              >
                <Popup>
                  <div style={{ textAlign: 'center', fontWeight: '600', minWidth: '280px' }}>
                    <div style={{ 
                      color: isSelected ? '#ff6b35' : 
                             driver.networkStatus === 'online' ? '#28c76f' : '#b71c1c',
                      marginBottom: '8px',
                      fontSize: '1.1em'
                    }}>
                      {isSelected ? '🎯 ' : (isMoving ? '🚗 ' : '📍 ')}{driver.name || 'Driver'}
                      {isSelected && ' (Selected)'}
                    </div>
                    <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '6px' }}>
                      ID: {driver.userId || driver.id}
                    </div>
                    <div style={{ 
                      fontSize: '0.9em', 
                      color: driver.networkStatus === 'online' ? '#28c76f' : '#b71c1c',
                      fontWeight: '600',
                      marginBottom: '6px'
                    }}>
                      {driver.networkStatus === 'online' ? '🟢 Online' : '🔴 Offline'}
                    </div>
                    
                    {/* Movement Status Display */}
                    <div style={{ 
                      fontSize: '0.85em', 
                      color: isMoving ? '#ff6b35' : '#28c76f',
                      fontWeight: '600',
                      marginBottom: '6px',
                      backgroundColor: isMoving ? '#fff5f0' : '#f0f9ff',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: `1px solid ${isMoving ? '#ff6b35' : '#28c76f'}`
                    }}>
                      {isMoving ? (
                        `🚗 Moving at ${movementState.speed.toFixed(1)}m/s`
                      ) : (
                        '📍 Real-time GPS Tracking Active'
                      )}
                    </div>
                    
                    <div style={{ 
                      fontSize: '0.8em', 
                      color: '#333',
                      marginBottom: '4px',
                      fontFamily: 'monospace',
                      backgroundColor: '#f8f9fa',
                      padding: '4px 6px',
                      borderRadius: '3px'
                    }}>
                      📍 {formatCoordinates(latNum, lngNum)}
                    </div>
                    {driver.location.accuracy !== undefined && (
                      <div style={{ 
                        fontSize: '0.8em', 
                        color: '#666',
                        marginBottom: '4px'
                      }}>
                        🎯 Accuracy: {formatAccuracy(driver.location.accuracy)}
                      </div>
                    )}
                    {driver.location.timestamp && (
                      <div style={{ 
                        fontSize: '0.8em', 
                        color: '#666',
                        marginBottom: '4px'
                      }}>
                        ⏰ Updated: {getLocationTime(driver.location.timestamp)}
                      </div>
                    )}
                    
                    {/* Movement Details */}
                    {movementState.distance > 0 && (
                      <div style={{ 
                        fontSize: '0.8em', 
                        color: '#666',
                        marginBottom: '4px',
                        backgroundColor: '#f8f9fa',
                        padding: '3px 6px',
                        borderRadius: '3px'
                      }}>
                        📏 Last movement: {movementState.distance.toFixed(2)}m
                      </div>
                    )}
                    
                    {/* Detailed Address Information */}
                    {driver.detailedAddress ? (
                      <div style={{ 
                        marginTop: '8px',
                        borderTop: '1px solid #eee',
                        paddingTop: '8px'
                      }}>
                        <div style={{
                          fontSize: '0.85em',
                          fontWeight: '600',
                          color: '#333',
                          marginBottom: '4px'
                        }}>
                          📍 Exact Location:
                        </div>
                        
                        {/* Street Address */}
                        {(driver.detailedAddress.houseNumber || driver.detailedAddress.street) && (
                          <div style={{
                            fontSize: '0.8em',
                            color: '#444',
                            marginBottom: '2px',
                            fontWeight: '500'
                          }}>
                            🏠 {driver.detailedAddress.houseNumber} {driver.detailedAddress.street}
                          </div>
                        )}
                        
                        {/* Neighborhood */}
                        {driver.detailedAddress.neighborhood && (
                          <div style={{
                            fontSize: '0.8em',
                            color: '#666',
                            marginBottom: '2px'
                          }}>
                            🏘️ {driver.detailedAddress.neighborhood}
                          </div>
                        )}
                        
                        {/* City and State */}
                        {driver.detailedAddress.city && (
                          <div style={{
                            fontSize: '0.8em',
                            color: '#666',
                            marginBottom: '2px'
                          }}>
                            🏙️ {driver.detailedAddress.city}{driver.detailedAddress.state && `, ${driver.detailedAddress.state}`}
                          </div>
                        )}
                        
                        {/* Postal Code */}
                        {driver.detailedAddress.postcode && (
                          <div style={{
                            fontSize: '0.8em',
                            color: '#666',
                            marginBottom: '4px'
                          }}>
                            📮 {driver.detailedAddress.postcode}
                          </div>
                        )}
                        
                        {/* Formatted Address */}
                        <div style={{
                          fontSize: '0.75em',
                          color: '#888',
                          fontStyle: 'italic',
                          backgroundColor: '#f8f9fa',
                          padding: '3px 6px',
                          borderRadius: '3px',
                          marginTop: '4px'
                        }}>
                          📍 {driver.detailedAddress.formattedAddress}
                        </div>
                      </div>
                    ) : driverPlaces[driver.id] && (
                      <div style={{ 
                        fontSize: '0.8em', 
                        color: '#666',
                        marginTop: '6px',
                        fontStyle: 'italic',
                        borderTop: '1px solid #eee',
                        paddingTop: '6px'
                      }}>
                        📍 {driverPlaces[driver.id]}
                      </div>
                    )}
                  </div>
                </Popup>
              </AnimatedMarker>
            );
          })}
        </MapContainer>
        
        {/* Minimize Button - Only show when IN fullscreen */}
        {isFullscreen && (
          <button
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              padding: '0.8em',
              background: 'rgba(255, 0, 0, 0.9)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.2em',
              fontWeight: 700,
              cursor: 'pointer',
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '50px',
              height: '50px',
              transition: 'all 0.3s',
              boxShadow: '0 4px 12px rgba(255, 0, 0, 0.4)',
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = 'rgba(255, 0, 0, 1)';
              e.currentTarget.style.transform = 'scale(1.15)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 0, 0, 0.6)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'rgba(255, 0, 0, 0.9)';
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 0, 0, 0.4)';
            }}
            onClick={() => {
              document.exitFullscreen();
            }}
          >
            ⊖
          </button>
        )}
      </div>

      {/* Enhanced Legend with Movement Indicators */}
      <div className="map-legend">
        <div style={{ fontWeight: '600', marginBottom: '4px' }}>Legend:</div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#28c76f' }}></div>
          <span>📍 Stationary Driver</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#28c76f', animation: 'pulse 1.5s ease-in-out infinite' }}></div>
          <span>🚗 Moving Driver</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#ff6b35' }}></div>
          <span>🎯 Selected Driver</span>
        </div>
        <div style={{ fontSize: '0.85em', color: '#333', fontWeight: '500' }}>
          Real-time movement detection with 0.1m sensitivity
        </div>
        <div style={{ fontSize: '0.8em', color: '#666', marginTop: '4px', fontStyle: 'italic' }}>
          Pulsing markers indicate active movement
        </div>
      </div>
    </div>
  );
};

export default LocationTrackingMap;

// Add CSS for pulse animation
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.1); }
    100% { opacity: 1; transform: scale(1); }
  }
`;
document.head.appendChild(style);