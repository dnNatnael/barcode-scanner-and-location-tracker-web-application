import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../firebase"; // adjust path if needed
 

const Signup = ({ onSignup }) => {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registrationAttempts, setRegistrationAttempts] = useState(0);
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);
  const navigate = useNavigate();
  const [showItPrompt, setShowItPrompt] = useState(false);
  const [itPassword, setItPassword] = useState("");
  const [itError, setItError] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

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

  // Email validation function
  const validateEmail = (email) => {
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address.";
    }

    // Common valid domains
    const validDomains = [
      'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com',
      'icl.com', 'icl-group.com', 'iclgroup.com', 'icl-group.net',
      'iclgroup.net', 'icl-group.org', 'iclgroup.org'
    ];

    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain || !validDomains.includes(domain)) {
      return "Please enter a valid email address.";
    }

    return null; // Email is valid
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
    
    // Simple validation
    if (!form.name || !form.email || !form.password) {
      setError("All fields are required.");
      return;
    }
    
    // Email validation
    const emailError = validateEmail(form.email);
    if (emailError) {
      setError(emailError);
      return;
    }
    
    // Password matching validation
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    
    setError("");
    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );
      const user = userCredential.user;

      // 2. Store user info in Firestore with custom document ID
      const customDocId = `Pending: ${form.name}`;
      await setDoc(doc(db, "users", customDocId), {
        name: form.name,
        email: form.email,
        role: "role", // default role placeholder
        createdAt: new Date(),
        approved: null,
        userId: null,
        authUid: user.uid // Store the Firebase Auth UID for reference
      });

      // Show success message
      setSuccessMessage("You have registered successfully!");
      setShowSuccessMessage(true);
      
      // Hide success message after 3 seconds and then redirect
      setTimeout(() => {
        setShowSuccessMessage(false);
        setSuccessMessage("");
        navigate('/login');
      }, 3000);

      // Call parent handler or API here
      onSignup && onSignup(form);
    } catch (err) {
      setRegistrationAttempts(prev => prev + 1);
      
      if (err.code === 'auth/email-already-in-use') {
        if (registrationAttempts >= 5) {
          setError("Too many attempts. Please try again later.");
          startCooldown();
        } else {
          setError("This email is already registered. Please log in or use a different email to sign up.");
        }
      } else if (err.code === 'auth/too-many-requests') {
        setError("Too many attempts. Please try again later.");
        startCooldown();
      } else {
      setError(err.message);
      }
    }
  };

  return (
    <div className="auth-root">
      <div className="main-auth-container">
        <div className="left-bg" />
        <div className="right-form">
          <form className="form" onSubmit={handleSubmit}>
            <p className="title">Register </p>
            <div className="flex">
              <label>
                <input
                  className="input"
                  type="text"
                  name="name"
                  placeholder=" "
                  required
                  value={form.name}
                  onChange={handleChange}
                  disabled={cooldownActive}
                />
                <span>Firstname</span>
              </label>
            </div>
            <label>
              <input
                className="input"
                type="email"
                name="email"
                placeholder=" "
                required
                value={form.email}
                onChange={handleChange}
                disabled={cooldownActive}
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
                disabled={cooldownActive}
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
            {/* Confirm password field for UI only, not used in logic */}
            <label className="password-field-container">
              <input
                className="input"
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder=" "
                required
                value={form.confirmPassword || ''}
                onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                disabled={cooldownActive}
              />
              <span>Confirm password</span>
              <div 
                className="password-toggle-icon"
                onClick={() => !cooldownActive && setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
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
            <button className="submit" type="submit" disabled={cooldownActive}>
              {cooldownActive ? 'Please Wait...' : 'Register'}
            </button>
            <p className="signin">Already have an acount ? <a href="#" onClick={e => {e.preventDefault();navigate('/login')}}>Signin</a> </p>
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
                    navigate('/it-signup');
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
      
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}
    </div>
  );
};

export default Signup;