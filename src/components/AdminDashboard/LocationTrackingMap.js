import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/LocationTrackingMap.css';
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

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom marker icon for current location
const createCustomIcon = (color = '#1c6954') => {
  return L.divIcon({
    html: `<div style="
      width: 20px;
      height: 20px;
      background-color: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      position: relative;
    ">
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 8px;
        height: 8px;
        background-color: white;
        border-radius: 50%;
      "></div>
    </div>`,
    className: 'custom-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

const LocationTrackingMap = ({ drivers = [], currentUserLocation = null, selectedDriver = null }) => {
  const { getVisibleDrivers, shouldShowDriverLocation } = useLocationDisplay();
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
        // Extract the most relevant part of the address
        const addressParts = data.display_name.split(', ');
        const nearestPlace = addressParts.slice(0, 3).join(', '); // Take first 3 parts
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

  // Get place names for drivers when they change
  useEffect(() => {
    getVisibleDrivers(drivers).forEach(driver => {
      if (driver.location && driver.location.latitude && driver.location.longitude) {
        // Only fetch if we don't already have the place for this driver
        if (!driverPlaces[driver.id]) {
          getNearestPlace(driver.id, driver.location.latitude, driver.location.longitude);
        }
      }
    });
  }, [drivers, getVisibleDrivers]);

  return (
    <div className="location-tracking-map">
      {/* Map Container */}
      <div className="map-container" style={{ position: 'relative' }}>
        <MapContainer
          center={[9.145, 40.4897]} // Default Ethiopia center
          zoom={6} // Default zoom level
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          attributionControl={false}
        >
          <MapController selectedDriver={selectedDriver} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          

          {/* Driver markers - Only show drivers with location tracking enabled */}
          {getVisibleDrivers(drivers).map(driver => {
            if (driver.location && driver.location.latitude && driver.location.longitude) {
              const isSelected = selectedDriver && selectedDriver.id === driver.id;
              
              // If a driver is selected and they are offline, don't show their marker
              if (isSelected && driver.networkStatus !== 'online') {
                return null;
              }
              
              return (
                <Marker
                  key={driver.id || driver.userId}
                  position={[driver.location.latitude, driver.location.longitude]}
                  icon={createCustomIcon(
                    isSelected ? '#ff6b35' : // Orange for selected driver
                    driver.networkStatus === 'online' ? '#28c76f' : '#b71c1c'
                  )}
                >
                  <Popup>
                    <div style={{ textAlign: 'center', fontWeight: '600' }}>
                      <div style={{ 
                        color: isSelected ? '#ff6b35' : 
                               driver.networkStatus === 'online' ? '#28c76f' : '#b71c1c',
                        marginBottom: '4px'
                      }}>
                        {isSelected ? '🎯 ' : '🚗 '}{driver.name || 'Driver'}
                        {isSelected && ' (Selected)'}
                      </div>
                      <div style={{ fontSize: '0.9em', color: '#666' }}>
                        ID: {driver.userId || driver.id}
                      </div>
                      <div style={{ 
                        fontSize: '0.9em', 
                        color: driver.networkStatus === 'online' ? '#28c76f' : '#b71c1c',
                        fontWeight: '600'
                      }}>
                        {driver.networkStatus === 'online' ? '🟢 Online' : '🔴 Offline'}
                      </div>
                      <div style={{ 
                        fontSize: '0.8em', 
                        color: '#28c76f',
                        fontWeight: '600',
                        marginTop: '4px'
                      }}>
                        📍 Location Tracking Active
                      </div>
                      {driverPlaces[driver.id] && (
                        <div style={{ 
                          fontSize: '0.8em', 
                          color: '#666',
                          marginTop: '4px',
                          fontStyle: 'italic'
                        }}>
                          📍 {driverPlaces[driver.id]}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            }
            return null;
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





      {/* Legend */}
      <div className="map-legend">
        <div style={{ fontWeight: '600', marginBottom: '4px' }}>Legend:</div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#28c76f' }}></div>
          <span>Online Driver</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#ff6b35' }}></div>
          <span>Selected Online Driver</span>
        </div>
      </div>
    </div>
  );
};

export default LocationTrackingMap; 