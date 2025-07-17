import React, { useState } from "react";
import "../Styles/Login.css";
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
  const navigate = useNavigate();
  const location = useLocation();
  const name = location.state?.name || "User";

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
      const user = userCredential.user;

      // 2. Fetch user role and approval status from all collections by email
      const normalizedEmail = form.email.trim().toLowerCase();
      const usersRef = collection(db, "users");
      const adminRef = collection(db, "admin");
      const driverRef = collection(db, "driver");
      const [usersSnap, adminSnap, driverSnap] = await Promise.all([
        getDocs(query(usersRef, where("email", "==", normalizedEmail))),
        getDocs(query(adminRef, where("email", "==", normalizedEmail))),
        getDocs(query(driverRef, where("email", "==", normalizedEmail)))
      ]);
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
        navigate("/driver-dashboard", { state: { name } });
      } else {
        setError("No role assigned. Contact admin.");
      }
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
          <button type="submit" className="login-button">
            Login
          </button>
        </form>
        <div className="nav-switch">
          Don't have an account?{' '}
          <button
            type="button"
            className="switch-btn"
            onClick={() => navigate('/signup')}
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;