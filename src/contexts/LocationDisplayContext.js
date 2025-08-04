import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';

const LocationDisplayContext = createContext();

export const useLocationDisplay = () => {
  const context = useContext(LocationDisplayContext);
  if (!context) {
    throw new Error('useLocationDisplay must be used within a LocationDisplayProvider');
  }
  return context;
};

export const LocationDisplayProvider = ({ children }) => {
  const [driverLocationStates, setDriverLocationStates] = useState({});
  const [currentUserLocationState, setCurrentUserLocationState] = useState(false);

  // Listen to location display states for all drivers
  useEffect(() => {
    let unsubscribe = null;
    
    try {
      unsubscribe = onSnapshot(
      collection(db, 'driver'),
      (snapshot) => {
          try {
        const states = {};
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          states[doc.id] = {
            showLocation: data.showLocation || false,
            networkStatus: data.networkStatus || 'offline',
            lastLocationUpdate: data.lastLocationUpdate,
            userId: data.userId,
            name: data.name
          };
        });
        setDriverLocationStates(states);
          } catch (error) {
            console.error('Error processing driver location states:', error);
          }
      },
      (error) => {
        console.error('Error listening to driver location states:', error);
      }
    );
    } catch (error) {
      console.error('Error setting up driver location listener:', error);
    }

    return () => {
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (error) {
          console.error('Error unsubscribing from driver location listener:', error);
        }
      }
    };
  }, []);

  // Check if current user's location should be shown - FIXED: removed circular dependency
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    let unsubscribe = null;
    
    try {
      unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (docSnapshot) => {
          try {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          // Check if user is a driver and their location should be shown
          const driverStates = Object.values(driverLocationStates);
          const currentDriver = driverStates.find(
            driver => driver.userId === userData.userId
          );
          setCurrentUserLocationState(currentDriver?.showLocation || false);
            }
          } catch (error) {
            console.error('Error processing current user location state:', error);
        }
      },
      (error) => {
        console.error('Error listening to current user location state:', error);
      }
    );
    } catch (error) {
      console.error('Error setting up current user location listener:', error);
    }

    return () => {
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (error) {
          console.error('Error unsubscribing from current user location listener:', error);
        }
      }
    };
  }, []); // Removed driverLocationStates dependency to fix circular dependency

  const startLocationTracking = async (driverId) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');

      // Find driver document
      const driverCol = collection(db, 'driver');
      const q = query(driverCol, where('authUid', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) throw new Error('Driver not found');
      
      const driverDocRef = querySnapshot.docs[0].ref;
      
      // Update driver to show location - don't change network status
      await updateDoc(driverDocRef, {
        showLocation: true,
        lastLocationUpdate: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      return false;
    }
  };

  const stopLocationTracking = async (driverId) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');

      // Find driver document
      const driverCol = collection(db, 'driver');
      const q = query(driverCol, where('authUid', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) throw new Error('Driver not found');
      
      const driverDocRef = querySnapshot.docs[0].ref;
      
      // Update driver to hide location - don't change network status
      await updateDoc(driverDocRef, {
        showLocation: false,
        lastLocationUpdate: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error stopping location tracking:', error);
      return false;
    }
  };

  const shouldShowDriverLocation = (driverId) => {
    const driverState = driverLocationStates[driverId];
    return driverState?.showLocation === true && driverState?.networkStatus === 'online';
  };

  const getVisibleDrivers = (drivers) => {
    return drivers.filter(driver => {
      const driverId = driver.id || driver.userId;
      return shouldShowDriverLocation(driverId);
    });
  };

  const value = {
    driverLocationStates,
    currentUserLocationState,
    startLocationTracking,
    stopLocationTracking,
    shouldShowDriverLocation,
    getVisibleDrivers
  };

  return (
    <LocationDisplayContext.Provider value={value}>
      {children}
    </LocationDisplayContext.Provider>
  );
}; 