import React from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Signup from "./components/Pages/Signup.js";
import Login from "./components/Pages/Login.js";
import FrontPage from "./components/Pages/FrontPage.js";
import LocationTracker from "./components/AdminDashboard/LocationTracker.js";
import Scanner from './components/DriverDashboard/Scanner.js';
import UserTypeSelection from './components/Pages/UserTypeSelect';
import IT from "./components/Pages/IT.js";
import ItLoginSignup from "./components/Pages/ItLoginSignup.js";
import ItLogin from "./components/Pages/ItLogin.js";
import ItSignup from "./components/Pages/ItSignup.js";
import Resignated from "./components/Pages/Resignated.js";
import DriverSampleScan from "./components/Pages/DriverSampleScan.js";
import { getDoc, doc, collection, addDoc, setDoc, serverTimestamp, runTransaction, query, orderBy, onSnapshot } from "firebase/firestore";

function App() {
  const navigate = useNavigate();
  return (
    <div className="whole-pages">
      <Routes>
        <Route path="/" element={<FrontPage />} />
        <Route path="/choose" element={<UserTypeSelection />} />
        <Route path="/it" element={<IT />} />
        <Route path="/it-login" element={<ItLogin />} />
        <Route path="/it-signup" element={<ItSignup />} />
        <Route path="/login" element={<Login onLogin={(data) => alert(JSON.stringify(data))} />} />
        <Route path="/signup" element={<Signup onSignup={(data) => alert(JSON.stringify(data))} />} />
        <Route path="/admin-dashboard" element={<LocationTracker />} />
        <Route path="/driver-dashboard" element={<Scanner />} />
        <Route path="/resignated" element={<Resignated />} />
        <Route path="/driver-sample-scan" element={<DriverSampleScan />} />
      </Routes>
    </div>
  );
}

export default App;
