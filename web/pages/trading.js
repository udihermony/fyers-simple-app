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
    .trading-card {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 15px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.05);
      margin-bottom: 20px;
    }
    
    /* Mobile responsive cards */
    @media (max-width: 768px) {
      .trading-card {
        padding: 15px;
        border-radius: 12px;
        margin-bottom: 15px;
      }
    }
    
    @media (max-width: 480px) {
      .trading-card {
        padding: 12px;
        border-radius: 10px;
        margin-bottom: 12px;
      }
    }
    .order-form {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .form-group {
      display: flex;
      flex-direction: column;
    }
    .form-group label {
      font-weight: 600;
      margin-bottom: 5px;
      color: #374151;
    }
    .form-group input, .form-group select {
      padding: 10px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
    }
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }
    .btn-primary {
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: white;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
    }
    .btn-danger {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
    }
    .btn-danger:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 6px rgba(239, 68, 68, 0.3);
    }
    .btn-success {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
    }
    .btn-success:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
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
    
    @media (max-width: 768px) {
      .mode-toggle {
        padding: 12px 15px;
        flex-wrap: wrap;
      }
      .mode-toggle-label {
        width: 100%;
        margin-bottom: 5px;
      }
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    .table th, .table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    .table th {
      background: #f9fafb;
      font-weight: 600;
      color: #374151;
    }
    
    /* Mobile responsive table */
    .table-container {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    
    @media (max-width: 768px) {
      .table {
        min-width: 600px; /* Ensure table doesn't get too cramped */
      }
      .table th, .table td {
        padding: 8px 6px;
        font-size: 14px;
      }
      .table th:nth-child(3), .table td:nth-child(3), /* Type column */
      .table th:nth-child(6), .table td:nth-child(6), /* Mode column */
      .table th:nth-child(8), .table td:nth-child(8) { /* Created column */
        display: none;
      }
    }
    
    @media (max-width: 480px) {
      .table {
        min-width: 500px;
      }
      .table th, .table td {
        padding: 6px 4px;
        font-size: 12px;
      }
      .table th:nth-child(7), .table td:nth-child(7) { /* State column */
        display: none;
      }
    }
    .status-badge {
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .status-new { background: #dbeafe; color: #1e40af; }
    .status-working { background: #fef3c7; color: #92400e; }
    .status-filled { background: #d1fae5; color: #065f46; }
    .status-cancelled { background: #f3f4f6; color: #374151; }
    .status-rejected { background: #fee2e2; color: #991b1b; }
    .tabs {
      display: flex;
      border-bottom: 2px solid #e5e7eb;
      margin-bottom: 20px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .tab {
      padding: 10px 20px;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      font-weight: 600;
      color: #6b7280;
      white-space: nowrap;
      flex-shrink: 0;
      transition: all 0.2s ease;
    }
    .tab.active {
      color: #3b82f6;
      border-bottom-color: #3b82f6;
      background: rgba(59, 130, 246, 0.05);
    }
    .tab:hover {
      color: #3b82f6;
      background: rgba(59, 130, 246, 0.05);
    }
    
    /* Mobile responsive tabs - Grid layout for medium screens */
    @media (max-width: 768px) {
      .tabs {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 2px;
        border-bottom: none;
        background: #f8fafc;
        border-radius: 8px;
        padding: 4px;
        overflow-x: visible;
      }
      .tab {
        padding: 12px 8px;
        font-size: 13px;
        text-align: center;
        border-radius: 6px;
        border-bottom: none;
        background: white;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      }
      .tab.active {
        background: #3b82f6;
        color: white;
        box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
      }
      .tab:hover {
        background: #f1f5f9;
        color: #3b82f6;
      }
      .tab.active:hover {
        background: #2563eb;
        color: white;
      }
    }
    
    /* Very small screens - Dropdown approach */
    @media (max-width: 480px) {
      .tabs {
        display: none;
      }
      .mobile-tab-selector {
        display: block;
        margin-bottom: 20px;
      }
      .mobile-tab-selector select {
        width: 100%;
        padding: 12px 16px;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        background: white;
        color: #374151;
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
        background-position: right 12px center;
        background-repeat: no-repeat;
        background-size: 16px;
        padding-right: 40px;
      }
      .mobile-tab-selector select:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
    }
    
    /* Hide mobile selector on larger screens */
    @media (min-width: 481px) {
      .mobile-tab-selector {
        display: none;
      }
    }
    
    /* Mobile responsive main container */
    @media (max-width: 768px) {
      .main-container {
        padding: 20px !important;
        border-radius: 15px !important;
      }
    }
    
    @media (max-width: 480px) {
      .main-container {
        padding: 15px !important;
        border-radius: 12px !important;
        margin: 10px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

export default function TradingDashboard() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('orders');
  const [tradingMode, setTradingMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tradingMode') || 'paper';
    }
    return 'paper';
  });
  const [orders, setOrders] = useState([]);
  const [positions, setPositions] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [webhookSettings, setWebhookSettings] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [simulationState, setSimulationState] = useState({
    isRunning: false,
    testName: '',
    allocatedFunds: 100000, // Default 1 lakh
    currentBalance: 100000,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalPnL: 0,
    startTime: null,
    strategies: [],
    simulationOrders: [],
    simulationPositions: [],
    testHistory: []
  });
  const [orderForm, setOrderForm] = useState({
    symbol: 'NSE:SBIN-EQ',
    side: 1,
    type: 2,
    productType: 'INTRADAY',
    qty: 100,
    limitPrice: '',
    stopPrice: '',
    stopLoss: '',
    takeProfit: '',
    orderTag: '',
    mode: 'paper'
  });

  const fetchProfile = async () => {
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

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/orders?limit=50`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (e) {
      console.error("Error fetching orders:", e);
    }
  };

  const fetchPositions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/positions`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setPositions(data.positions || []);
      }
    } catch (e) {
      console.error("Error fetching positions:", e);
    }
  };

  const fetchPortfolio = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/portfolio`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data.portfolio);
      }
    } catch (e) {
      console.error("Error fetching portfolio:", e);
    }
  };

  const fetchWebhookSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/webhook`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setWebhookSettings(data);
      }
    } catch (e) {
      console.error("Error fetching webhook settings:", e);
    }
  };

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts?limit=50`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (e) {
      console.error("Error fetching alerts:", e);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (profile) {
      fetchOrders();
      fetchPositions();
      fetchPortfolio();
      fetchWebhookSettings();
      fetchAlerts();
      fetchSimulationData();
    }
  }, [profile]);

  const placeOrder = async () => {
    try {
      // Clean up the order form data - convert empty strings to null for numeric fields
      const cleanedOrderForm = {
        ...orderForm,
        limitPrice: orderForm.limitPrice && orderForm.limitPrice !== '' ? parseFloat(orderForm.limitPrice) : null,
        stopPrice: orderForm.stopPrice && orderForm.stopPrice !== '' ? parseFloat(orderForm.stopPrice) : null,
        stopLoss: orderForm.stopLoss && orderForm.stopLoss !== '' ? parseFloat(orderForm.stopLoss) : null,
        takeProfit: orderForm.takeProfit && orderForm.takeProfit !== '' ? parseFloat(orderForm.takeProfit) : null,
        orderTag: orderForm.orderTag && orderForm.orderTag !== '' ? orderForm.orderTag : null,
        qty: parseInt(orderForm.qty)
      };

      const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include",
        body: JSON.stringify(cleanedOrderForm)
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Order placed successfully! Order ID: ${data.order.id}`);
        fetchOrders();
        fetchPositions();
        fetchPortfolio();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (e) {
      console.error("Error placing order:", e);
      alert("Error placing order");
    }
  };

  const cancelOrder = async (orderId) => {
    try {
      const res = await fetch(`${API_BASE}/api/orders/${orderId}/cancel`, {
        method: 'POST',
        credentials: "include"
      });

      if (res.ok) {
        alert("Order cancelled successfully");
        fetchOrders();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (e) {
      console.error("Error cancelling order:", e);
      alert("Error cancelling order");
    }
  };

  const rotateWebhookCredentials = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/webhook/rotate`, {
        method: 'POST',
        credentials: "include"
      });

      if (res.ok) {
        const data = await res.json();
        setWebhookSettings({
          webhookUrl: data.webhookUrl,
          webhookSecret: data.webhookSecret,
          defaultMode: webhookSettings?.defaultMode || 'paper'
        });
        alert("Webhook credentials rotated successfully");
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (e) {
      console.error("Error rotating webhook credentials:", e);
      alert("Error rotating webhook credentials");
    }
  };

  // Paper Trading Simulation Functions
  const startSimulation = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/simulation/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: "include",
        body: JSON.stringify({
          allocatedFunds: simulationState.allocatedFunds,
          testName: simulationState.testName
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSimulationState(prev => ({
          ...prev,
          isRunning: true,
          testName: prev.testName, // Keep the test name
          startTime: new Date(),
          currentBalance: data.currentBalance || prev.allocatedFunds,
          strategies: data.strategies || []
        }));
        alert("Simulation started successfully!");
      } else {
        const error = await res.json();
        alert(`Error starting simulation: ${error.error}`);
      }
    } catch (e) {
      console.error("Error starting simulation:", e);
      alert("Error starting simulation");
    }
  };

  const stopSimulation = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/simulation/stop`, {
        method: 'POST',
        credentials: "include"
      });

      if (res.ok) {
        const data = await res.json();
        setSimulationState(prev => ({
          ...prev,
          isRunning: false,
          totalPnL: data.totalPnL || prev.totalPnL,
          totalTrades: data.totalTrades || prev.totalTrades,
          winningTrades: data.winningTrades || prev.winningTrades,
          losingTrades: data.losingTrades || prev.losingTrades
        }));
        alert("Simulation stopped successfully!");
      } else {
        const error = await res.json();
        alert(`Error stopping simulation: ${error.error}`);
      }
    } catch (e) {
      console.error("Error stopping simulation:", e);
      alert("Error stopping simulation");
    }
  };

  const fetchSimulationData = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/simulation/status`, {
        credentials: "include"
      });

      if (res.ok) {
        const data = await res.json();
        setSimulationState(prev => ({
          ...prev,
          ...data,
          isRunning: data.isRunning || false
        }));
      }
    } catch (e) {
      console.error("Error fetching simulation data:", e);
    }
  };

  const resetSimulation = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/simulation/reset`, {
        method: 'POST',
        credentials: "include"
      });

      if (res.ok) {
        setSimulationState({
          isRunning: false,
          allocatedFunds: 100000,
          currentBalance: 100000,
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          totalPnL: 0,
          startTime: null,
          strategies: [],
          simulationOrders: [],
          simulationPositions: []
        });
        alert("Simulation reset successfully!");
      } else {
        const error = await res.json();
        alert(`Error resetting simulation: ${error.error}`);
      }
    } catch (e) {
      console.error("Error resetting simulation:", e);
      alert("Error resetting simulation");
    }
  };

  const formatCurrency = (value) => {
    if (typeof value !== "number") return value;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2
    }).format(value);
  };

  const getStatusColor = (status) => {
    const colors = {
      new: '#3b82f6',
      working: '#f59e0b',
      filled: '#10b981',
      cancelled: '#6b7280',
      rejected: '#ef4444'
    };
    return colors[status] || '#6b7280';
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
            Trading Dashboard
          </h1>
          <p style={{
            fontSize: "1.2rem",
            color: "#666",
            marginBottom: "30px",
            lineHeight: "1.6"
          }}>
            Please login to access the trading dashboard
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
      <div className="main-container" style={{
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
            <Link href="/">
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
                Dashboard
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
                onChange={(e) => {
                  const newMode = e.target.checked ? 'live' : 'paper';
                  setTradingMode(newMode);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('tradingMode', newMode);
                  }
                }}
              />
              <span className="mode-slider"></span>
            </label>
          </div>
          <span className={`mode-indicator ${tradingMode === 'paper' ? 'mode-paper' : 'mode-live'}`}>
            {tradingMode === 'paper' ? '📄 PAPER TRADING' : '🔴 LIVE TRADING'}
          </span>
        </div>

        {/* Portfolio Summary */}
        {portfolio && (
          <div className="trading-card">
            <h3 style={{ margin: "0 0 15px 0", color: "#1e293b" }}>Portfolio Summary</h3>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "20px"
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "5px" }}>Cash Balance</div>
                <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#1e293b" }}>
                  {formatCurrency(portfolio.cashBalance || 0)}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "5px" }}>Day P&L</div>
                <div style={{ 
                  fontSize: "1.5rem", 
                  fontWeight: "600", 
                  color: (portfolio.dayPnl || 0) >= 0 ? "#10b981" : "#ef4444"
                }}>
                  {formatCurrency(portfolio.dayPnl || 0)}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "5px" }}>Total P&L</div>
                <div style={{ 
                  fontSize: "1.5rem", 
                  fontWeight: "600", 
                  color: (portfolio.totalPnl || 0) >= 0 ? "#10b981" : "#ef4444"
                }}>
                  {formatCurrency(portfolio.totalPnl || 0)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Tab Selector (for very small screens) */}
        <div className="mobile-tab-selector">
          <select 
            value={activeTab} 
            onChange={(e) => setActiveTab(e.target.value)}
          >
            <option value="orders">📊 Orders</option>
            <option value="positions">💼 Positions</option>
            <option value="chartlink">📡 Chartlink Alerts</option>
            <option value="place-order">📝 Place Order</option>
            <option value="paper-trading">🎯 Paper Trading Settings</option>
            <option value="settings">⚙️ Settings</option>
          </select>
        </div>

        {/* Desktop/Tablet Tabs */}
        <div className="tabs">
          <div 
            className={`tab ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            📊 Orders
          </div>
          <div 
            className={`tab ${activeTab === 'positions' ? 'active' : ''}`}
            onClick={() => setActiveTab('positions')}
          >
            💼 Positions
          </div>
          <div 
            className={`tab ${activeTab === 'chartlink' ? 'active' : ''}`}
            onClick={() => setActiveTab('chartlink')}
          >
            📡 Chartlink Alerts
          </div>
          <div 
            className={`tab ${activeTab === 'place-order' ? 'active' : ''}`}
            onClick={() => setActiveTab('place-order')}
          >
            📝 Place Order
          </div>
          {tradingMode === 'paper' && (
            <div 
              className={`tab ${activeTab === 'paper-trading' ? 'active' : ''}`}
              onClick={() => setActiveTab('paper-trading')}
            >
              🎯 Paper Trading Settings
            </div>
          )}
          <div 
            className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Settings
          </div>
        </div>

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="trading-card">
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px"
            }}>
              <h3 style={{ margin: "0", color: "#1e293b" }}>Recent Orders</h3>
              <button 
                className="btn btn-primary"
                onClick={fetchOrders}
              >
                Refresh
              </button>
            </div>
            
            {orders.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Side</th>
                      <th>Type</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Mode</th>
                      <th>State</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td>{order.symbol}</td>
                        <td>{order.side === 1 ? 'Buy' : 'Sell'}</td>
                        <td>{order.type === 1 ? 'Limit' : order.type === 2 ? 'Market' : order.type === 3 ? 'Stop' : 'Stop-Limit'}</td>
                        <td>{order.qty}</td>
                        <td>{order.limitPrice ? formatCurrency(order.limitPrice) : '-'}</td>
                        <td>
                          <span className={`status-badge status-${order.mode}`}>
                            {order.mode}
                          </span>
                        </td>
                        <td>
                          <span 
                            className="status-badge"
                            style={{ 
                              background: getStatusColor(order.state) + '20',
                              color: getStatusColor(order.state)
                            }}
                          >
                            {order.state}
                          </span>
                        </td>
                        <td>{new Date(order.createdAt).toLocaleString()}</td>
                        <td>
                          {['new', 'working'].includes(order.state) && (
                            <button 
                              className="btn btn-danger"
                              style={{ padding: "5px 10px", fontSize: "12px" }}
                              onClick={() => cancelOrder(order.id)}
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{
                textAlign: "center",
                padding: "40px",
                color: "#64748b"
              }}>
                <div style={{ fontSize: "2rem", marginBottom: "10px" }}>📊</div>
                <p>No orders found</p>
              </div>
            )}
          </div>
        )}

        {/* Chartlink Alerts Tab */}
        {activeTab === 'chartlink' && (
          <div className="trading-card">
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px"
            }}>
              <h3 style={{ margin: "0", color: "#1e293b" }}>Chartlink Alerts</h3>
              <button 
                className="btn btn-primary"
                onClick={fetchAlerts}
              >
                Refresh
              </button>
            </div>
            
            {alerts.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Strategy</th>
                      <th>Symbol</th>
                      <th>Side</th>
                      <th>Type</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert) => (
                      <tr key={alert.id}>
                        <td>{alert.strategy?.name || 'Unknown'}</td>
                        <td>{alert.rawPayload?.symbol || '-'}</td>
                        <td>{alert.rawPayload?.side || '-'}</td>
                        <td>{alert.rawPayload?.order_type || '-'}</td>
                        <td>{alert.rawPayload?.quantity || '-'}</td>
                        <td>{alert.rawPayload?.limit_price || alert.rawPayload?.price || '-'}</td>
                        <td>
                          <span 
                            className="status-badge"
                            style={{ 
                              background: getStatusColor(alert.status) + '20',
                              color: getStatusColor(alert.status)
                            }}
                          >
                            {alert.status}
                          </span>
                        </td>
                        <td>{new Date(alert.createdAt).toLocaleString()}</td>
                        <td>
                          {alert.orders && alert.orders.length > 0 ? (
                            <span style={{ fontSize: "0.8rem", color: "#10b981" }}>
                              {alert.orders.length} order(s)
                            </span>
                          ) : (
                            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                              No orders
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{
                textAlign: "center",
                padding: "40px",
                color: "#64748b"
              }}>
                <div style={{ fontSize: "2rem", marginBottom: "10px" }}>📡</div>
                <p>No Chartlink alerts received yet</p>
                <div style={{ fontSize: "0.9rem", marginTop: "10px", color: "#64748b" }}>
                  <p>Webhook URL: <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                    {webhookSettings?.webhookUrl || 'Loading...'}
                  </code></p>
                  <p>Configure this URL in Chartlink to start receiving alerts</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Positions Tab */}
        {activeTab === 'positions' && (
          <div className="trading-card">
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px"
            }}>
              <h3 style={{ margin: "0", color: "#1e293b" }}>Current Positions</h3>
              <button 
                className="btn btn-primary"
                onClick={fetchPositions}
              >
                Refresh
              </button>
            </div>
            
            {positions.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Qty</th>
                      <th>Avg Price</th>
                      <th>Current Price</th>
                      <th>MTM</th>
                      <th>Mode</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((position) => (
                      <tr key={position.id}>
                        <td>{position.symbol}</td>
                        <td>{position.qty}</td>
                        <td>{formatCurrency(position.avgPrice)}</td>
                        <td>-</td>
                        <td style={{ 
                          color: position.mtm >= 0 ? "#10b981" : "#ef4444",
                          fontWeight: "600"
                        }}>
                          {formatCurrency(position.mtm)}
                        </td>
                        <td>
                          <span className={`status-badge status-${position.mode}`}>
                            {position.mode}
                          </span>
                        </td>
                        <td>{new Date(position.updatedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{
                textAlign: "center",
                padding: "40px",
                color: "#64748b"
              }}>
                <div style={{ fontSize: "2rem", marginBottom: "10px" }}>💼</div>
                <p>No positions found</p>
              </div>
            )}
          </div>
        )}

        {/* Place Order Tab */}
        {activeTab === 'place-order' && (
          <div className="trading-card">
            <h3 style={{ margin: "0 0 20px 0", color: "#1e293b" }}>Place Order</h3>
            
            <div className="order-form">
              <div className="form-group">
                <label>Symbol</label>
                <input
                  type="text"
                  value={orderForm.symbol}
                  onChange={(e) => setOrderForm({...orderForm, symbol: e.target.value})}
                  placeholder="NSE:SBIN-EQ"
                />
              </div>
              
              <div className="form-group">
                <label>Side</label>
                <select
                  value={orderForm.side}
                  onChange={(e) => setOrderForm({...orderForm, side: parseInt(e.target.value)})}
                >
                  <option value={1}>Buy</option>
                  <option value={-1}>Sell</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Type</label>
                <select
                  value={orderForm.type}
                  onChange={(e) => setOrderForm({...orderForm, type: parseInt(e.target.value)})}
                >
                  <option value={1}>Limit</option>
                  <option value={2}>Market</option>
                  <option value={3}>Stop</option>
                  <option value={4}>Stop-Limit</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Product Type</label>
                <select
                  value={orderForm.productType}
                  onChange={(e) => setOrderForm({...orderForm, productType: e.target.value})}
                >
                  <option value="INTRADAY">INTRADAY</option>
                  <option value="CNC">CNC</option>
                  <option value="MARGIN">MARGIN</option>
                  <option value="CO">CO</option>
                  <option value="BO">BO</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Quantity</label>
                <input
                  type="number"
                  value={orderForm.qty}
                  onChange={(e) => setOrderForm({...orderForm, qty: parseInt(e.target.value)})}
                  min="1"
                />
              </div>
              
              <div className="form-group">
                <label>Limit Price</label>
                <input
                  type="number"
                  value={orderForm.limitPrice}
                  onChange={(e) => setOrderForm({...orderForm, limitPrice: parseFloat(e.target.value)})}
                  step="0.05"
                />
              </div>
              
              <div className="form-group">
                <label>Stop Price</label>
                <input
                  type="number"
                  value={orderForm.stopPrice}
                  onChange={(e) => setOrderForm({...orderForm, stopPrice: parseFloat(e.target.value)})}
                  step="0.05"
                />
              </div>
              
              <div className="form-group">
                <label>Stop Loss</label>
                <input
                  type="number"
                  value={orderForm.stopLoss}
                  onChange={(e) => setOrderForm({...orderForm, stopLoss: parseFloat(e.target.value)})}
                  step="0.05"
                />
              </div>
              
              <div className="form-group">
                <label>Take Profit</label>
                <input
                  type="number"
                  value={orderForm.takeProfit}
                  onChange={(e) => setOrderForm({...orderForm, takeProfit: parseFloat(e.target.value)})}
                  step="0.05"
                />
              </div>
              
              <div className="form-group">
                <label>Order Tag</label>
                <input
                  type="text"
                  value={orderForm.orderTag}
                  onChange={(e) => setOrderForm({...orderForm, orderTag: e.target.value})}
                  maxLength="30"
                />
              </div>
              
              <div className="form-group">
                <label>Mode</label>
                <select
                  value={orderForm.mode}
                  onChange={(e) => setOrderForm({...orderForm, mode: e.target.value})}
                >
                  <option value="paper">Paper</option>
                  <option value="live">Live</option>
                </select>
              </div>
            </div>
            
            <button 
              className="btn btn-success"
              onClick={placeOrder}
              style={{ width: "100%" }}
            >
              Place Order
            </button>
          </div>
        )}

        {/* Paper Trading Tab */}
        {activeTab === 'paper-trading' && (
          <div className="trading-card">
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px"
            }}>
              <h3 style={{ margin: "0", color: "#1e293b" }}>Paper Trading Simulation</h3>
              <div style={{ display: "flex", gap: "10px" }}>
                <button 
                  className="btn btn-primary"
                  onClick={fetchSimulationData}
                >
                  Refresh
                </button>
                <button 
                  className="btn btn-danger"
                  onClick={resetSimulation}
                  disabled={simulationState.isRunning}
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Simulation Status */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "20px",
              marginBottom: "30px"
            }}>
              <div style={{ textAlign: "center", padding: "15px", background: "#f8fafc", borderRadius: "8px" }}>
                <div style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "5px" }}>Status</div>
                <div style={{ 
                  fontSize: "1.2rem", 
                  fontWeight: "600", 
                  color: simulationState.isRunning ? "#10b981" : "#6b7280"
                }}>
                  {simulationState.isRunning ? "🟢 Running" : "🔴 Stopped"}
                </div>
              </div>
              <div style={{ textAlign: "center", padding: "15px", background: "#f8fafc", borderRadius: "8px" }}>
                <div style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "5px" }}>Allocated Funds</div>
                <div style={{ fontSize: "1.2rem", fontWeight: "600", color: "#1e293b" }}>
                  {formatCurrency(simulationState.allocatedFunds)}
                </div>
              </div>
              <div style={{ textAlign: "center", padding: "15px", background: "#f8fafc", borderRadius: "8px" }}>
                <div style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "5px" }}>Current Balance</div>
                <div style={{ fontSize: "1.2rem", fontWeight: "600", color: "#1e293b" }}>
                  {formatCurrency(simulationState.currentBalance)}
                </div>
              </div>
              <div style={{ textAlign: "center", padding: "15px", background: "#f8fafc", borderRadius: "8px" }}>
                <div style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "5px" }}>Total P&L</div>
                <div style={{ 
                  fontSize: "1.2rem", 
                  fontWeight: "600", 
                  color: simulationState.totalPnL >= 0 ? "#10b981" : "#ef4444"
                }}>
                  {formatCurrency(simulationState.totalPnL)}
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "15px",
              marginBottom: "30px"
            }}>
              <div style={{ textAlign: "center", padding: "12px", background: "#f0f9ff", borderRadius: "8px" }}>
                <div style={{ color: "#0369a1", fontSize: "0.8rem", marginBottom: "5px" }}>Total Trades</div>
                <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#0369a1" }}>
                  {simulationState.totalTrades}
                </div>
              </div>
              <div style={{ textAlign: "center", padding: "12px", background: "#f0fdf4", borderRadius: "8px" }}>
                <div style={{ color: "#166534", fontSize: "0.8rem", marginBottom: "5px" }}>Winning Trades</div>
                <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#166534" }}>
                  {simulationState.winningTrades}
                </div>
              </div>
              <div style={{ textAlign: "center", padding: "12px", background: "#fef2f2", borderRadius: "8px" }}>
                <div style={{ color: "#991b1b", fontSize: "0.8rem", marginBottom: "5px" }}>Losing Trades</div>
                <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#991b1b" }}>
                  {simulationState.losingTrades}
                </div>
              </div>
              <div style={{ textAlign: "center", padding: "12px", background: "#fefce8", borderRadius: "8px" }}>
                <div style={{ color: "#a16207", fontSize: "0.8rem", marginBottom: "5px" }}>Win Rate</div>
                <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#a16207" }}>
                  {simulationState.totalTrades > 0 
                    ? `${((simulationState.winningTrades / simulationState.totalTrades) * 100).toFixed(1)}%`
                    : "0%"
                  }
                </div>
              </div>
            </div>

            {/* Simulation Controls */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              marginBottom: "30px"
            }}>
              {/* Test Name */}
              <div className="form-group">
                <label>Test Name</label>
                <input
                  type="text"
                  value={simulationState.testName || ''}
                  onChange={(e) => setSimulationState(prev => ({
                    ...prev,
                    testName: e.target.value
                  }))}
                  placeholder="e.g., Strategy Test 1"
                  disabled={simulationState.isRunning}
                />
              </div>

              {/* Fund Allocation */}
              <div className="form-group">
                <label>Allocated Funds (₹)</label>
                <input
                  type="number"
                  value={simulationState.allocatedFunds}
                  onChange={(e) => setSimulationState(prev => ({
                    ...prev,
                    allocatedFunds: parseInt(e.target.value) || 100000,
                    currentBalance: parseInt(e.target.value) || 100000
                  }))}
                  min="10000"
                  max="10000000"
                  step="10000"
                  disabled={simulationState.isRunning}
                />
              </div>

              {/* Control Buttons */}
              <div style={{
                display: "flex",
                gap: "15px",
                flexWrap: "wrap"
              }}>
                {!simulationState.isRunning ? (
                  <button 
                    className="btn btn-success"
                    onClick={startSimulation}
                    style={{ flex: "1", minWidth: "200px" }}
                  >
                    🚀 Start Simulation
                  </button>
                ) : (
                  <button 
                    className="btn btn-danger"
                    onClick={stopSimulation}
                    style={{ flex: "1", minWidth: "200px" }}
                  >
                    ⏹️ Stop Simulation
                  </button>
                )}
              </div>

              {/* Simulation Info */}
              {simulationState.isRunning && simulationState.startTime && (
                <div style={{
                  padding: "15px",
                  background: "#f0f9ff",
                  borderRadius: "8px",
                  border: "1px solid #bae6fd"
                }}>
                  <div style={{ fontSize: "0.9rem", color: "#0369a1", marginBottom: "5px" }}>
                    Simulation Started: {simulationState.startTime.toLocaleString()}
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#0369a1" }}>
                    Duration: {Math.floor((new Date() - simulationState.startTime) / 1000 / 60)} minutes
                  </div>
                </div>
              )}
            </div>

            {/* Active Strategies */}
            {simulationState.strategies && simulationState.strategies.length > 0 && (
              <div style={{ marginBottom: "30px" }}>
                <h4 style={{ margin: "0 0 15px 0", color: "#1e293b" }}>Active Strategies</h4>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                  gap: "15px"
                }}>
                  {simulationState.strategies.map((strategy, index) => (
                    <div key={index} style={{
                      padding: "15px",
                      background: "#f8fafc",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0"
                    }}>
                      <div style={{ fontWeight: "600", marginBottom: "5px" }}>
                        {strategy.name || `Strategy ${index + 1}`}
                      </div>
                      <div style={{ fontSize: "0.9rem", color: "#64748b" }}>
                        Status: <span style={{ color: "#10b981" }}>Active</span>
                      </div>
                      <div style={{ fontSize: "0.9rem", color: "#64748b" }}>
                        Trades: {strategy.trades || 0}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Simulation Orders */}
            {simulationState.simulationOrders && simulationState.simulationOrders.length > 0 && (
              <div>
                <h4 style={{ margin: "0 0 15px 0", color: "#1e293b" }}>Simulation Orders</h4>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Side</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Status</th>
                        <th>Strategy</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulationState.simulationOrders.slice(0, 10).map((order, index) => (
                        <tr key={index}>
                          <td>{order.symbol}</td>
                          <td>{order.side === 1 ? 'Buy' : 'Sell'}</td>
                          <td>{order.qty}</td>
                          <td>{formatCurrency(order.price)}</td>
                          <td>
                            <span 
                              className="status-badge"
                              style={{ 
                                background: getStatusColor(order.status) + '20',
                                color: getStatusColor(order.status)
                              }}
                            >
                              {order.status}
                            </span>
                          </td>
                          <td>{order.strategy || 'Manual'}</td>
                          <td>{new Date(order.timestamp).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Test History */}
            <div style={{ marginTop: "40px" }}>
              <h4 style={{ margin: "0 0 20px 0", color: "#1e293b" }}>Test History</h4>
              {simulationState.testHistory && simulationState.testHistory.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Test Name</th>
                        <th>Started</th>
                        <th>Duration</th>
                        <th>Funds</th>
                        <th>Trades</th>
                        <th>Win Rate</th>
                        <th>P&L</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulationState.testHistory.map((test, index) => (
                        <tr key={index}>
                          <td><strong>{test.testName || `Test ${index + 1}`}</strong></td>
                          <td>{new Date(test.startTime).toLocaleString()}</td>
                          <td>{test.duration || 'N/A'}</td>
                          <td>{formatCurrency(test.allocatedFunds)}</td>
                          <td>{test.totalTrades}</td>
                          <td>{test.totalTrades > 0 ? `${((test.winningTrades / test.totalTrades) * 100).toFixed(1)}%` : '0%'}</td>
                          <td style={{ 
                            color: test.totalPnL >= 0 ? "#10b981" : "#ef4444",
                            fontWeight: "600"
                          }}>
                            {formatCurrency(test.totalPnL)}
                          </td>
                          <td>
                            <span 
                              className="status-badge"
                              style={{ 
                                background: test.totalPnL >= 0 ? "#10b981" + '20' : "#ef4444" + '20',
                                color: test.totalPnL >= 0 ? "#10b981" : "#ef4444"
                              }}
                            >
                              {test.totalPnL >= 0 ? 'Profit' : 'Loss'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#64748b",
                  background: "#f8fafc",
                  borderRadius: "8px"
                }}>
                  <div style={{ fontSize: "2rem", marginBottom: "10px" }}>📊</div>
                  <p>No test history yet</p>
                  <p style={{ fontSize: "0.9rem", marginTop: "5px" }}>Completed tests will appear here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="trading-card">
            <h3 style={{ margin: "0 0 20px 0", color: "#1e293b" }}>Webhook Settings</h3>
            
            {webhookSettings ? (
              <div>
                <div className="form-group" style={{ marginBottom: "20px" }}>
                  <label>Webhook URL</label>
                  <div style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "center"
                  }}>
                    <input
                      type="text"
                      value={webhookSettings.webhookUrl}
                      readOnly
                      style={{ flex: 1 }}
                    />
                    <button 
                      className="btn btn-primary"
                      onClick={() => navigator.clipboard.writeText(webhookSettings.webhookUrl)}
                    >
                      Copy
                    </button>
                  </div>
                </div>
                
                <div className="form-group" style={{ marginBottom: "20px" }}>
                  <label>Webhook Secret</label>
                  <div style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "center"
                  }}>
                    <input
                      type="text"
                      value={webhookSettings.webhookSecret}
                      readOnly
                      style={{ flex: 1 }}
                      placeholder="Not required for Chartlink"
                    />
                    <button 
                      className="btn btn-primary"
                      onClick={() => navigator.clipboard.writeText(webhookSettings.webhookSecret)}
                    >
                      Copy
                    </button>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "5px" }}>
                    {webhookSettings.description || "Chartlink only requires the webhook URL above. The secret is optional."}
                  </div>
                </div>
                
                <div className="form-group" style={{ marginBottom: "20px" }}>
                  <label>Default Mode</label>
                  <select disabled>
                    <option value={webhookSettings.defaultMode}>
                      {webhookSettings.defaultMode}
                    </option>
                  </select>
                </div>
                
                <button 
                  className="btn btn-danger"
                  onClick={rotateWebhookCredentials}
                >
                  Rotate Credentials
                </button>
              </div>
            ) : (
              <div style={{
                textAlign: "center",
                padding: "40px",
                color: "#64748b"
              }}>
                <div style={{ fontSize: "2rem", marginBottom: "10px" }}>⚙️</div>
                <p>Loading webhook settings...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
