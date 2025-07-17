import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";

const ItLoginSignup = () => {
  const navigate = useNavigate();
  return (
    <div className="login-container">
      <div className="login-form-container">
        <h1>International Clinical Laboratory</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', alignItems: 'center', marginTop: '2rem' }}>
          <button
            className="login-button"
            style={{ width: '80%' }}
            onClick={() => navigate('/it-login')}
          >
            Login
          </button>
          <button
            className="login-button"
            style={{ width: '80%', background: '#fff', color: '#1c6954', border: '1.5px solid #1c6954' }}
            onClick={() => navigate('/it-signup')}
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItLoginSignup; 