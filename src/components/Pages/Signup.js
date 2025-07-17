import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/Signup.css";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../firebase"; // adjust path if needed
 

const Signup = ({ onSignup }) => {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Simple validation
    if (!form.name || !form.email || !form.password) {
      setError("All fields are required.");
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

      // Redirect to login page after successful signup
      navigate('/login');

      // Call parent handler or API here
      onSignup && onSignup(form);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-container">
      <div className="signup-form-container">
        <h1>International Clinical Laboratory</h1>
        {error && <div>{error}</div>}
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={form.name}
            onChange={handleChange}
          />
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
          <button
            type="submit" className="login-button"
          >
            Create Account
          </button>
        </form>
        <div className="nav-switch">
          Already have an account?{' '}
          <button
            type="button"
            className="switch-btn"
            onClick={() => navigate('/login')}
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default Signup;