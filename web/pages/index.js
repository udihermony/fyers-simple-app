import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// Add CSS animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [quotes, setQuotes] = useState(null);
  const [qLoading, setQLoading] = useState(false);
  const [symbols, setSymbols] = useState("NSE:SBIN-EQ,NSE:TCS-EQ");
  const [holdings, setHoldings] = useState(null);
  const [hLoading, setHLoading] = useState(false);

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
    setHoldings(null);
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

  function fmt(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return "-";
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function color(pl) {
    return Number(pl) > 0 ? "#0a0" : Number(pl) < 0 ? "#c00" : "#444";
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

  const fetchHoldings = async () => {
    setHLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/holdings`, { credentials: "include" });
      if (res.ok) {
        setHoldings(await res.json());
      } else {
        setHoldings({ error: "Failed to fetch holdings" });
      }
    } catch (e) {
      setHoldings({ error: "Network error" });
    } finally {
      setHLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      padding: "20px"
    }}>
      <div style={{
        maxWidth: 800,
        margin: "0 auto",
        background: "rgba(255, 255, 255, 0.95)",
        borderRadius: 20,
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
        backdropFilter: "blur(10px)",
        padding: "40px",
        minHeight: "calc(100vh - 40px)"
      }}>
        <div style={{
          textAlign: "center",
          marginBottom: 40
        }}>
          <h1 style={{ 
            fontSize: 32, 
            fontWeight: 700,
            margin: 0,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text"
          }}>Fyers Trading App</h1>
          <p style={{
            color: "#666",
            fontSize: 16,
            margin: "8px 0 0 0"
          }}>Your complete trading dashboard</p>
        </div>
        {loading ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px"
          }}>
            <div style={{
              width: 40,
              height: 40,
              border: "4px solid #f3f3f3",
              borderTop: "4px solid #667eea",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 20px"
            }}></div>
            <p style={{ color: "#666", fontSize: 16 }}>Checking session...</p>
          </div>
        ) : profile ? (
          <div>
            <div style={{
              background: "linear-gradient(135deg, #f8f9ff 0%, #f0f2ff 100%)",
              border: "1px solid #e1e5ff",
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
              boxShadow: "0 4px 12px rgba(102, 126, 234, 0.1)"
            }}>
              <h2 style={{ 
                fontSize: 20, 
                marginTop: 0, 
                marginBottom: 20,
                color: "#333",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8
              }}>
                👤 Your Profile
              </h2>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "140px 1fr", 
                rowGap: 12, 
                columnGap: 16,
                fontSize: 14
              }}>
                <div style={{ fontWeight: 600, color: "#555" }}>FY ID</div>
                <div style={{ color: "#333" }}>{profile?.data?.fy_id}</div>
                <div style={{ fontWeight: 600, color: "#555" }}>Name</div>
                <div style={{ color: "#333" }}>{profile?.data?.name}</div>
                <div style={{ fontWeight: 600, color: "#555" }}>Email</div>
                <div style={{ color: "#333" }}>{maskEmail(profile?.data?.email_id)}</div>
                <div style={{ fontWeight: 600, color: "#555" }}>Mobile</div>
                <div style={{ color: "#333" }}>{maskMobile(profile?.data?.mobile_number)}</div>
                <div style={{ fontWeight: 600, color: "#555" }}>TOTP</div>
                <div style={{ 
                  color: profile?.data?.totp ? "#10b981" : "#ef4444",
                  fontWeight: 500
                }}>
                  {profile?.data?.totp ? "✅ Enabled" : "❌ Disabled"}
                </div>
                <div style={{ fontWeight: 600, color: "#555" }}>DDPI</div>
                <div style={{ 
                  color: profile?.data?.ddpi_enabled ? "#10b981" : "#ef4444",
                  fontWeight: 500
                }}>
                  {profile?.data?.ddpi_enabled ? "✅ Enabled" : "❌ Disabled"}
                </div>
                <div style={{ fontWeight: 600, color: "#555" }}>MTF</div>
                <div style={{ 
                  color: profile?.data?.mtf_enabled ? "#10b981" : "#ef4444",
                  fontWeight: 500
                }}>
                  {profile?.data?.mtf_enabled ? "✅ Enabled" : "❌ Disabled"}
                </div>
              </div>
              <details style={{ 
                marginTop: 20,
                padding: 12,
                background: "#f8f9fa",
                borderRadius: 8,
                border: "1px solid #e9ecef"
              }}>
                <summary style={{ 
                  cursor: "pointer", 
                  fontWeight: 500,
                  color: "#667eea"
                }}>Show raw JSON</summary>
                <pre style={{ 
                  whiteSpace: "pre-wrap", 
                  marginTop: 12,
                  fontSize: 12,
                  color: "#666",
                  background: "#fff",
                  padding: 12,
                  borderRadius: 6,
                  border: "1px solid #e9ecef"
                }}>{JSON.stringify(profile, null, 2)}</pre>
              </details>
            </div>
            
            <div style={{ 
              background: "linear-gradient(135deg, #fff5f5 0%, #fef2f2 100%)",
              border: "1px solid #fecaca",
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
              boxShadow: "0 4px 12px rgba(239, 68, 68, 0.1)"
            }}>
              <h2 style={{ 
                fontSize: 20, 
                marginTop: 0, 
                marginBottom: 20,
                color: "#333",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8
              }}>
                📈 Market Quotes
              </h2>
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <input
                  value={symbols}
                  onChange={e => setSymbols(e.target.value)}
                  style={{ 
                    flex: 1, 
                    padding: "12px 16px", 
                    border: "2px solid #e5e7eb", 
                    borderRadius: 12,
                    fontSize: 14,
                    outline: "none",
                    transition: "border-color 0.2s",
                    background: "#fff"
                  }}
                  placeholder="Comma-separated symbols e.g. NSE:SBIN-EQ,NSE:TCS-EQ"
                  onFocus={(e) => e.target.style.borderColor = "#667eea"}
                  onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
                />
                <button 
                  onClick={fetchQuotes} 
                  disabled={qLoading} 
                  style={{ 
                    padding: "12px 20px", 
                    borderRadius: 12,
                    border: "none",
                    background: qLoading ? "#9ca3af" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: qLoading ? "not-allowed" : "pointer",
                    fontSize: 14,
                    transition: "all 0.2s",
                    boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)"
                  }}
                >
                  {qLoading ? "⏳ Loading..." : "📊 Get Quotes"}
                </button>
              </div>
              {quotes && (
                <div style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: 16,
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                  color: "#374151",
                  overflow: "auto",
                  maxHeight: 300
                }}>
                  <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(quotes, null, 2)}</pre>
                </div>
              )}
            </div>
            <div style={{ 
              background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
              border: "1px solid #bbf7d0",
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
              boxShadow: "0 4px 12px rgba(34, 197, 94, 0.1)"
            }}>
              <h2 style={{ 
                fontSize: 20, 
                marginTop: 0, 
                marginBottom: 20,
                color: "#333",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8
              }}>
                💼 Portfolio Holdings
              </h2>
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <button 
                  onClick={fetchHoldings} 
                  disabled={hLoading} 
                  style={{ 
                    padding: "12px 20px", 
                    borderRadius: 12,
                    border: "none",
                    background: hLoading ? "#9ca3af" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: hLoading ? "not-allowed" : "pointer",
                    fontSize: 14,
                    transition: "all 0.2s",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)"
                  }}
                >
                  {hLoading ? "⏳ Loading..." : "💼 Get Holdings"}
                </button>
              </div>
              {holdings?.error && (
                <div style={{ 
                  color: "#dc2626", 
                  background: "#fef2f2",
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #fecaca",
                  marginBottom: 16
                }}>
                  ❌ {holdings.error}
                </div>
              )}

              {holdings && holdings.s === "ok" && (
                <div>
                  {/* Overall summary */}
                  <div style={{ 
                    background: "#fff",
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 20,
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)"
                  }}>
                    <h3 style={{ 
                      fontSize: 16, 
                      fontWeight: 600, 
                      margin: "0 0 16px 0",
                      color: "#374151"
                    }}>📊 Portfolio Summary</h3>
                    <div style={{ 
                      display: "grid", 
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
                      gap: 16
                    }}>
                      <div style={{ textAlign: "center", padding: 12 }}>
                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Total Holdings</div>
                        <div style={{ fontSize: 18, fontWeight: 600, color: "#374151" }}>
                          {holdings.count_total ?? holdings.data?.count_total ?? "-"}
                        </div>
                      </div>
                      <div style={{ textAlign: "center", padding: 12 }}>
                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Total Investment</div>
                        <div style={{ fontSize: 18, fontWeight: 600, color: "#374151" }}>
                          ₹{fmt(holdings.total_investment ?? holdings.data?.total_investment)}
                        </div>
                      </div>
                      <div style={{ textAlign: "center", padding: 12 }}>
                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Current Value</div>
                        <div style={{ fontSize: 18, fontWeight: 600, color: "#374151" }}>
                          ₹{fmt(holdings.total_current_value ?? holdings.data?.total_current_value)}
                        </div>
                      </div>
                      <div style={{ textAlign: "center", padding: 12 }}>
                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Total P/L</div>
                        <div style={{ 
                          fontSize: 18, 
                          fontWeight: 600, 
                          color: color(holdings.total_pl ?? holdings.data?.total_pl)
                        }}>
                          ₹{fmt(holdings.total_pl ?? holdings.data?.total_pl)}
                          {(() => {
                            const p = holdings.pnl_perc ?? holdings.data?.pnl_perc;
                            return p === undefined ? "" : ` (${fmt(p)}%)`;
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* List of individual holdings */}
                  {(holdings.holdings ?? holdings.data?.holdings ?? []).length > 0 && (
                    <div style={{
                      background: "#fff",
                      borderRadius: 12,
                      padding: 20,
                      border: "1px solid #e5e7eb",
                      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)"
                    }}>
                      <h3 style={{ 
                        fontSize: 16, 
                        fontWeight: 600, 
                        margin: "0 0 16px 0",
                        color: "#374151"
                      }}>📋 Individual Holdings</h3>
                      <div style={{ 
                        fontSize: 12, 
                        color: "#6b7280", 
                        marginBottom: 12,
                        fontWeight: 500,
                        display: "grid",
                        gridTemplateColumns: "2fr repeat(6, 1fr)",
                        columnGap: 12,
                        padding: "8px 0",
                        borderBottom: "1px solid #e5e7eb"
                      }}>
                        <div>Symbol</div><div>Qty</div><div>RemQty</div><div>AvgCost</div><div>LTP</div><div>MktVal</div><div>P/L</div>
                      </div>
                      <div style={{ display: "grid", rowGap: 8 }}>
                        {(holdings.holdings ?? holdings.data?.holdings ?? []).map((h, index) => (
                          <div 
                            key={h.id ?? h.fytoken ?? h.symbol ?? index} 
                            style={{ 
                              display: "grid", 
                              gridTemplateColumns: "2fr repeat(6, 1fr)", 
                              columnGap: 12, 
                              alignItems: "center",
                              padding: "8px 0",
                              borderBottom: index < (holdings.holdings ?? holdings.data?.holdings ?? []).length - 1 ? "1px solid #f3f4f6" : "none"
                            }}
                          >
                            <div title={h.symbol} style={{ fontWeight: 500, color: "#374151" }}>{h.symbol}</div>
                            <div style={{ color: "#6b7280" }}>{fmt(h.quantity)}</div>
                            <div style={{ color: "#6b7280" }}>{fmt(h.remainingQuantity)}</div>
                            <div style={{ color: "#6b7280" }}>₹{fmt(h.costPrice)}</div>
                            <div style={{ color: "#6b7280" }}>₹{fmt(h.ltp)}</div>
                            <div style={{ color: "#6b7280" }}>₹{fmt(h.marketVal)}</div>
                            <div style={{ color: color(h.pl), fontWeight: 500 }}>₹{fmt(h.pl)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw JSON toggle */}
                  <details style={{ 
                    marginTop: 20,
                    padding: 12,
                    background: "#f8f9fa",
                    borderRadius: 8,
                    border: "1px solid #e9ecef"
                  }}>
                    <summary style={{ 
                      cursor: "pointer", 
                      fontWeight: 500,
                      color: "#10b981"
                    }}>Show raw JSON</summary>
                    <pre style={{ 
                      whiteSpace: "pre-wrap", 
                      marginTop: 12,
                      fontSize: 12,
                      color: "#666",
                      background: "#fff",
                      padding: 12,
                      borderRadius: 6,
                      border: "1px solid #e9ecef"
                    }}>{JSON.stringify(holdings, null, 2)}</pre>
                  </details>
                </div>
              )}
          </div>
            <div style={{
              textAlign: "center",
              marginTop: 32
            }}>
              <button onClick={logout} style={{
                padding: "12px 24px",
                borderRadius: 12,
                border: "none",
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
                transition: "all 0.2s",
                boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)"
              }}>
                🚪 Logout
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: "center",
            padding: "60px 20px"
          }}>
            <div style={{
              fontSize: 48,
              marginBottom: 24
            }}>🚀</div>
            <h2 style={{
              fontSize: 24,
              fontWeight: 600,
              color: "#374151",
              margin: "0 0 12px 0"
            }}>Welcome to Fyers Trading</h2>
            <p style={{
              color: "#6b7280",
              fontSize: 16,
              margin: "0 0 32px 0",
              lineHeight: 1.5
            }}>
              Access your trading dashboard, view market quotes, and manage your portfolio holdings.
            </p>
            <button onClick={login} style={{
              padding: "16px 32px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 16,
              transition: "all 0.2s",
              boxShadow: "0 8px 20px rgba(102, 126, 234, 0.4)"
            }}>
              🔐 Login with Fyers
            </button>
          </div>
        )}
        
        <footer style={{ 
          textAlign: "center",
          marginTop: 60, 
          padding: "20px 0",
          borderTop: "1px solid #e5e7eb",
          color: "#9ca3af", 
          fontSize: 14 
        }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Fyers Trading App</strong> • OAuth + Profile + Quotes + Holdings
          </div>
          <div>
            Deployed on Railway + Vercel • Built with Next.js + Express
          </div>
        </footer>
      </div>
    </div>
  );
}
