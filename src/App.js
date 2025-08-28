import React from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
import Signup from "./components/Pages/Signup";
import Login from "./components/Pages/Login";
import LocationTracker from "./components/AdminDashboard/LocationTracker";
import Scanner from "./components/DriverDashboard/Scanner";
import IT from "./components/Pages/IT";
import ItLoginSignup from "./components/Pages/ItLoginSignup";
import ItLogin from "./components/Pages/ItLogin";
import ItSignup from "./components/Pages/ItSignup";
import Resignated from "./components/Pages/Resignated";
import DriverSampleScan from "./components/Pages/DriverSampleScan";
import DriverView from "./components/Pages/DriverView";
import AdminView from "./components/Pages/AdminView";
import Scan from "./components/Pages/Scan";
import NetworkStatus from "./components/Pages/NetworkStatus";
import DriversList from "./components/Pages/DriversList";
import Samples from "./components/Pages/Samples";
import OneDriver from "./components/AdminDashboard/OneDriver";
import { LocationDisplayProvider } from "./contexts/LocationDisplayContext";
import { getDoc, doc, collection, addDoc, setDoc, serverTimestamp, runTransaction, query, orderBy, onSnapshot } from "firebase/firestore";

function App() {
  const navigate = useNavigate();
  return (
    <LocationDisplayProvider>
      <div className="whole-pages">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/it" element={<IT />} />
          <Route path="/it-login" element={<ItLogin />} />
          <Route path="/it-signup" element={<ItSignup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/network-status" element={<NetworkStatus />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/admin-dashboard" element={<LocationTracker />} />
          <Route path="/driver-dashboard" element={<Scanner />} />
          <Route path="/resignated" element={<Resignated />} />
          <Route path="/driver-sample-scan" element={<DriverSampleScan />} />
          <Route path="/driver-view" element={<DriverView />} />
          <Route path="/admin-view" element={<AdminView />} />
          <Route path="/drivers-list" element={<DriversList />} />
          <Route path="/samples" element={<Samples />} />
          <Route path="/one-driver" element={<OneDriver />} />
        </Routes>
      </div>
    </LocationDisplayProvider>
  );
}

export default App;
