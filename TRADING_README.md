# Simple Trader - Order Placement & Paper Trading System

A comprehensive trading system that accepts signals from Chartlink, simulates orders with realistic fills, and optionally executes them on Fyers with robust validations.

## 🚀 Features

### Core Functionality
- **Chartlink Integration**: Secure webhook endpoint for receiving strategy alerts
- **Paper Trading**: Realistic order simulation with market data-based fills
- **Live Execution**: Optional Fyers API integration for real order placement
- **Order Management**: Complete order lifecycle with state tracking
- **Position Tracking**: Real-time P&L calculation and position management
- **Risk Management**: Comprehensive validation and guardrails

### Safety Features
- **Safe by Default**: All orders default to paper mode
- **Strong Validations**: Tick size, lot size, risk checks, and symbol allowlists
- **Idempotency**: Duplicate alert prevention with unique keys
- **Rate Limiting**: Per-user request throttling
- **Manual Review**: Optional approval queue for incoming signals

## 🏗️ Architecture

### Backend (Express.js + Prisma + PostgreSQL)
- **Webhook Service**: Secure Chartlink alert processing
- **Order Validation**: Comprehensive pre-execution checks
- **Paper Engine**: State machine for realistic order simulation
- **Fyers Service**: Live order execution wrapper
- **Symbol Master**: Tick size and lot size metadata service
- **Market Data**: Real-time quotes and LTP fetching

### Frontend (Next.js)
- **Trading Dashboard**: Order management and position tracking
- **Settings Panel**: Webhook configuration and mode selection
- **Order Placement**: Manual order entry with validation
- **Portfolio View**: Real-time P&L and position monitoring

### Database Schema
- **Users**: Authentication and settings
- **Strategies**: Trading strategy configurations
- **Alerts**: Incoming Chartlink signals
- **Orders**: Order lifecycle tracking
- **Executions**: Fill records and trade history
- **Positions**: Current holdings and P&L
- **Portfolios**: Portfolio-level metrics
- **Symbol Meta**: Market metadata cache

## 📋 API Endpoints

### Trading Operations
- `POST /api/orders` - Place new order
- `GET /api/orders` - List user orders
- `GET /api/orders/:id` - Get specific order
- `POST /api/orders/:id/cancel` - Cancel order
- `POST /api/orders/:id/modify` - Modify order

### Data Retrieval
- `GET /api/executions` - Get trade executions
- `GET /api/positions` - Get current positions
- `GET /api/portfolio` - Get portfolio summary
- `GET /api/symbols/meta` - Get symbol metadata

### Configuration
- `GET /api/settings/webhook` - Get webhook settings
- `POST /api/settings/webhook/rotate` - Rotate webhook credentials
- `POST /api/settings` - Update user settings

### Strategy Management
- `GET /api/strategies` - List strategies
- `POST /api/strategies` - Create strategy
- `PUT /api/strategies/:id` - Update strategy
- `DELETE /api/strategies/:id` - Delete strategy

### Webhook Integration
- `POST /webhooks/chartlink/:userToken` - Chartlink alert endpoint

## 🔧 Setup Instructions

### Prerequisites
- Node.js 16+
- PostgreSQL database
- Fyers API credentials
- Railway account (for deployment)

### Backend Setup

1. **Install dependencies**:
   ```bash
   cd server
   npm install
   ```

2. **Environment variables**:
   ```bash
   cp env.example .env
   ```
   
   Configure `.env`:
   ```env
   PORT=8080
   FYERS_APP_ID=your_fyers_app_id
   FYERS_SECRET_KEY=your_fyers_secret
   FYERS_REDIRECT_URL=https://your-railway-app.up.railway.app/auth/callback
   FRONTEND_URL=https://your-frontend.vercel.app
   DATABASE_URL=postgresql://user:password@localhost:5432/simple_trader
   FYERS_ENABLE_LOGGING=0
   LOG_PATH=/tmp
   APP_BASE_URL=https://your-railway-app.up.railway.app
   PAPER_SLIPPAGE_BPS=10
   MAX_NOTIONAL_PER_ORDER=1000000
   MAX_ORDERS_PER_MINUTE=10
   ```

3. **Database setup**:
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. **Install dependencies**:
   ```bash
   cd web
   npm install
   ```

2. **Environment variables**:
   ```bash
   cp env.local.example .env.local
   ```
   
   Configure `.env.local`:
   ```env
   NEXT_PUBLIC_API_BASE_URL=https://your-railway-app.up.railway.app
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

## 🔐 Security Features

### Webhook Security
- **Unique Tokens**: Per-user webhook URLs with random tokens
- **Secret Validation**: HMAC-based signature verification
- **Rate Limiting**: 100 requests per minute per user
- **Idempotency**: Duplicate alert prevention

### Order Validation
- **Tick Size Validation**: All prices must be valid tick multiples
- **Lot Size Validation**: Quantities must match symbol lot sizes
- **Risk Limits**: Notional limits per order and per day
- **Symbol Allowlists**: Restrict trading to approved symbols
- **Market Hours**: Respect trading session windows

### Data Protection
- **HTTP-Only Cookies**: Secure token storage
- **CORS Configuration**: Restricted origin access
- **Input Sanitization**: All user inputs validated
- **SQL Injection Prevention**: Prisma ORM protection

## 📊 Order Types Supported

### Basic Orders
- **Market Orders**: Immediate execution at current market price
- **Limit Orders**: Execution at specified price or better
- **Stop Orders**: Triggered when price crosses stop level
- **Stop-Limit Orders**: Stop order that becomes limit order

### Advanced Orders
- **Cover Orders (CO)**: Mandatory stop loss with market/limit execution
- **Bracket Orders (BO)**: Both stop loss and take profit levels
- **MTF Orders**: Margin Trading Facility (requires approval)

### Product Types
- **INTRADAY**: Same-day execution
- **CNC**: Cash and Carry (equity delivery)
- **MARGIN**: Margin trading
- **CO/BO**: Specialized order types

## 🎯 Paper Trading Engine

### Fill Simulation
- **Market Orders**: Fill at LTP ± configurable slippage
- **Limit Orders**: Fill when market touches limit price
- **Stop Orders**: Convert to market when triggered
- **Realistic Spreads**: Uses bid-ask data for accurate fills

### State Machine
```
new → working → filled/cancelled/rejected
```

### Position Management
- **Average Price Calculation**: Weighted average on fills
- **P&L Tracking**: Real-time mark-to-market
- **Portfolio Aggregation**: Total portfolio metrics

## 🔄 Chartlink Integration

### Alert Format
Chartlink sends alerts with fields like:
```json
{
  "symbol": "NSE:SBIN-EQ",
  "side": "BUY",
  "order_type": "MARKET",
  "quantity": 100,
  "product_type": "INTRADAY",
  "unique_id": "alert_123"
}
```

### Field Mapping
- `symbol` → Order symbol
- `side` → Buy/Sell (1/-1)
- `order_type` → Order type (1-4)
- `quantity` → Order quantity
- `product_type` → Product type
- `unique_id` → Idempotency key

### Webhook URL Format
```
https://your-app.com/webhooks/chartlink/{userToken}
```

## 🚀 Deployment

### Railway (Backend)
1. Connect GitHub repository
2. Set root directory to `server`
3. Configure environment variables
4. Deploy automatically on push

### Vercel (Frontend)
1. Connect GitHub repository
2. Set root directory to `web`
3. Configure environment variables
4. Deploy automatically on push

### Fyers App Configuration
1. Create app at [Fyers Developer Portal](https://myapi.fyers.in/)
2. Set redirect URL to your Railway callback URL
3. Copy App ID and Secret to environment variables

## 📈 Monitoring & Analytics

### Health Endpoints
- `GET /api/trading/health` - System health status
- `GET /api/trading/stats` - Trading statistics
- `GET /health` - Basic health check
- `GET /health/db` - Database connectivity

### Event Logging
All trading events are logged with:
- Order placements and fills
- Alert processing
- Error conditions
- System state changes

### Performance Metrics
- Order processing latency
- Fill simulation accuracy
- API response times
- Error rates and types

## 🛠️ Development

### Adding New Order Types
1. Update validation in `orderValidation.js`
2. Add fill logic in `paperEngine.js`
3. Update Fyers service if needed
4. Add UI components in frontend

### Extending Market Data
1. Add new endpoints in `marketData.js`
2. Update symbol master with new metadata
3. Enhance fill simulation algorithms
4. Update frontend displays

### Custom Risk Rules
1. Modify validation pipeline
2. Add new risk checks
3. Update user settings schema
4. Add configuration UI

## 🔍 Testing

### Manual Testing
1. **Paper Orders**: Use the trading dashboard to place test orders
2. **Webhook Testing**: Send test alerts to webhook endpoint
3. **Live Orders**: Test with small quantities in live mode
4. **Error Handling**: Test invalid inputs and edge cases

### Test Scenarios
- Order validation with various inputs
- Fill simulation accuracy
- Position calculation correctness
- Webhook idempotency
- Rate limiting behavior
- Error recovery

## 📚 API Documentation

### Order Placement
```javascript
POST /api/orders
{
  "symbol": "NSE:SBIN-EQ",
  "side": 1,
  "type": 2,
  "productType": "INTRADAY",
  "qty": 100,
  "limitPrice": 500.00,
  "mode": "paper"
}
```

### Webhook Alert
```javascript
POST /webhooks/chartlink/{userToken}
Headers: X-Webhook-Secret: {secret}
{
  "symbol": "NSE:SBIN-EQ",
  "side": "BUY",
  "order_type": "MARKET",
  "quantity": 100,
  "unique_id": "alert_123"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the documentation
2. Review existing issues
3. Create a new issue with details
4. Contact the development team

## 🔮 Roadmap

### Phase 1 ✅
- Paper trading engine
- Basic order placement
- Chartlink webhook integration

### Phase 2 🚧
- Live order execution
- Advanced order types (CO/BO)
- WebSocket order updates

### Phase 3 📋
- Advanced risk management
- Strategy backtesting
- Performance analytics
- Mobile app

### Phase 4 🎯
- Multi-broker support
- Advanced charting
- Social trading features
- API marketplace
