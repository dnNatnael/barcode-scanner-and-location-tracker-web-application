import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { auth, db } from "../../firebase";
import { getDoc, doc } from "firebase/firestore";

const LocationTracker = () => {
  const location = useLocation();
  const name = location.state?.name || "User";
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const fetchUserId = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setUserId(userDoc.data().userId || "");
        }
      }
    };
    fetchUserId();
  }, []);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Admin Dashboard: Location Tracker</h1>
      <p>Welcome {name}!</p>
      {userId && <p>Your ID: {userId}</p>}
      <p>Here you can track all locations.</p>
    </div>
  );
};

export default LocationTracker;
