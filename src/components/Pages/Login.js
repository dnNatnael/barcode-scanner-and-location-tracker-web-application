import React, { useState, useEffect } from "react";
import "../styles/Login.css";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getDoc, doc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { useLocation } from "react-router-dom";
import { sendEmailVerification } from "firebase/auth";

const Login = ({ onLogin }) => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const name = location.state?.name || "User";
  const [showItPrompt, setShowItPrompt] = useState(false);
  const [itPassword, setItPassword] = useState("");
  const [itError, setItError] = useState("");

  // Handle cooldown timer
  useEffect(() => {
    let interval;
    if (cooldownActive && cooldownTime > 0) {
      interval = setInterval(() => {
        setCooldownTime(prev => {
          if (prev <= 1) {
            setCooldownActive(false);
            setError("");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [cooldownActive, cooldownTime]);

  const startCooldown = () => {
    setCooldownActive(true);
    setCooldownTime(180); // 3 minutes = 180 seconds
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if cooldown is active
    if (cooldownActive) {
      return;
    }
    
    setLoading(true);
    setError("");
    try {
      // First, check if the email exists in any collection
      const normalizedEmail = form.email.trim().toLowerCase();
      const usersRef = collection(db, "users");
      const adminRef = collection(db, "admin");
      const driverRef = collection(db, "driver");
      const [usersSnap, adminSnap, driverSnap] = await Promise.all([
        getDocs(query(usersRef, where("email", "==", normalizedEmail))),
        getDocs(query(adminRef, where("email", "==", normalizedEmail))),
        getDocs(query(driverRef, where("email", "==", normalizedEmail)))
      ]);
      
      // Check if email exists in any collection
      if (usersSnap.empty && adminSnap.empty && driverSnap.empty) {
        setLoginAttempts(prev => prev + 1);
        if (loginAttempts >= 5) {
          setError("Too many attempts. Please try again later.");
          startCooldown();
        } else {
          setError("No account found with this email. Please check for typos or sign up to create a new account.");
        }
        setLoading(false);
        return;
      }

      // Email exists, now try to sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );
      const user = userCredential.user;

      // Fetch user role and approval status from all collections by email
      let userDoc = null;
      let role = null;
      let approved = null;
      let name = null;
      if (!usersSnap.empty) {
        userDoc = usersSnap.docs[0];
        role = userDoc.data().role;
        approved = userDoc.data().approved;
        name = userDoc.data().name;
      } else if (!adminSnap.empty) {
        userDoc = adminSnap.docs[0];
        role = "admin";
        approved = userDoc.data().approved;
        name = userDoc.data().name;
      } else if (!driverSnap.empty) {
        userDoc = driverSnap.docs[0];
        role = "driver";
        approved = userDoc.data().approved;
        name = userDoc.data().name;
      }
      if (!userDoc) {
        setError("Your access to this website has been revoked.");
        setLoading(false);
        return;
      }
      // 3. Only allow login if approved
      if (approved !== true) {
        setError("Your account is not approved yet. Please contact IT.");
        setLoading(false);
        return;
      }
      // 4. Redirect based on role (case-insensitive) and pass name
      if (role && role.toLowerCase() === "admin") {
        navigate("/admin-dashboard", { state: { name } });
      } else if (role && role.toLowerCase() === "driver") {
        navigate("/network-status", { state: { name } });
      } else {
        setError("No role assigned. Contact admin.");
      }
    } catch (err) {
      setLoginAttempts(prev => prev + 1);
      
      if (err.code === 'auth/invalid-credential') {
        setError("Incorrect password. Please try again.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Too many attempts. Please try again later.");
        startCooldown();
      } else {
        setError(err.message);
      }
    }
    setLoading(false);
  };

  return (
    <div className="auth-root">
      <div className="main-auth-container">
        <div className="left-bg" />
        <div className="right-form">
          <form className="form" onSubmit={handleSubmit}>
            <p className="title">Login</p>
            <label>
              <input
                className="input"
                type="email"
                name="email"
                placeholder=" "
                required
                value={form.email}
                onChange={handleChange}
                disabled={loading || cooldownActive}
              />
              <span>Email</span>
            </label>
            <label className="password-field-container">
              <input
                className="input"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder=" "
                required
                value={form.password}
                onChange={handleChange}
                disabled={loading || cooldownActive}
              />
              <span>Password</span>
              <div 
                className="password-toggle-icon"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                  </svg>
                )}
              </div>
            </label>
            {error && <div style={{ color: 'red', fontSize: 14 }}>{error}</div>}
            <button className="submit" type="submit" disabled={loading || cooldownActive}>
              {cooldownActive ? 'Please Wait...' : 'Login'}
            </button>
            <p className="signin">Don't have an account? <a href="#" onClick={e => {e.preventDefault();navigate('/signup')}}>Sign Up</a></p>
          </form>
        </div>
        {/* Auth access container with text and button */}
        <div className="auth-access-container">
          <p className="auth-text">
            Authorized users only!
          </p>
          <button
            className="button it-btn"
            onClick={() => setShowItPrompt(true)}
            type="button"
          >
            IT
            <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm4.28 10.28a.75.75 0 000-1.06l-3-3a.75.75 0 10-1.06 1.06l1.72 1.72H8.25a.75.75 0 000 1.5h5.69l-1.72 1.72a.75.75 0 101.06 1.06l3-3z"
                clipRule="evenodd"
              ></path>
            </svg>
          </button>
        </div>
      </div>
      {showItPrompt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#222',
            padding: 32,
            borderRadius: 12,
            boxShadow: '0 2px 16px rgba(0,0,0,0.2)',
            minWidth: 300,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <h3 style={{ color: '#fff', marginBottom: 16 }}>Enter IT Access Password</h3>
            <input
              type="password"
              value={itPassword}
              onChange={e => setItPassword(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #555',
                marginBottom: 12,
                width: '100%',
                fontSize: 16
              }}
              placeholder="Password"
              autoFocus
            />
            {itError && <div style={{ color: 'red', marginBottom: 8 }}>{itError}</div>}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="submit"
                style={{ minWidth: 80 }}
                onClick={() => {
                  if (itPassword === '123123') {
                    setShowItPrompt(false);
                    setItPassword("");
                    setItError("");
                    navigate('/it-login');
                  } else {
                    setItError('Incorrect password');
                  }
                }}
                type="button"
              >
                Enter
              </button>
              <button
                className="submit"
                style={{ minWidth: 80, background: '#888' }}
                onClick={() => {
                  setShowItPrompt(false);
                  setItPassword("");
                  setItError("");
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;