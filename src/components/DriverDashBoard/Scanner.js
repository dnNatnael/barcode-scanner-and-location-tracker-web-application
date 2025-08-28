import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import { getDoc, doc, collection, addDoc, setDoc, serverTimestamp, query, orderBy, onSnapshot, where, getDocs, updateDoc } from "firebase/firestore";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import "../Styles/Login.css";
import { useLocationDisplay } from "../../contexts/LocationDisplayContext";

const CAMERA_WIDTH = window.innerWidth;
const CAMERA_HEIGHT = 360;
const MIN_FRAME_WIDTH = 120;
const MIN_FRAME_HEIGHT = 80;
const MAX_FRAME_WIDTH = CAMERA_WIDTH - 20;
const MAX_FRAME_HEIGHT = CAMERA_HEIGHT - 20;

const Scanner = () => {
  // User info logic
  const location = useLocation();
  const navigate = useNavigate();
  const { stopLocationTracking } = useLocationDisplay();
  const name = location.state?.name || "User";
  const [userId, setUserId] = useState("");
  const [driverName, setDriverName] = useState(name);
  const [driverId, setDriverId] = useState("");
  const stopCameraRef = useRef(null);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [sampleTypeInput, setSampleTypeInput] = useState("");
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [scannedBarcodes, setScannedBarcodes] = useState(new Set());
  const [cameraActive, setCameraActive] = useState(true);
  const [scanSuccessMessage, setScanSuccessMessage] = useState("");
  const [barcodeLocationMap, setBarcodeLocationMap] = useState({});
  const [isRepeatedScan, setIsRepeatedScan] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState("");
  const [gpsStatus, setGpsStatus] = useState({ active: false, coordinates: null, accuracy: null });

  useEffect(() => {
    const fetchUserId = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserId(userData.userId || "");
          setDriverId(userData.userId || "");
          setDriverName(userData.name || name);
        }
      }
    };
    fetchUserId();
  }, []);

  useEffect(() => {
    // On page load, clear the 'refreshing' flag if present
    if (sessionStorage.getItem('refreshing')) {
      sessionStorage.removeItem('refreshing');
    }
  }, []);

  // Refresh detection and session management
  useEffect(() => {
          const user = auth.currentUser;
          if (!user) return;

    // Check if this is a page refresh
    const isRefresh = sessionStorage.getItem('scanner-refreshing');
    
    if (isRefresh) {
      // This is a refresh - mark driver offline first
      const markDriverOffline = async () => {
        try {
          const driverCol = collection(db, 'driver');
          const q = query(driverCol, where('authUid', '==', user.uid));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const driverDoc = querySnapshot.docs[0];
            await updateDoc(driverDoc.ref, {
              online: false,
              networkStatus: 'offline',
              showLocation: false,
              lastActive: serverTimestamp()
            });
          }
        } catch (err) {
          console.error("Error marking driver offline on refresh:", err);
        }
      };
      
      markDriverOffline();
      sessionStorage.removeItem('scanner-refreshing');
              }

    // Mark driver as online when page loads (new session)
    const markDriverOnline = async () => {
      try {
            const driverCol = collection(db, 'driver');
        const q = query(driverCol, where('authUid', '==', user.uid));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const driverDoc = querySnapshot.docs[0];
          await updateDoc(driverDoc.ref, {
            online: true,
            networkStatus: 'online',
            showLocation: true,
            lastActive: serverTimestamp()
              });
            }
          } catch (err) {
        console.error("Error marking driver online on page load:", err);
          }
    };

    // Small delay to ensure offline status is set before going online
    setTimeout(() => {
      markDriverOnline();
    }, 1000);

  }, []);

  // Set refresh flag before page unload
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Set flag to indicate this is a refresh
      sessionStorage.setItem('scanner-refreshing', 'true');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Heartbeat logic - only update lastActive, don't change network status
  useEffect(() => {
    let intervalId;
    let isActive = true;
    let lastHeartbeat = Date.now();

    const updateLastActive = async () => {
      if (!isActive) return;
      
      const user = auth.currentUser;
      if (!user) return;
      
      try {
        const driverCol = collection(db, 'driver');
        const q = query(driverCol, where('authUid', '==', user.uid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const driverDoc = querySnapshot.docs[0];
          // Only update lastActive, don't change network status
          await updateDoc(driverDoc.ref, {
            lastActive: new Date(),
            online: true, // Keep online status but don't change networkStatus
          });
          lastHeartbeat = Date.now();
        }
      } catch (err) {
        console.error("Error updating last active:", err);
        // Don't show error to user for heartbeat
      }
    };

    // Check if driver should be marked offline (no heartbeat for 60 seconds)
    const checkOfflineStatus = async () => {
      if (!isActive) return;
      
      const timeSinceLastHeartbeat = Date.now() - lastHeartbeat;
      if (timeSinceLastHeartbeat > 60000) { // 60 seconds instead of 30
        const user = auth.currentUser;
        if (!user) return;
        
        try {
          const driverCol = collection(db, 'driver');
          const q = query(driverCol, where('authUid', '==', user.uid));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const driverDoc = querySnapshot.docs[0];
            await updateDoc(driverDoc.ref, {
              online: false,
              networkStatus: 'offline',
              showLocation: false,
              lastActive: serverTimestamp()
            });
          }
        } catch (err) {
          console.error("Error setting driver offline:", err);
        }
      }
    };

    updateLastActive(); // Initial ping
    intervalId = setInterval(updateLastActive, 10000); // Ping every 10s
    
    // Check offline status every 15 seconds
    const offlineCheckInterval = setInterval(checkOfflineStatus, 15000);
    
    return () => {
      isActive = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (offlineCheckInterval) {
        clearInterval(offlineCheckInterval);
      }
    };
  }, []);

  // Handle page visibility changes with refresh detection
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // Page is hidden (tab switched, minimized, etc.)
        const user = auth.currentUser;
        if (!user) return;
        
        // Check if this is a refresh
        const isRefresh = sessionStorage.getItem('scanner-refreshing');
        
        // COMMENTED OUT: Don't mark offline on visibility change
        // This was causing drivers to go offline when switching tabs
        /*
        if (!isRefresh) {
          // Only mark offline if it's not a refresh
          try {
            const driverCol = collection(db, 'driver');
            const q = query(driverCol, where('authUid', '==', user.uid));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const driverDoc = querySnapshot.docs[0];
              await updateDoc(driverDoc.ref, {
                online: false,
                networkStatus: 'offline',
                showLocation: false,
                lastActive: serverTimestamp()
              });
            }
          } catch (err) {
            console.error("Error setting driver offline on visibility change:", err);
          }
        }
        */
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Handle beforeunload with refresh detection
  useEffect(() => {
    const handleBeforeUnload = async (e) => {
      const user = auth.currentUser;
      if (!user) return;
      
      // Check if this is a refresh or actual page close
      const isRefresh = sessionStorage.getItem('scanner-refreshing');
      
      if (!isRefresh) {
        // This is a real page close, not a refresh
        try {
          const driverCol = collection(db, 'driver');
          const q = query(driverCol, where('authUid', '==', user.uid));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const driverDoc = querySnapshot.docs[0];
            // Use sendBeacon for more reliable delivery
            const data = {
              online: false,
              networkStatus: 'offline',
              showLocation: false,
              lastActive: new Date().toISOString()
            };
            
            // Try to send the data before page unload
            if (navigator.sendBeacon) {
              const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
              navigator.sendBeacon('/api/driver-offline', blob);
            }
            
            // Also try direct update
            await updateDoc(driverDoc.ref, {
              online: false,
              networkStatus: 'offline',
              showLocation: false,
              lastActive: serverTimestamp()
            });
          }
        } catch (err) {
          // Ignore errors for beforeunload
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Monitor GPS status
  useEffect(() => {
    const checkGpsStatus = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const driverCol = collection(db, 'driver');
        const q = query(driverCol, where('authUid', '==', user.uid));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const driverDoc = querySnapshot.docs[0];
          const driverData = driverDoc.data();
          
          if (driverData.location && driverData.showLocation && driverData.networkStatus === 'online') {
            setGpsStatus({
              active: true,
              coordinates: {
                latitude: driverData.location.latitude,
                longitude: driverData.location.longitude
              },
              accuracy: driverData.location.accuracy,
              timestamp: driverData.location.timestamp
            });
          } else {
            setGpsStatus({ active: false, coordinates: null, accuracy: null });
          }
        }
      } catch (error) {
        console.error('Error checking GPS status:', error);
      }
    };

    // Check GPS status every 5 seconds
    const intervalId = setInterval(checkGpsStatus, 5000);
    checkGpsStatus(); // Initial check

    return () => clearInterval(intervalId);
  }, []);

  // High-accuracy continuous GPS tracking for real-time location
  useEffect(() => {
    let watchId = null;
    let isMounted = true;

    const startHighAccuracyTracking = async () => {
      const user = auth.currentUser;
      if (!user) return;

      if (!navigator.geolocation) {
        console.error('Geolocation not supported');
        return;
      }

      try {
        const driverCol = collection(db, 'driver');
        const q = query(driverCol, where('authUid', '==', user.uid));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return;
        const driverDocRef = querySnapshot.docs[0].ref;

        // Start watching the device GPS with high accuracy and zero cache
        watchId = navigator.geolocation.watchPosition(
          async (position) => {
            if (!isMounted) return;
            const { latitude, longitude, accuracy, heading, speed } = position.coords;
            try {
              await updateDoc(driverDocRef, {
                location: {
                  latitude: latitude,
                  longitude: longitude,
                  accuracy: accuracy,
                  heading: heading ?? null,
                  speed: speed ?? null,
                  timestamp: new Date().toISOString(),
                },
                lastLocationUpdate: serverTimestamp(),
                lastActive: serverTimestamp(),
                showLocation: true,
                online: true,
                networkStatus: 'online',
              });
            } catch (err) {
              console.error('Error updating GPS location:', err);
            }
          },
          (error) => {
            console.error('GPS tracking error:', error);
          },
          {
            enableHighAccuracy: true,   // request GPS chip
            maximumAge: 0,              // do not use cached positions
            timeout: 10000              // up to 10s to get a fix
          }
        );
      } catch (err) {
        console.error('Error starting high-accuracy GPS tracking:', err);
      }
    };

    // Small delay to ensure auth/getDocs ready
    const t = setTimeout(startHighAccuracyTracking, 500);

    return () => {
      isMounted = false;
      clearTimeout(t);
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const handleScanSuccess = async (barcodeText) => {
    // Allow repeated scans of the same barcode (no session check)
    // Stop camera and show location input
    setCameraActive(false);
    setScannedBarcode(barcodeText);
    const baseSampleId = `SID-${barcodeText}`;
    let locationForBarcode = '';
    let repeated = false;
    // Check local cache first
    if (barcodeLocationMap[barcodeText]) {
      locationForBarcode = barcodeLocationMap[barcodeText];
      repeated = true;
    } else {
      // Check Firestore for first scan
      const existingDoc = await getDoc(doc(db, "samples", baseSampleId));
      if (existingDoc.exists()) {
        const data = existingDoc.data();
        if (data && data.location) {
          locationForBarcode = data.location;
          // Update local cache
          setBarcodeLocationMap(prev => ({ ...prev, [barcodeText]: data.location }));
          repeated = true;
        }
      }
    }
    if (repeated && locationForBarcode) {
      setLocationInput(locationForBarcode);
      setIsRepeatedScan(true);
    } else {
      setLocationInput("");
      setIsRepeatedScan(false);
    }
    setShowLocationInput(true);
    setScanSuccessMessage("Scanned Successfully!");
    setTimeout(() => setScanSuccessMessage(""), 4000);
  };

  const handleSubmitSample = async () => {
    if (!sampleTypeInput.trim()) {
      alert("Please enter a sample type");
      return;
    }
    // Only require location if not a repeated scan
    if (!isRepeatedScan && !locationInput.trim()) {
      alert("Please enter a location");
      return;
    }
    try {
      const user = auth.currentUser;
      const driverId = await getDriverId(user.uid);
      const driverName = await getDriverName(user.uid);
      const baseSampleId = `SID-${scannedBarcode}`;
      const existingDoc = await getDoc(doc(db, "samples", baseSampleId));
      const repeated = existingDoc.exists();
      // Save sample
      await saveSampleScan(scannedBarcode, isRepeatedScan ? barcodeLocationMap[scannedBarcode] : locationInput.trim(), sampleTypeInput.trim());
      // If first scan, cache the location for this barcode
      if (!isRepeatedScan && locationInput.trim()) {
        setBarcodeLocationMap(prev => ({ ...prev, [scannedBarcode]: locationInput.trim() }));
      }
      setScannedBarcode("");
      setLocationInput("");
      setSampleTypeInput("");
      setShowLocationInput(false);
      setIsRepeatedScan(false);
      setCameraActive(true);
      // Show in-form success message
      setShowSuccessMessage("Sample saved successfully!");
      setTimeout(() => setShowSuccessMessage(""), 3000);
    } catch (error) {
      console.error("Error saving sample:", error);
      alert("Error saving sample. Please try again.");
    }
  };

  const handleCancelScan = () => {
    setScannedBarcode("");
    setLocationInput("");
    setSampleTypeInput("");
    setShowLocationInput(false);
    
    // Restart camera for next scan
    setCameraActive(true);
  };

  return (
    <div style={{ 
      minHeight: '10vh', 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center',
      padding: '2rem 0',
      textAlign: 'center',
      width: '100vw',
      margin: '0',
      maxWidth: '100vw',
      boxSizing: 'border-box',
      position: 'relative',
      left: '50%',
      transform: 'translateX(-50%)'
    }}>
      {/* ICL Logo at the top - using same approach as Login/Signup pages */}
      <div className="left-bg" style={{ 
        marginBottom: '0.1rem',
        marginTop: '-2rem',
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }} />
      
      {/* Custom CSS for larger logo on Scanner page */}
      <style>
        {`
          .left-bg::before {
            width: 400px !important;
            height: 200px !important;
            min-width: 120px !important;
            min-height: 60px !important;
          }
        `}
      </style>
      
      {/* User greeting and ID */}
      <div style={{ textAlign: 'center', marginBottom: '2rem', marginTop: '-3rem', width: '100%' }}>
        <p>Welcome {name}!</p>
        <p>Here you can Scan barcodes.</p>
        {userId && <p>Your ID: {userId}</p>}
      </div>
      
      {/* Success message styled like signup page, no icon */}
      {scanSuccessMessage && (
        <div className="success-message">
          {scanSuccessMessage}
        </div>
      )}
      {/* Toast Notification */}
      {showSuccessToast && (
        <div style={{
          position: 'fixed',
          top: '32px',
          right: '32px',
          zIndex: 9999,
          background: '#43d477',
          color: 'white',
          padding: '18px 32px 18px 24px',
          borderRadius: '10px',
          boxShadow: '0 4px 24px 0 rgba(67, 212, 119, 0.18), 0 1.5px 6px 0 rgba(0,0,0,0.10)',
          display: 'flex',
          alignItems: 'center',
          fontSize: '1.15em',
          fontWeight: 600,
          minWidth: '240px',
          maxWidth: '90vw',
          animation: 'fadeInToast 0.4s',
          cursor: 'pointer',
          gap: '14px'
        }}
        onClick={() => setShowSuccessToast(false)}
        >
          <span style={{ fontSize: '1.5em', marginRight: '8px' }}>✅</span>
          Sample saved successfully!
          <span style={{ marginLeft: 'auto', fontSize: '1.2em', opacity: 0.7 }}>&times;</span>
          <style>{`
            @keyframes fadeInToast {
              from { opacity: 0; transform: translateY(-16px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}
      {/* In-form Success Message (same style as scan success) */}
      {showSuccessMessage && (
        <div className="success-message" style={{
          margin: '0 auto 1.2rem auto',
          maxWidth: '350px',
          width: '95%',
          background: '#43d477',
          color: 'white',
          borderRadius: '10px',
          padding: '0.7rem 0.8rem', // Reduced left/right padding
          fontWeight: 600,
          fontSize: '1.08em',
          textAlign: 'center',
          boxShadow: '0 2px 10px rgba(67, 212, 119, 0.18)',
          animation: 'fadeInSuccess 0.4s'
        }}>
          {showSuccessMessage}
          <style>{`
            @keyframes fadeInSuccess {
              from { opacity: 0; transform: translateY(-8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}
      {/* Location Input Section */}
      {showLocationInput && (
        <div style={{
          background: 'rgba(33, 150, 243, 0.10)', // More transparent light blue
          padding: '0.9rem',
          borderRadius: '8px',
          boxShadow: '0 4px 24px 0 rgba(0, 191, 255, 0.25), 0 1.5px 6px 0 rgba(0,0,0,0.10)', // More prominent border shadow
          maxWidth: '300px',
          width: '96%',
          margin: '0 auto 1rem auto',
          border: '2px solid #1c6954',
          color: 'white',
          marginBottom: '1.5rem'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            marginBottom: '0.7rem',
            color: 'white',
            justifyContent: 'center', // Center the heading
            width: '100%'
          }}>
            <h3 style={{ margin: 0, color: 'white', fontSize: '1.08em', fontWeight: 600, textAlign: 'center', width: '100%' }}>Barcode Scanned Successfully!</h3>
          </div>
          <div style={{ 
            background: 'rgba(255,255,255,0.10)', 
            padding: '12px', 
            borderRadius: '7px', 
            marginBottom: '1rem',
            border: '1px solid #e9ecef',
            color: 'white'
          }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '0.9em', color: '#e3f2fd', fontWeight: '600' }}>
              Scanned Barcode:
            </p>
            <p style={{ margin: 0, fontSize: '1.1em', fontWeight: 'bold', color: '#fff' }}>
              {scannedBarcode}
            </p>
          </div>
          <div style={{ marginBottom: '1.1rem', color: '#e3f2fd', fontSize: '0.98em', textAlign: 'center', fontWeight: 500 }}>
            Please complete the sample details.
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '10px', 
              fontSize: '1em', 
              color: '#e3f2fd',
              fontWeight: '600'
            }}>
              Enter Sample Type:
            </label>
            <input
              type="text"
              placeholder="e.g., Blood, Urine, Tissue, Swab"
              value={sampleTypeInput}
              onChange={(e) => setSampleTypeInput(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #ddd',
                borderRadius: '7px',
                fontSize: '15px',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#1c6954'}
              onBlur={(e) => e.target.style.borderColor = '#ddd'}
              autoFocus
            />
          </div>
          {isRepeatedScan ? (
            <div style={{
              marginBottom: '1.2rem',
              background: 'rgba(255,255,255,0.13)',
              borderRadius: '6px',
              padding: '10px',
              color: '#e3f2fd',
              fontSize: '0.98em',
              textAlign: 'left', // Align left
              border: '1px solid #e3f2fd',
              fontWeight: 500
            }}>
              <span style={{ color: '#e3f2fd', fontWeight: 600 }}>Location:</span> {barcodeLocationMap[scannedBarcode]}
            </div>
          ) : (
            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '10px', 
                fontSize: '1em', 
                color: '#e3f2fd',
                fontWeight: '600'
              }}>
                Enter Sample Location:
              </label>
              <input
                type="text"
                placeholder="e.g., Hospital A, Clinic B, Warehouse Zone 3"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '7px',
                  fontSize: '15px',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#1c6954'}
                onBlur={(e) => e.target.style.borderColor = '#ddd'}
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleSubmitSample}
              style={{
                flex: 1,
                padding: '12px',
                background: '#00BFFF', // Deep Sky Blue
                color: 'white',
                border: 'none',
                borderRadius: '7px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = '#009acd'}
              onMouseOut={(e) => e.target.style.background = '#00BFFF'}
            >
              Save Sample
            </button>
            <button
              onClick={handleCancelScan}
              style={{
                flex: 1,
                padding: '12px',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '7px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = '#5a6268'}
              onMouseOut={(e) => e.target.style.background = '#6c757d'}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Scanner Camera - Only render when camera is active */}
      {cameraActive ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          width: '100vw', 
          marginBottom: '20px',
          marginTop: '-2rem',
          marginLeft: 'calc(-50vw + 50%)',
          marginRight: 'calc(-50vw + 50%)'
        }}>
          <ScannerCamera 
            key={`camera-active-${Date.now()}`}
            setStopCamera={fn => (stopCameraRef.current = fn)} 
            onScanSuccess={handleScanSuccess}
            isActive={true}
          />
        </div>
      ) : null}
      
      {/* Camera Status Message */}
      {/* Removed the white container for camera paused state as requested */}
      
      {/* View My Samples Button */}
      <button
        style={{ 
          marginTop: 16, 
          padding: '12px 28px', 
          background: '#00BFFF', // Deep Sky Blue
          color: 'white', 
          border: 'none', 
          borderRadius: 8, 
          fontSize: 18, 
          fontWeight: 600, 
          cursor: 'pointer', 
          boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
          display: 'block',
          margin: '-1rem auto 0 auto'
        }}
        onMouseOver={e => e.currentTarget.style.background = '#009acd'}
        onMouseOut={e => e.currentTarget.style.background = '#00BFFF'}
        onClick={() => {
          if (stopCameraRef.current) stopCameraRef.current();
          navigate('/driver-view', { state: { driverName, driverId, isDriverAccess: true } });
        }}
      >
        View collected samples
      </button>
      
      {/* Finished Button */}
      <button
        style={{ 
          marginTop: 16, 
          padding: '12px 28px', 
          background: '#b71c1c', 
          color: 'white', 
          border: 'none', 
          borderRadius: 8, 
          fontSize: 18, 
          fontWeight: 600, 
          cursor: 'pointer', 
          boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
          display: 'block',
          margin: '1rem auto 0 auto'
        }}
        onClick={async () => {
          try {
            const user = auth.currentUser;
            if (!user) {
              alert('Not logged in.');
              return;
            }
            
            // Stop location tracking in context
            await stopLocationTracking();
            
            // Find the driver document by authUid
            const driverCol = collection(db, 'driver');
            const q = query(driverCol, where('authUid', '==', user.uid));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
              alert('Driver not found in driver collection.');
              return;
            }
            const driverDocRef = querySnapshot.docs[0].ref;
            
            // Update driver to hide location and set offline
            await updateDoc(driverDocRef, { 
              online: false, 
              networkStatus: 'offline',
              showLocation: false, // Hide location display
              lastActive: serverTimestamp(), // Update last active time
              location: {
                latitude: null,
                longitude: null,
                accuracy: null,
                heading: null,
                speed: null,
                timestamp: null,
              },
            });
            
            navigate('/network-status', { state: { name: driverName } });
          } catch (err) {
            alert('Error updating driver status: ' + err.message);
          }
        }}
      >
        Finished
      </button>

      {/* GPS Status Indicator intentionally hidden to keep UI clean while GPS tracking runs in background */}
    </div>
  );
};

const ScannerCamera = ({ setStopCamera, onScanSuccess, isActive }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const scanIntervalRef = useRef(null);



  // Custom barcode scanning function that scans entire camera
  const scanCameraForBarcode = async () => {
    // Don't scan if camera is not active
    if (!isActive) {
      console.log("Camera scanning disabled - isActive is false");
      return null;
    }
    
    if (!videoRef.current || !canvasRef.current) return;
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Set canvas size to match the full camera
      canvas.width = window.innerWidth;
      canvas.height = CAMERA_HEIGHT;
      
      // Draw the entire video to canvas
      ctx.drawImage(video, 0, 0, CAMERA_WIDTH, CAMERA_HEIGHT);
      
      // Get image data from canvas (entire camera area)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Use the Browser's built-in BarcodeDetector API if available
      if ('BarcodeDetector' in window) {
        // eslint-disable-next-line no-undef
        const barcodeDetector = new BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'aztec', 'data_matrix']
        });
        
        const barcodes = await barcodeDetector.detect(imageData);
        if (barcodes.length > 0) {
          return barcodes[0].rawValue;
        }
      } else {
        // Fallback: Use html5-qrcode for the entire camera area
        const tempScannerId = `temp-scanner-${Date.now()}`;
        
        // Create temporary container
        const tempContainer = document.createElement('div');
        tempContainer.id = tempScannerId;
        tempContainer.style.position = 'absolute';
        tempContainer.style.top = '-9999px';
        tempContainer.style.left = '-9999px';
        tempContainer.style.width = '320px';
        tempContainer.style.height = '240px';
        document.body.appendChild(tempContainer);
        
        const html5Qrcode = new Html5Qrcode(tempScannerId);
        
        // Convert canvas to blob
        const blob = await new Promise(resolve => canvas.toBlob(resolve));
        
        // Create a temporary file-like object
        const file = new File([blob], "camera.png", { type: "image/png" });
        
        try {
          const result = await html5Qrcode.scanFile(file, true);
          
          // Clean up temporary container
          if (tempContainer.parentNode) {
            tempContainer.parentNode.removeChild(tempContainer);
          }
          
          return result;
        } catch (error) {
          // Clean up temporary container
          if (tempContainer.parentNode) {
            tempContainer.parentNode.removeChild(tempContainer);
          }
          // No barcode found in camera area
          return null;
        }
      }
    } catch (error) {
      console.error("Camera scanning error:", error);
      return null;
    }
  };

  useEffect(() => {
    let stream;
    let stopRequested = false;
    
    // Cleanup function to stop camera completely
    const stopCamera = () => {
      console.log("Stopping camera completely...");
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log("Stopped track:", track.kind);
        });
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      setScanning(false);
    };
    
    // Only start camera if isActive is true
    if (!isActive) {
      console.log("Camera is not active, stopping all camera operations");
      stopCamera();
      return;
    }
    
    console.log("Camera is active, starting camera operations");
    
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: window.innerWidth,
            height: CAMERA_HEIGHT,
            facingMode: { exact: "environment" }
          }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        
        // Wait for video to be ready
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = resolve;
          }
        });
        
        setScanning(true);
        
        // Start scanning only if camera is active
        if (isActive) {
          console.log("Starting scanning interval");
          scanIntervalRef.current = setInterval(async () => {
            if (stopRequested || !isActive) {
              console.log("Scanning stopped - stopRequested:", stopRequested, "isActive:", isActive);
              return;
            }
            
            const barcodeText = await scanCameraForBarcode();
            if (barcodeText) {
              console.log("Barcode scanned:", barcodeText);
              setScanResult(barcodeText);
              setScanning(false);
              
              // Stop scanning
              if (scanIntervalRef.current) {
                clearInterval(scanIntervalRef.current);
                scanIntervalRef.current = null;
              }
              
              // Call the success callback
              if (onScanSuccess) {
                onScanSuccess(barcodeText);
              }
            }
          }, 500); // Scan every 500ms
        }
        
      } catch (err) {
        console.error("Camera error:", err);
      }
    })();

    if (setStopCamera) {
      setStopCamera(() => async () => {
        stopRequested = true;
        
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        setScanning(false);
      });
    }

    return () => {
      console.log("Camera component unmounting, cleaning up...");
      stopRequested = true;
      stopCamera();
    };
  }, [onScanSuccess, isActive]);

  return (
    <div style={{ 
      position: 'relative', 
      width: '100vw', 
      height: CAMERA_HEIGHT, 
      background: '#000', 
      border: '4px solid #222', 
      borderRadius: 12, 
      boxShadow: '0 2px 16px rgba(0,0,0,0.18)', 
      overflow: 'hidden',
      maxWidth: '100vw'
    }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      {/* Hidden canvas for frame scanning */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />
      {/* Scanning indicator */}
      {scanning && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: 8,
          background: '#00FF00',
          color: '#222',
          padding: '6px 14px',
          borderRadius: 8,
          fontWeight: 700,
          zIndex: 30,
          fontSize: '14px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          animation: 'pulse 1.5s infinite'
        }}>
          🔍 SCANNING...
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
      `}</style>
      {/* Scanning line overlay */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: 4,
        background: 'linear-gradient(90deg, rgba(0,255,0,0.7) 0%, rgba(0,255,0,1) 50%, rgba(0,255,0,0.7) 100%)',
        boxShadow: '0 0 8px 2px #0f0',
        zIndex: 3,
        animation: 'scan-move 2.5s linear infinite',
      }} />
      <style>{`
        @keyframes scan-move {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
};

function SamplesTable({ driverName }) {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsubscribe = null;
    
    try {
    const q = query(collection(db, "samples"), orderBy("date", "desc"));
      unsubscribe = onSnapshot(
        q, 
        (snap) => {
          try {
            const sampleData = snap.docs.map(doc => doc.data());
            setSamples(sampleData);
            setLoading(false);
          } catch (err) {
            console.error("Error processing sample data:", err);
            setError("Error loading sample data");
            setLoading(false);
          }
        },
        (error) => {
          console.error("Samples listener error:", error);
          setError("Error loading sample data");
          setLoading(false);
        }
      );
    } catch (err) {
      console.error("Error setting up samples listener:", err);
      setError("Error setting up samples listener");
      setLoading(false);
    }

    return () => {
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (err) {
          console.error("Error unsubscribing from samples listener:", err);
        }
      }
    };
  }, []);

  if (loading) {
    return (
      <div style={{ width: '100%', maxWidth: 1050, margin: '0 auto', textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '1.2em', color: '#666' }}>Loading samples...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width: '100%', maxWidth: 1050, margin: '0 auto', textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '1.2em', color: '#d32f2f' }}>Error: {error}</div>
        <button 
          onClick={() => window.location.reload()} 
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            background: '#1c6954',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: 1050, margin: '0 auto' }}>
      <h2 style={{ margin: '1.5em 0 0.5em 0', textAlign: 'left' }}>Sample collected by {driverName}</h2>
      <table className="it-users-table">
        <thead>
          <tr>
            <th style={{ width: '25%', fontSize: '1.35em' }}>ID</th>
            <th style={{ width: '25%', fontSize: '1.35em' }}>Barcode</th>
            <th style={{ width: '25%', fontSize: '1.35em' }}>Location</th>
            <th style={{ width: '25%', fontSize: '1.35em' }}>Date and Time</th>
          </tr>
        </thead>
        <tbody>
          {samples.length === 0 ? (
            <tr>
              <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                No samples found.
              </td>
            </tr>
          ) : (
            samples.map(s => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.barcode}</td>
              <td>{s.location}</td>
              <td>{s.date?.toDate ? s.date.toDate().toLocaleString() : ''}</td>
            </tr>
            ))
          )}
        </tbody>
      </table>
      <div style={{ fontSize: '0.9em', marginTop: '0.3em', color: '#555' }}>
        Total Samples: {samples.length}
      </div>
    </div>
  );
}



// Helper to get driver ID
async function getDriverId(uid) {
  try {
    console.log("Getting driver ID for UID:", uid);
    
    // First try to get from driver collection
    const driverCol = collection(db, 'driver');
    const q = query(driverCol, where('authUid', '==', uid));
    const querySnapshot = await getDocs(q);
    
    console.log("Driver query result:", querySnapshot.size, "documents found");
    
    if (!querySnapshot.empty) {
      const driverDoc = querySnapshot.docs[0];
      const driverData = driverDoc.data();
      console.log("Driver data:", driverData);
      
      // Check for different possible field names
      const driverId = driverData.userId || driverData.driverId || driverData.id || "Unknown";
      console.log("Found driver ID:", driverId);
      return driverId;
    }
    
    console.log("No driver found, checking users collection");
    
    // Fallback to users collection
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log("User data:", userData);
      const userId = userData.userId || userData.driverId || userData.id || "Unknown";
      console.log("Found user ID:", userId);
      return userId;
    }
    
    // If no driver found, try to get the first available driver as fallback
    console.log("No user found, trying to get first available driver");
    const allDriversQuery = await getDocs(collection(db, 'driver'));
    if (!allDriversQuery.empty) {
      const firstDriver = allDriversQuery.docs[0];
      const firstDriverData = firstDriver.data();
      const fallbackDriverId = firstDriverData.userId || "DID-0001";
      console.log("Using fallback driver ID:", fallbackDriverId);
      return fallbackDriverId;
    }
    
    console.log("No drivers found, returning DID-0001 as default");
    return "DID-0001";
  } catch (error) {
    console.error("Error getting driver ID:", error);
    return "DID-0001";
  }
}

// Helper to get driver name
async function getDriverName(uid) {
  try {
    console.log("Getting driver name for UID:", uid);
    
    // First try to get from driver collection
    const driverCol = collection(db, 'driver');
    const q = query(driverCol, where('authUid', '==', uid));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const driverDoc = querySnapshot.docs[0];
      const driverData = driverDoc.data();
      const driverName = driverData.name || "Unknown";
      console.log("Found driver name:", driverName);
      return driverName;
    }
    
    console.log("No driver found, checking users collection");
    
    // Fallback to users collection
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const userName = userData.name || "Unknown";
      console.log("Found user name:", userName);
      return userName;
    }
    
    // If no driver found, try to get the first available driver as fallback
    console.log("No user found, trying to get first available driver");
    const allDriversQuery = await getDocs(collection(db, 'driver'));
    if (!allDriversQuery.empty) {
      const firstDriver = allDriversQuery.docs[0];
      const firstDriverData = firstDriver.data();
      const fallbackDriverName = firstDriverData.name || "Natnael Yilma";
      console.log("Using fallback driver name:", fallbackDriverName);
      return fallbackDriverName;
    }
    
    console.log("No drivers found, returning default name");
    return "Natnael Yilma";
  } catch (error) {
    console.error("Error getting driver name:", error);
    return "Natnael Yilma";
  }
}

// Save scan to database
async function saveSampleScan(barcode, location, sampleType) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  // Get driver information
  const driverId = await getDriverId(user.uid);
  const driverName = await getDriverName(user.uid);

  // Always store as sub-sample: SID-<barcode>_N
  const baseSampleId = `SID-${barcode}`;
  const samplesQuery = query(
    collection(db, "samples"),
    where("baseBarcode", "==", barcode)
  );
  const existingSamples = await getDocs(samplesQuery);
  const subSampleCount = existingSamples.docs.length;
  const nextNumber = subSampleCount + 1;
  const finalSampleId = `${baseSampleId}_${nextNumber}`;

  // Determine location: first scan sets it, all subsequent inherit it
  let locationToUse = (location || "").trim();
  if (subSampleCount > 0) {
    // Find the authoritative first location
    let firstLoc = null;
    let firstDoc = null;
    // Prefer subSampleNumber === 1 when available
    for (const d of existingSamples.docs) {
      const data = d.data();
      if (data && data.subSampleNumber === 1) {
        firstDoc = data;
        break;
      }
    }
    // Fallback: use earliest by date
    if (!firstDoc) {
      firstDoc = existingSamples.docs
        .map(d => d.data())
        .filter(Boolean)
        .sort((a, b) => {
          const ad = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
          const bd = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
          return ad - bd;
        })[0];
    }
    firstLoc = firstDoc?.location || "";
    locationToUse = typeof firstLoc === 'string' ? firstLoc : (firstLoc || "");
  }

  await setDoc(doc(db, "samples", finalSampleId), {
    SID: finalSampleId,                      // "SID-BA17695698563_1"
    baseBarcode: barcode,                    // "BA17695698563" (without SID- prefix)
    baseSampleId: baseSampleId,              // "SID-BA17695698563"
    sampleType: sampleType,                  // "Blood, Urine, Tissue, etc."
    driver: driverId,                        // "DID-xxxx" 
    driverName: driverName,                  // "Your Name"
    date: serverTimestamp(),                 // timestamp
    location: locationToUse,                 // First scan's location for all sub-samples
    subSampleNumber: nextNumber,             // 1, 2, 3, etc.
    isSubSample: true                        // All are sub-samples now
  });

  console.log("Sample saved successfully!");
  console.log("Final Sample ID:", finalSampleId);
}

export default Scanner;
