import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../Styles/NetworkStatus.css";
import { auth, db } from "../../firebase";
import { getDoc, collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";
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
      
      // Get geolocation
      if (!navigator.geolocation) throw new Error('Geolocation not supported');
      
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Find driver document in driver collection by authUid
        const driverCol = collection(db, 'driver');
        const q = query(driverCol, where('authUid', '==', user.uid));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) throw new Error('Driver not found in driver collection');
        const driverDocRef = querySnapshot.docs[0].ref;
        
        // Update driver with location and start tracking
        await updateDoc(driverDocRef, {
          online: true,
          networkStatus: 'online',
          showLocation: true, // Enable location display
          location: { latitude, longitude },
          lastActive: serverTimestamp(), // Update last active time
          lastUpdated: serverTimestamp(),
          lastLocationUpdate: serverTimestamp(),
        });
        
        // Start location tracking in context
        await startLocationTracking();
        
        navigate('/driver-dashboard', { state: { name } });
      }, (error) => {
        alert('Error getting location: ' + error.message);
      });
    } catch (err) {
      alert('Error setting driver online: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <h1>Network Status</h1>
      <button
        style={{ padding: '1em 2.5em', fontSize: '1.2em', background: '#1c6954', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', marginTop: 24 }}
        onClick={handleStart}
      >
        Start
      </button>
    </div>
  );
};

export default NetworkStatus;
