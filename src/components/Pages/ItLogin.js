import React, { useState } from "react";
import "../Styles/ItLogin.css";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getDocs, collection, query, where } from "firebase/firestore";
import { auth, db } from "../../firebase";

const ItLogin = ({ onLogin }) => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // 1. Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );
      // 2. Check if user exists in 'it' collection
      const q = query(collection(db, "it"), where("email", "==", form.email));
      const itSnapshot = await getDocs(q);
      if (!itSnapshot.empty) {
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
      }
      setError("Your IT account was not found. Please sign up or contact admin.");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-form-container">
        <h1>International Clinical Laboratory</h1>
        {error && <div>{error}</div>}
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
          />
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        <div className="nav-switch">
          Don't have an account?{' '}
          <button
            type="button"
            className="switch-btn"
            onClick={() => navigate('/it-signup')}
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItLogin;
