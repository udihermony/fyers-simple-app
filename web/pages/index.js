import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [quotes, setQuotes] = useState(null);
  const [qLoading, setQLoading] = useState(false);
  const [symbols, setSymbols] = useState("NSE:SBIN-EQ,NSE:TCS-EQ");

  const fetchMe = async () => {
    setLoading(true);
    try {
      if (!API_BASE) {
        console.error("Missing NEXT_PUBLIC_API_BASE_URL");
      }
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
    setQuotes(null);
  };

  function maskEmail(email) {
    if (!email) return "";
    const [u, d] = email.split("@");
    return (u?.slice(0, 2) || "") + "***@" + (d || "");
  }

  function maskMobile(m) {
    if (!m) return "";
    return m.replace(/\d(?=\d{2})/g, "x");
  }

  const fetchQuotes = async () => {
    setQLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/quotes?symbols=${encodeURIComponent(symbols)}`, {
        credentials: "include"
      });
      if (res.ok) {
        setQuotes(await res.json());
      } else {
        setQuotes({ error: "Failed to fetch quotes" });
      }
    } catch (e) {
      setQuotes({ error: "Network error" });
    } finally {
      setQLoading(false);
    }
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
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 6, columnGap: 8 }}>
              <div>FY ID</div><div>{profile?.data?.fy_id}</div>
              <div>Name</div><div>{profile?.data?.name}</div>
              <div>Email</div><div>{maskEmail(profile?.data?.email_id)}</div>
              <div>Mobile</div><div>{maskMobile(profile?.data?.mobile_number)}</div>
              <div>TOTP</div><div>{profile?.data?.totp ? "Enabled" : "Disabled"}</div>
              <div>DDPI</div><div>{profile?.data?.ddpi_enabled ? "Enabled" : "Disabled"}</div>
              <div>MTF</div><div>{profile?.data?.mtf_enabled ? "Enabled" : "Disabled"}</div>
            </div>
            <details style={{ marginTop: 12 }}>
              <summary>Show raw JSON</summary>
              <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(profile, null, 2)}</pre>
            </details>
          </div>
          <div style={{ marginTop: 16, padding: 16, border: "1px solid #eee", borderRadius: 8 }}>
            <h2 style={{ fontSize: 16, marginTop: 0 }}>Quotes</h2>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                value={symbols}
                onChange={e => setSymbols(e.target.value)}
                style={{ flex: 1, padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
                placeholder="Comma-separated symbols e.g. NSE:SBIN-EQ,NSE:TCS-EQ"
              />
              <button onClick={fetchQuotes} disabled={qLoading} style={{ padding: "8px 12px", borderRadius: 6 }}>
                {qLoading ? "Loading..." : "Get Quotes"}
              </button>
            </div>
            {quotes && (
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(quotes, null, 2)}</pre>
            )}
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
