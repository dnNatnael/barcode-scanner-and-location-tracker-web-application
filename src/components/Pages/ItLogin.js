import React, { useState, useEffect } from "react";
import "../styles/Login.css";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../../firebase";

const ItLogin = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);
  const navigate = useNavigate();

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
      // First, check if the email exists in the IT collection
      const normalizedEmail = form.email.trim().toLowerCase();
      const itRef = collection(db, "it");
      const itSnapshot = await getDocs(query(itRef, where("email", "==", normalizedEmail)));
      
      // Check if email exists in IT collection
      if (itSnapshot.empty) {
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
      
      // Check if user exists in 'it' collection
      const itDoc = itSnapshot.docs[0].data();
      if (itDoc.approved === null || typeof itDoc.approved === 'undefined') {
        setError("You are not approved yet.");
      } else if (itDoc.approved === false) {
        setError("You are rejected by the supervisor");
      } else if (itDoc.approved === true) {
        navigate("/it");
      } else {
        setError("Approval status unknown. Please contact admin.");
      }
      setLoading(false);
      return;
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
                onClick={() => !cooldownActive && setShowPassword(!showPassword)}
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
            <p className="signin">Don't have an account? <a href="#" onClick={e => {e.preventDefault();navigate('/it-signup')}}>Sign Up</a></p>
          </form>
        </div>
        {/* Auth access container with text and button */}
        <div className="auth-access-container">
          <p className="auth-text">
            IT Access Only!
          </p>
          <button
            className="button it-btn"
            onClick={() => navigate('/login')}
            type="button"
            style={{ paddingLeft: '16px', paddingRight: '16px' }}
          >
            <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-4.28 10.28a.75.75 0 010-1.06l3-3a.75.75 0 011.06 1.06l-1.72 1.72H15.75a.75.75 0 010 1.5h-5.69l1.72 1.72a.75.75 0 01-1.06 1.06l-3-3z"
                clipRule="evenodd"
              ></path>
            </svg>
            Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItLogin;
