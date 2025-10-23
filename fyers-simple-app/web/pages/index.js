import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const fetchMe = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/me`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else {
        setProfile(null);
      }
    } catch (e) {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const login = () => {
    window.location.href = `${API_BASE}/auth/login`;
  };

  const logout = async () => {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
    setProfile(null);
  };

  return (
    <div style={{
      maxWidth: 640,
      margin: "40px auto",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      padding: "0 16px"
    }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Fyers Simple App</h1>
      {loading ? (
        <p>Checking session...</p>
      ) : profile ? (
        <div>
          <div style={{
            background: "#fafafa",
            border: "1px solid #eee",
            borderRadius: 8,
            padding: 16,
            marginBottom: 16
          }}>
            <h2 style={{ fontSize: 18, marginTop: 0 }}>Your Profile</h2>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(profile, null, 2)}
            </pre>
          </div>
          <button onClick={logout} style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer"
          }}>Logout</button>
        </div>
      ) : (
        <div>
          <p>Welcome! Log in to view your Fyers profile.</p>
          <button onClick={login} style={{
            padding: "10px 14px",
            borderRadius: 6,
            border: "1px solid #222",
            background: "#111",
            color: "#fff",
            cursor: "pointer"
          }}>
            Login with Fyers
          </button>
        </div>
      )}
      <footer style={{ marginTop: 40, color: "#777", fontSize: 12 }}>
        Minimal UI • OAuth + Profile • Deployed on Railway + Vercel
      </footer>
    </div>
  );
}
