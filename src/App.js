import React from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Signup from "./components/Pages/Signup";
import Login from "./components/Pages/Login";
import FrontPage from "./components/Pages/FrontPage";
import LocationTracker from "./components/AdminDashboard/LocationTracker";
import Scanner from "./components/DriverDashboard/Scanner";
import UserTypeSelection from "./components/Pages/UserTypeSelect";
import IT from "./components/Pages/IT";
import ItLogin from "./components/Pages/ItLogin";
import ItSignup from "./components/Pages/ItSignup";
import Resignated from "./components/Pages/Resignated";
import DriverSampleScan from "./components/Pages/DriverSampleScan";

function App() {
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
