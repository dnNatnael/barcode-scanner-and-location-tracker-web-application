import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/ItSignup.css";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { addDoc, collection, getDocs, setDoc, doc } from "firebase/firestore";
import { auth, db } from "../../firebase";

function padId(num) {
  return num.toString().padStart(4, "0");
}

async function getNextItId() {
  // Get all IT users (including resigned ones) to check for used IDs
  const itSnapshot = await getDocs(collection(db, "it"));
  const usersSnapshot = await getDocs(collection(db, "users"));
  const adminSnapshot = await getDocs(collection(db, "admin"));
  const driverSnapshot = await getDocs(collection(db, "driver"));
  const resignatedSnapshot = await getDocs(collection(db, "resignated"));
  
  const allItUsers = itSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const users = usersSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const admins = adminSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const drivers = driverSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const resignatedUsers = resignatedSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  
  // Combine all users from all collections
  const allUsersCombined = [...allItUsers, ...users, ...admins, ...drivers, ...resignatedUsers];
  
  // Extract all used IDs from all collections
  const usedIds = allUsersCombined
    .map(doc => doc.data?.userId || doc.userId)
    .filter(id => id && id.startsWith("ID-"))
    .map(id => parseInt(id.replace("ID-", "")))
    .filter(n => !isNaN(n));
  
  let next = 1;
  while (usedIds.includes(next)) next++;
  return "ID-" + padId(next);
}

const ItSignup = ({ onSignup }) => {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      setError("All fields are required.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );
      // 2. Generate custom userId for IT
      const customUserId = await getNextItId();
      // 3. Store IT info in Firestore 'it' collection with custom document ID
      const customDocId = `${customUserId}: ${form.name}`;
      await setDoc(doc(db, "it", customDocId), {
        name: form.name,
        email: form.email,
        createdAt: new Date(),
        approved: null,
        userId: customUserId,
        authUid: userCredential.user.uid // Store the Firebase Auth UID for reference
      });
      navigate('/it-login');
      onSignup && onSignup(form);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
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
            type="submit" className="login-button" disabled={loading}
          >
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>
        <div className="nav-switch">
          Already have an account?{' '}
          <button
            type="button"
            className="switch-btn"
            onClick={() => navigate('/it-login')}
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItSignup;
