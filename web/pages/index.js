import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// Add CSS animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    /* Mode Toggle Switch */
    .mode-toggle {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 15px 20px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      margin-bottom: 20px;
    }
    .mode-toggle-label {
      font-weight: 600;
      color: #374151;
      font-size: 14px;
    }
    .switch-container {
      position: relative;
      display: inline-block;
    }
    .mode-switch {
      position: relative;
      display: inline-block;
      width: 60px;
      height: 30px;
    }
    .mode-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .mode-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #e5e7eb;
      transition: 0.4s;
      border-radius: 30px;
    }
    .mode-slider:before {
      position: absolute;
      content: "";
      height: 22px;
      width: 22px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: 0.4s;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .mode-switch input:checked + .mode-slider {
      background: linear-gradient(135deg, #ef4444, #dc2626);
    }
    .mode-switch input:checked + .mode-slider:before {
      transform: translateX(30px);
    }
    .mode-indicator {
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
    .mode-paper {
      background: #dbeafe;
      color: #1e40af;
    }
    .mode-live {
      background: #fee2e2;
      color: #991b1b;
    }
  `;
  document.head.appendChild(style);
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [holdings, setHoldings] = useState(null);
  const [hLoading, setHLoading] = useState(false);
  const [funds, setFunds] = useState(null);
  const [fLoading, setFLoading] = useState(false);
  const [tradingMode, setTradingMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tradingMode') || 'paper';
    }
    return 'paper';
  });

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

  // Auto-fetch holdings and funds when user is authenticated
  useEffect(() => {
    if (profile) {
      fetchHoldings();
      fetchFunds();
    }
  }, [profile]);

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
      setHoldings(null);
      setFunds(null);
    } catch (e) {
      console.error("Logout error", e);
    }
  };

  const handleModeChange = (newMode) => {
    setTradingMode(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tradingMode', newMode);
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
            Connect your Fyers account to access your trading dashboard
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
        maxWidth: "1400px",
        margin: "0 auto",
        background: "rgba(255, 255, 255, 0.95)",
        borderRadius: "20px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
        backdropFilter: "blur(10px)",
        padding: "30px"
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "30px",
          flexWrap: "wrap",
          gap: "20px"
        }}>
          <div>
            <h1 style={{
              fontSize: "2.5rem",
              fontWeight: "700",
              background: "linear-gradient(135deg, #667eea, #764ba2)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: "5px"
            }}>
              Trading Dashboard
            </h1>
            <p style={{
              color: "#666",
              fontSize: "1.1rem",
              margin: "0"
            }}>
              Welcome back, {profile.name || "Trader"}
            </p>
          </div>
          <div style={{
            display: "flex",
            gap: "15px",
            alignItems: "center"
          }}>
            <Link href="/trading">
              <a style={{
                padding: "10px 20px",
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "white",
                textDecoration: "none",
                borderRadius: "25px",
                fontSize: "0.9rem",
                fontWeight: "600",
                boxShadow: "0 4px 6px rgba(16, 185, 129, 0.3)",
                transition: "transform 0.2s ease"
              }}
              onMouseOver={(e) => e.target.style.transform = "translateY(-2px)"}
              onMouseOut={(e) => e.target.style.transform = "translateY(0)"}
              >
                Trading
              </a>
            </Link>
            <Link href="/profile">
              <a style={{
                padding: "10px 20px",
                background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                color: "white",
                textDecoration: "none",
                borderRadius: "25px",
                fontSize: "0.9rem",
                fontWeight: "600",
                boxShadow: "0 4px 6px rgba(59, 130, 246, 0.3)",
                transition: "transform 0.2s ease"
              }}
              onMouseOver={(e) => e.target.style.transform = "translateY(-2px)"}
              onMouseOut={(e) => e.target.style.transform = "translateY(0)"}
              >
                Profile
              </a>
            </Link>
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

        {/* Mode Toggle */}
        <div className="mode-toggle">
          <span className="mode-toggle-label">Trading Mode:</span>
          <div className="switch-container">
            <label className="mode-switch">
              <input 
                type="checkbox" 
                checked={tradingMode === 'live'}
                onChange={(e) => handleModeChange(e.target.checked ? 'live' : 'paper')}
              />
              <span className="mode-slider"></span>
            </label>
          </div>
          <span className={`mode-indicator ${tradingMode === 'paper' ? 'mode-paper' : 'mode-live'}`}>
            {tradingMode === 'paper' ? '📄 PAPER TRADING' : '🔴 LIVE TRADING'}
          </span>
        </div>

        {/* Quick Stats */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "20px",
          marginBottom: "30px"
        }}>
          <div style={{
            background: "linear-gradient(135deg, #10b981, #059669)",
            borderRadius: "15px",
            padding: "25px",
            color: "white",
            boxShadow: "0 8px 16px rgba(16, 185, 129, 0.3)",
            animation: "fadeIn 0.6s ease-out"
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "15px"
            }}>
              <div style={{
                width: "50px",
                height: "50px",
                background: "rgba(255,255,255,0.2)",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "15px"
              }}>
                <span style={{ fontSize: "1.5rem" }}>💼</span>
              </div>
              <div>
                <h3 style={{ margin: "0", fontSize: "1.1rem", opacity: "0.9" }}>Portfolio Value</h3>
                <p style={{ margin: "0", fontSize: "1.8rem", fontWeight: "700" }}>
                  {holdings ? fmt(holdings.total_value || 0) : "Loading..."}
                </p>
              </div>
            </div>
            <button
              onClick={fetchHoldings}
              disabled={hLoading}
              style={{
                width: "100%",
                padding: "10px",
                background: "rgba(255,255,255,0.2)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: hLoading ? "not-allowed" : "pointer",
                fontSize: "0.9rem",
                fontWeight: "600"
              }}
            >
              {hLoading ? "Refreshing..." : "Refresh Holdings"}
            </button>
          </div>

          <div style={{
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            borderRadius: "15px",
            padding: "25px",
            color: "white",
            boxShadow: "0 8px 16px rgba(245, 158, 11, 0.3)",
            animation: "fadeIn 0.6s ease-out 0.1s both"
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "15px"
            }}>
              <div style={{
                width: "50px",
                height: "50px",
                background: "rgba(255,255,255,0.2)",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "15px"
              }}>
                <span style={{ fontSize: "1.5rem" }}>💰</span>
              </div>
              <div>
                <h3 style={{ margin: "0", fontSize: "1.1rem", opacity: "0.9" }}>Available Funds</h3>
                <p style={{ margin: "0", fontSize: "1.8rem", fontWeight: "700" }}>
                  {funds ? fmt((funds.capital || 0) + (funds.commodity || 0)) : "Loading..."}
                </p>
              </div>
            </div>
            <button
              onClick={fetchFunds}
              disabled={fLoading}
              style={{
                width: "100%",
                padding: "10px",
                background: "rgba(255,255,255,0.2)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: fLoading ? "not-allowed" : "pointer",
                fontSize: "0.9rem",
                fontWeight: "600"
              }}
            >
              {fLoading ? "Refreshing..." : "Refresh Funds"}
            </button>
          </div>

          <div style={{
            background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
            borderRadius: "15px",
            padding: "25px",
            color: "white",
            boxShadow: "0 8px 16px rgba(139, 92, 246, 0.3)",
            animation: "fadeIn 0.6s ease-out 0.2s both"
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "15px"
            }}>
              <div style={{
                width: "50px",
                height: "50px",
                background: "rgba(255,255,255,0.2)",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "15px"
              }}>
                <span style={{ fontSize: "1.5rem" }}>📈</span>
              </div>
              <div>
                <h3 style={{ margin: "0", fontSize: "1.1rem", opacity: "0.9" }}>P&L Today</h3>
                <p style={{ 
                  margin: "0", 
                  fontSize: "1.8rem", 
                  fontWeight: "700",
                  color: holdings ? color(holdings.total_pnl || 0) : "white"
                }}>
                  {holdings ? fmt(holdings.total_pnl || 0) : "Loading..."}
                </p>
              </div>
            </div>
            <div style={{
              fontSize: "0.9rem",
              opacity: "0.8"
            }}>
              {holdings && holdings.holdings ? `${holdings.holdings.length} positions` : "No data"}
            </div>
          </div>
        </div>

        {/* Holdings Overview */}
        <div style={{
          background: "linear-gradient(135deg, #f8fafc, #e2e8f0)",
          border: "1px solid #e2e8f0",
          borderRadius: "15px",
          padding: "25px",
          marginBottom: "30px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
          animation: "fadeIn 0.6s ease-out 0.3s both"
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
                Portfolio Holdings
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
              ) : holdings.holdings && holdings.holdings.length > 0 ? (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "15px"
                }}>
                  {holdings.holdings.slice(0, 6).map((h, i) => (
                    <div key={i} style={{
                      background: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "15px",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                    }}>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "10px"
                      }}>
                        <div>
                          <div style={{ 
                            fontWeight: "600", 
                            color: "#1e293b",
                            fontSize: "1.1rem"
                          }}>
                            {h.symbol || "N/A"}
                          </div>
                          <div style={{ 
                            fontSize: "0.85rem", 
                            color: "#64748b",
                            marginTop: "2px"
                          }}>
                            Qty: {h.qty || 0}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ 
                            fontWeight: "600", 
                            color: "#1e293b",
                            fontSize: "1rem"
                          }}>
                            {fmt(h.market_value || 0)}
                          </div>
                          <div style={{ 
                            fontSize: "0.85rem", 
                            color: color(h.pnl || 0),
                            fontWeight: "500"
                          }}>
                            {fmt(h.pnl || 0)}
                          </div>
                        </div>
                      </div>
                      <div style={{
                        fontSize: "0.8rem",
                        color: "#64748b",
                        borderTop: "1px solid #f1f5f9",
                        paddingTop: "8px"
                      }}>
                        Avg Price: {fmt(h.avg_price || 0)}
                      </div>
                    </div>
                  ))}
                  {holdings.holdings.length > 6 && (
                    <div style={{
                      background: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "15px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#64748b",
                      fontSize: "0.9rem"
                    }}>
                      +{holdings.holdings.length - 6} more positions
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  background: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "40px",
                  textAlign: "center",
                  color: "#64748b"
                }}>
                  <div style={{ fontSize: "2rem", marginBottom: "10px" }}>📊</div>
                  <p style={{ margin: "0", fontSize: "1rem" }}>No holdings found</p>
                  <p style={{ margin: "5px 0 0 0", fontSize: "0.9rem" }}>
                    Start trading to see your positions here
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Funds Overview */}
        <div style={{
          background: "linear-gradient(135deg, #f8fafc, #e2e8f0)",
          border: "1px solid #e2e8f0",
          borderRadius: "15px",
          padding: "25px",
          marginBottom: "30px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
          animation: "fadeIn 0.6s ease-out 0.4s both"
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
                Available Funds
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
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "15px"
                }}>
                  <div style={{
                    background: "white",
                    padding: "20px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    textAlign: "center"
                  }}>
                    <div style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "8px" }}>Capital Market</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#1e293b" }}>
                      {fmt(funds.capital || 0)}
                    </div>
                  </div>
                  <div style={{
                    background: "white",
                    padding: "20px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    textAlign: "center"
                  }}>
                    <div style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "8px" }}>Commodity Market</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#1e293b" }}>
                      {fmt(funds.commodity || 0)}
                    </div>
                  </div>
                  <div style={{
                    background: "white",
                    padding: "20px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    textAlign: "center"
                  }}>
                    <div style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "8px" }}>Total Available</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#10b981" }}>
                      {fmt((funds.capital || 0) + (funds.commodity || 0))}
                    </div>
                  </div>
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