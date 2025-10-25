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

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [quotes, setQuotes] = useState(null);
  const [qLoading, setQLoading] = useState(false);
  const [symbols, setSymbols] = useState("NSE:SBIN-EQ,NSE:TCS-EQ");
  const [holdings, setHoldings] = useState(null);
  const [hLoading, setHLoading] = useState(false);
  const [funds, setFunds] = useState(null);
  const [fLoading, setFLoading] = useState(false);

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

  const fetchQuotes = async () => {
    setQLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/quotes?symbols=${encodeURIComponent(symbols)}`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setQuotes(data);
      } else {
        setQuotes(null);
      }
    } catch (e) {
      setQuotes(null);
    } finally {
      setQLoading(false);
    }
  };

  const fetchHoldings = async () => {
    setHLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/holdings`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setHoldings(data);
      } else {
        setHoldings(null);
      }
    } catch (e) {
      setHoldings(null);
    } finally {
      setHLoading(false);
    }
  };

  const fetchFunds = async () => {
    setFLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/funds`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setFunds(data);
      } else {
        setFunds(null);
      }
    } catch (e) {
      setFunds(null);
    } finally {
      setFLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
      setProfile(null);
      setQuotes(null);
      setHoldings(null);
      setFunds(null);
    } catch (e) {
      console.error("Logout error", e);
    }
  };

  const fmt = (v) => {
    if (typeof v !== "number") return v;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2
    }).format(v);
  };

  const color = (v) => {
    if (typeof v !== "number") return "#666";
    return v >= 0 ? "#10b981" : "#ef4444";
  };

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{
          width: "40px",
          height: "40px",
          border: "4px solid rgba(255,255,255,0.3)",
          borderTop: "4px solid white",
          borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }}></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{
          maxWidth: "600px",
          margin: "0 auto",
          background: "rgba(255, 255, 255, 0.95)",
          borderRadius: "20px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
          backdropFilter: "blur(10px)",
          padding: "40px",
          textAlign: "center"
        }}>
          <h1 style={{
            fontSize: "2.5rem",
            fontWeight: "700",
            background: "linear-gradient(135deg, #667eea, #764ba2)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: "20px"
          }}>
            Fyers Trading Dashboard
          </h1>
          <p style={{
            fontSize: "1.2rem",
            color: "#666",
            marginBottom: "30px",
            lineHeight: "1.6"
          }}>
            Connect your Fyers account to access your trading data
          </p>
          <a
            href={`${API_BASE}/auth/login`}
            style={{
              display: "inline-block",
              padding: "15px 30px",
              background: "linear-gradient(135deg, #667eea, #764ba2)",
              color: "white",
              textDecoration: "none",
              borderRadius: "50px",
              fontSize: "1.1rem",
              fontWeight: "600",
              boxShadow: "0 10px 20px rgba(102, 126, 234, 0.3)",
              transition: "transform 0.2s ease"
            }}
            onMouseOver={(e) => e.target.style.transform = "translateY(-2px)"}
            onMouseOut={(e) => e.target.style.transform = "translateY(0)"}
          >
            Login with Fyers
          </a>
        </div>
        <div style={{
          position: "fixed",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.8)",
          fontSize: "0.9rem"
        }}>
          Secure OAuth 2.0 Authentication
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      padding: "20px"
    }}>
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        background: "rgba(255, 255, 255, 0.95)",
        borderRadius: "20px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
        backdropFilter: "blur(10px)",
        padding: "30px"
      }}>
        {/* Header */}
        <div style={{
          textAlign: "center",
          marginBottom: "30px"
        }}>
          <h1 style={{
            fontSize: "2.5rem",
            fontWeight: "700",
            background: "linear-gradient(135deg, #667eea, #764ba2)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: "10px"
          }}>
            Trading Profile
          </h1>
          <p style={{
            color: "#666",
            fontSize: "1.1rem"
          }}>
            Manage your Fyers account and trading data
          </p>
        </div>

        {/* Profile Card */}
        <div style={{
          background: "linear-gradient(135deg, #f8fafc, #e2e8f0)",
          border: "1px solid #e2e8f0",
          borderRadius: "15px",
          padding: "25px",
          marginBottom: "30px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.05)"
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: "20px",
            alignItems: "center"
          }}>
            <div style={{
              width: "60px",
              height: "60px",
              background: "linear-gradient(135deg, #667eea, #764ba2)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "1.5rem",
              fontWeight: "bold"
            }}>
              {profile.name ? profile.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div>
              <h3 style={{
                margin: "0 0 5px 0",
                fontSize: "1.3rem",
                color: "#1e293b"
              }}>
                {profile.name || "Fyers User"}
              </h3>
              <p style={{
                margin: "0",
                color: "#64748b",
                fontSize: "0.95rem"
              }}>
                {profile.email || "No email"}
              </p>
              <p style={{
                margin: "5px 0 0 0",
                color: "#10b981",
                fontSize: "0.9rem",
                fontWeight: "600"
              }}>
                ✓ Connected to Fyers
              </p>
            </div>
            <button
              onClick={logout}
              style={{
                padding: "10px 20px",
                background: "linear-gradient(135deg, #ef4444, #dc2626)",
                color: "white",
                border: "none",
                borderRadius: "25px",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "600",
                boxShadow: "0 4px 6px rgba(239, 68, 68, 0.3)"
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Quotes Card */}
        <div style={{
          background: "linear-gradient(135deg, #f8fafc, #e2e8f0)",
          border: "1px solid #e2e8f0",
          borderRadius: "15px",
          padding: "25px",
          marginBottom: "30px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.05)"
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "20px"
          }}>
            <div style={{
              width: "40px",
              height: "40px",
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: "15px"
            }}>
              <span style={{ color: "white", fontSize: "1.2rem" }}>📈</span>
            </div>
            <h3 style={{
              margin: "0",
              fontSize: "1.3rem",
              color: "#1e293b"
            }}>
              Market Quotes
            </h3>
          </div>
          
          <div style={{
            display: "flex",
            gap: "15px",
            marginBottom: "20px",
            flexWrap: "wrap"
          }}>
            <input
              type="text"
              value={symbols}
              onChange={(e) => setSymbols(e.target.value)}
              placeholder="Enter symbols (comma-separated)"
              style={{
                flex: "1",
                minWidth: "300px",
                padding: "12px 15px",
                border: "2px solid #e2e8f0",
                borderRadius: "10px",
                fontSize: "0.95rem",
                outline: "none",
                transition: "border-color 0.2s ease"
              }}
              onFocus={(e) => e.target.style.borderColor = "#667eea"}
              onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
            />
            <button
              onClick={fetchQuotes}
              disabled={qLoading}
              style={{
                padding: "12px 25px",
                background: qLoading ? "#94a3b8" : "linear-gradient(135deg, #667eea, #764ba2)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                cursor: qLoading ? "not-allowed" : "pointer",
                fontSize: "0.95rem",
                fontWeight: "600",
                boxShadow: "0 4px 6px rgba(102, 126, 234, 0.3)",
                minWidth: "120px"
              }}
            >
              {qLoading ? "Loading..." : "Get Quotes"}
            </button>
          </div>

          {quotes && (
            <div style={{
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "20px",
              maxHeight: "400px",
              overflowY: "auto"
            }}>
              <pre style={{
                margin: "0",
                fontSize: "0.85rem",
                color: "#374151",
                whiteSpace: "pre-wrap",
                fontFamily: "Monaco, 'Courier New', monospace"
              }}>
                {JSON.stringify(quotes, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Holdings Card */}
        <div style={{
          background: "linear-gradient(135deg, #f8fafc, #e2e8f0)",
          border: "1px solid #e2e8f0",
          borderRadius: "15px",
          padding: "25px",
          marginBottom: "30px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.05)"
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px"
          }}>
            <div style={{
              display: "flex",
              alignItems: "center"
            }}>
              <div style={{
                width: "40px",
                height: "40px",
                background: "linear-gradient(135deg, #10b981, #059669)",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "15px"
              }}>
                <span style={{ color: "white", fontSize: "1.2rem" }}>💼</span>
              </div>
              <h3 style={{
                margin: "0",
                fontSize: "1.3rem",
                color: "#1e293b"
              }}>
                Holdings
              </h3>
            </div>
            <button
              onClick={fetchHoldings}
              disabled={hLoading}
              style={{
                padding: "10px 20px",
                background: hLoading ? "#94a3b8" : "linear-gradient(135deg, #10b981, #059669)",
                color: "white",
                border: "none",
                borderRadius: "25px",
                cursor: hLoading ? "not-allowed" : "pointer",
                fontSize: "0.9rem",
                fontWeight: "600",
                boxShadow: "0 4px 6px rgba(16, 185, 129, 0.3)"
              }}
            >
              {hLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {holdings && (
            <div>
              {holdings.error ? (
                <div style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "10px",
                  padding: "15px",
                  color: "#dc2626",
                  fontSize: "0.9rem"
                }}>
                  Error: {holdings.error}
                </div>
              ) : (
                <div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "15px",
                    marginBottom: "20px"
                  }}>
                    <div style={{
                      background: "white",
                      padding: "15px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0"
                    }}>
                      <div style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "5px" }}>Total Value</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: "600", color: "#1e293b" }}>
                        {fmt(holdings.total_value || 0)}
                      </div>
                    </div>
                    <div style={{
                      background: "white",
                      padding: "15px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0"
                    }}>
                      <div style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "5px" }}>P&L</div>
                      <div style={{ 
                        fontSize: "1.2rem", 
                        fontWeight: "600", 
                        color: color(holdings.total_pnl || 0) 
                      }}>
                        {fmt(holdings.total_pnl || 0)}
                      </div>
                    </div>
                  </div>
                  
                  {holdings.holdings && holdings.holdings.length > 0 && (
                    <div style={{
                      background: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "20px",
                      maxHeight: "400px",
                      overflowY: "auto"
                    }}>
                      <h4 style={{ margin: "0 0 15px 0", color: "#1e293b" }}>Your Holdings</h4>
                      {holdings.holdings.map((h, i) => (
                        <div key={i} style={{
                          padding: "12px",
                          borderBottom: i < holdings.holdings.length - 1 ? "1px solid #f1f5f9" : "none",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}>
                          <div>
                            <div style={{ fontWeight: "600", color: "#1e293b" }}>{h.symbol || "N/A"}</div>
                            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                              Qty: {h.qty || 0} | Avg: {fmt(h.avg_price || 0)}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: "600", color: "#1e293b" }}>
                              {fmt(h.market_value || 0)}
                            </div>
                            <div style={{ 
                              fontSize: "0.85rem", 
                              color: color(h.pnl || 0) 
                            }}>
                              {fmt(h.pnl || 0)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Funds Card */}
        <div style={{
          background: "linear-gradient(135deg, #f8fafc, #e2e8f0)",
          border: "1px solid #e2e8f0",
          borderRadius: "15px",
          padding: "25px",
          marginBottom: "30px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.05)"
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px"
          }}>
            <div style={{
              display: "flex",
              alignItems: "center"
            }}>
              <div style={{
                width: "40px",
                height: "40px",
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "15px"
              }}>
                <span style={{ color: "white", fontSize: "1.2rem" }}>💰</span>
              </div>
              <h3 style={{
                margin: "0",
                fontSize: "1.3rem",
                color: "#1e293b"
              }}>
                Funds
              </h3>
            </div>
            <button
              onClick={fetchFunds}
              disabled={fLoading}
              style={{
                padding: "10px 20px",
                background: fLoading ? "#94a3b8" : "linear-gradient(135deg, #f59e0b, #d97706)",
                color: "white",
                border: "none",
                borderRadius: "25px",
                cursor: fLoading ? "not-allowed" : "pointer",
                fontSize: "0.9rem",
                fontWeight: "600",
                boxShadow: "0 4px 6px rgba(245, 158, 11, 0.3)"
              }}
            >
              {fLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {funds && (
            <div>
              {funds.error ? (
                <div style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "10px",
                  padding: "15px",
                  color: "#dc2626",
                  fontSize: "0.9rem"
                }}>
                  Error: {funds.error}
                </div>
              ) : (
                <div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "15px",
                    marginBottom: "20px"
                  }}>
                    <div style={{
                      background: "white",
                      padding: "15px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0"
                    }}>
                      <div style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "5px" }}>Capital</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: "600", color: "#1e293b" }}>
                        {fmt(funds.capital || 0)}
                      </div>
                    </div>
                    <div style={{
                      background: "white",
                      padding: "15px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0"
                    }}>
                      <div style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "5px" }}>Commodity</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: "600", color: "#1e293b" }}>
                        {fmt(funds.commodity || 0)}
                      </div>
                    </div>
                  </div>
                  
                  {funds.fund_limit && funds.fund_limit.length > 0 && (
                    <div style={{
                      background: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "20px",
                      maxHeight: "400px",
                      overflowY: "auto"
                    }}>
                      <h4 style={{ margin: "0 0 15px 0", color: "#1e293b" }}>Fund Details</h4>
                      {funds.fund_limit.map((f, i) => (
                        <div key={i} style={{
                          padding: "12px",
                          borderBottom: i < funds.fund_limit.length - 1 ? "1px solid #f1f5f9" : "none",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}>
                          <div>
                            <div style={{ fontWeight: "600", color: "#1e293b" }}>{f.symbol || "N/A"}</div>
                            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                              {f.product || "N/A"}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: "600", color: "#1e293b" }}>
                              {fmt(f.limit || 0)}
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                              Used: {fmt(f.used || 0)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          textAlign: "center",
          marginTop: "40px",
          paddingTop: "20px",
          borderTop: "1px solid #e2e8f0",
          color: "#64748b",
          fontSize: "0.9rem"
        }}>
          <p style={{ margin: "0" }}>
            Secure OAuth 2.0 Authentication • Real-time Market Data
          </p>
        </div>
      </div>
    </div>
  );
}
