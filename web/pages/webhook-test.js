// Page: Webhook Test (Debugging Chartlink Webhooks)
// Path: web/pages/webhook-test.js

import { useEffect, useState } from "react";
import Link from "next/link";

export default function WebhookTest() {
  const [alerts, setAlerts] = useState([]);
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);

  useEffect(() => {
    if (isAutoRefresh) {
      const interval = setInterval(() => {
        fetchAlerts();
      }, 3000); // Refresh every 3 seconds

      return () => clearInterval(interval);
    }
  }, [isAutoRefresh]);

  const fetchAlerts = async () => {
    try {
      const res = await fetch("/api/alerts", {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
        console.log("Alerts fetched:", data.alerts);
      }
    } catch (e) {
      console.error("Error fetching alerts:", e);
    }
  };

  // Fetch on mount
  useEffect(() => {
    fetchAlerts();
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(to bottom, #f8fafc, #e2e8f0)",
      padding: "20px"
    }}>
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto"
      }}>
        <div style={{
          background: "white",
          borderRadius: "12px",
          padding: "20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px"
          }}>
            <div>
              <h1 style={{ margin: "0 0 10px 0", color: "#1e293b" }}>
                🔍 Webhook Test Page
              </h1>
              <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                Monitor Chartlink webhook alerts in real-time
              </p>
            </div>
            <div>
              <Link href="/" style={{
                padding: "10px 20px",
                background: "#3b82f6",
                color: "white",
                borderRadius: "8px",
                textDecoration: "none",
                marginRight: "10px"
              }}>
                ← Back to Home
              </Link>
              <button 
                onClick={fetchAlerts}
                style={{
                  padding: "10px 20px",
                  background: "#10b981",
                  color: "white",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  marginRight: "10px"
                }}
              >
                🔄 Refresh
              </button>
              <button 
                onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                style={{
                  padding: "10px 20px",
                  background: isAutoRefresh ? "#ef4444" : "#6b7280",
                  color: "white",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                {isAutoRefresh ? "⏸ Stop Auto" : "▶ Start Auto"}
              </button>
            </div>
          </div>

          <div style={{
            padding: "15px",
            background: "#f1f5f9",
            borderRadius: "8px",
            marginBottom: "20px"
          }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>Webhook URL:</h3>
            <code style={{
              padding: "10px",
              background: "white",
              borderRadius: "4px",
              display: "block",
              wordBreak: "break-all"
            }}>
              https://fyers-simple-app-production.up.railway.app/webhooks/chartlink
            </code>
          </div>

          <div>
            <h3 style={{ margin: "0 0 15px 0" }}>
              Alerts Received: {alerts.length}
            </h3>
            
            {alerts.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "14px"
                }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={{ padding: "12px", textAlign: "left", border: "1px solid #e5e7eb" }}>ID</th>
                      <th style={{ padding: "12px", textAlign: "left", border: "1px solid #e5e7eb" }}>Status</th>
                      <th style={{ padding: "12px", textAlign: "left", border: "1px solid #e5e7eb" }}>Symbol</th>
                      <th style={{ padding: "12px", textAlign: "left", border: "1px solid #e5e7eb" }}>Side</th>
                      <th style={{ padding: "12px", textAlign: "left", border: "1px solid #e5e7eb" }}>Qty</th>
                      <th style={{ padding: "12px", textAlign: "left", border: "1px solid #e5e7eb" }}>Price</th>
                      <th style={{ padding: "12px", textAlign: "left", border: "1px solid #e5e7eb" }}>Created</th>
                      <th style={{ padding: "12px", textAlign: "left", border: "1px solid #e5e7eb" }}>Payload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert) => (
                      <tr key={alert.id}>
                        <td style={{ padding: "12px", border: "1px solid #e5e7eb" }}>{alert.id}</td>
                        <td style={{ padding: "12px", border: "1px solid #e5e7eb" }}>
                          <span style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            background: alert.status === 'processed' ? '#d1fae5' : 
                                       alert.status === 'pending' ? '#fef3c7' : '#fee2e2',
                            color: alert.status === 'processed' ? '#065f46' : 
                                   alert.status === 'pending' ? '#92400e' : '#991b1b'
                          }}>
                            {alert.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px", border: "1px solid #e5e7eb" }}>
                          {alert.rawPayload?.symbol || alert.rawPayload?.ticker || '-'}
                        </td>
                        <td style={{ padding: "12px", border: "1px solid #e5e7eb" }}>
                          {alert.rawPayload?.side || alert.rawPayload?.action || '-'}
                        </td>
                        <td style={{ padding: "12px", border: "1px solid #e5e7eb" }}>
                          {alert.rawPayload?.quantity || alert.rawPayload?.qty || '-'}
                        </td>
                        <td style={{ padding: "12px", border: "1px solid #e5e7eb" }}>
                          {alert.rawPayload?.limit_price || alert.rawPayload?.price || '-'}
                        </td>
                        <td style={{ padding: "12px", border: "1px solid #e5e7eb" }}>
                          {new Date(alert.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: "12px", border: "1px solid #e5e7eb" }}>
                          <details>
                            <summary style={{ cursor: "pointer", color: "#3b82f6" }}>
                              View JSON
                            </summary>
                            <pre style={{
                              marginTop: "8px",
                              padding: "8px",
                              background: "#f8fafc",
                              borderRadius: "4px",
                              fontSize: "11px",
                              overflow: "auto",
                              maxHeight: "200px"
                            }}>
                              {JSON.stringify(alert.rawPayload || {}, null, 2)}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{
                textAlign: "center",
                padding: "60px 20px",
                background: "#f8fafc",
                borderRadius: "8px"
              }}>
                <div style={{ fontSize: "48px", marginBottom: "10px" }}>📡</div>
                <h3 style={{ color: "#64748b", margin: "0 0 10px 0" }}>
                  No alerts received yet
                </h3>
                <p style={{ color: "#94a3b8", margin: 0 }}>
                  Configure the webhook URL above in Chartlink to start receiving alerts
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

