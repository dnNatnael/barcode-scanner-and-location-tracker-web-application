import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "../../firebase";
import { collection, query, where, getDocs, updateDoc, serverTimestamp } from "firebase/firestore";
import { useLocationDisplay } from "../../contexts/LocationDisplayContext";

const NetworkStatus = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { startLocationTracking } = useLocationDisplay();
  
  // Get name from location.state or localStorage
  const name = location.state?.name || localStorage.getItem('driverName') || "";

  // Store name in localStorage for Scan fallback
  if (name) localStorage.setItem('driverName', name);

  const handleStart = async () => {
    try {
      // Get current user
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      
      // Check if geolocation is supported
      if (!navigator.geolocation) throw new Error('Geolocation not supported');
      
      // Get initial position with high accuracy
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        
        console.log(`Initial GPS Position - Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}, Accuracy: ${accuracy}m`);
        
        // Find driver document in driver collection by authUid
        const driverCol = collection(db, 'driver');
        const q = query(driverCol, where('authUid', '==', user.uid));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) throw new Error('Driver not found in driver collection');
        const driverDocRef = querySnapshot.docs[0].ref;
        
        // Update driver with precise initial location and start tracking
        await updateDoc(driverDocRef, {
          online: true,
          networkStatus: 'online',
          showLocation: true, // Enable location display
          location: { 
            latitude: latitude, 
            longitude: longitude,
            accuracy: accuracy,
            timestamp: new Date().toISOString()
          },
          lastActive: serverTimestamp(), // Update last active time
          lastUpdated: serverTimestamp(),
          lastLocationUpdate: serverTimestamp(),
        });
        
        // Start continuous location tracking in context
        await startLocationTracking();
        
        navigate('/driver-dashboard', { state: { name } });
      }, (error) => {
        console.error('Error getting initial location:', error);
        alert('Error getting location: ' + error.message);
      }, {
        enableHighAccuracy: true, // Use GPS for highest accuracy
        maximumAge: 30000, // Accept cached positions up to 30 seconds old
        timeout: 20000 // Wait up to 20 seconds for a position
      });
    } catch (err) {
      console.error('Error setting driver online:', err);
      alert('Error setting driver online: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', width: '100vw', maxWidth: '100vw' }}>
      <button
        style={{ 
          padding: '1em 2.5em', 
          fontSize: '1.2em', 
          background: '#1c6954', 
          color: '#fff', 
          border: 'none', 
          borderRadius: 8, 
          fontWeight: 600, 
          cursor: 'pointer', 
          boxShadow: '0 4px 12px rgba(28, 105, 84, 0.3)',
          transition: 'all 0.3s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = '#155c47';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(28, 105, 84, 0.4)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = '#1c6954';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(28, 105, 84, 0.3)';
        }}
        onClick={handleStart}
      >
        Start Scanning
      </button>
    </div>
  );
};

export default NetworkStatus;
