# Deployment Guide - Simple Trader

This guide covers deploying the Simple Trader application to production environments.

## 🚀 Quick Deployment

### Prerequisites
- GitHub repository with the code
- Railway account (for backend)
- Vercel account (for frontend)
- Fyers API credentials
- PostgreSQL database

## 📦 Backend Deployment (Railway)

### 1. Connect Repository
1. Go to [Railway](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Set root directory to `server`

### 2. Environment Variables
Configure these environment variables in Railway:

```env
# Server Configuration
PORT=8080
NODE_ENV=production

# Fyers API Configuration
FYERS_APP_ID=your_fyers_app_id
FYERS_SECRET_KEY=your_fyers_secret
FYERS_REDIRECT_URL=https://your-railway-app.up.railway.app/auth/callback
FYERS_ENABLE_LOGGING=0
LOG_PATH=/tmp

# Frontend Configuration
FRONTEND_URL=https://your-vercel-app.vercel.app

# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/database

# Application Configuration
APP_BASE_URL=https://your-railway-app.up.railway.app

# Trading Configuration
PAPER_SLIPPAGE_BPS=10
MAX_NOTIONAL_PER_ORDER=1000000
MAX_ORDERS_PER_MINUTE=10
ALLOWED_SYMBOLS_DEFAULT=NSE:SBIN-EQ,NSE:TCS-EQ,NSE:RELIANCE-EQ
```

### 3. Database Setup
Railway will automatically:
- Run `prisma migrate deploy` on startup
- Generate Prisma client
- Create database tables

### 4. Custom Domain (Optional)
1. Go to your Railway project settings
2. Add custom domain
3. Update `FRONTEND_URL` and `FYERS_REDIRECT_URL` accordingly

## 🌐 Frontend Deployment (Vercel)

### 1. Connect Repository
1. Go to [Vercel](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Set root directory to `web`

### 2. Environment Variables
Configure these environment variables in Vercel:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-railway-app.up.railway.app
```

### 3. Build Settings
Vercel will automatically detect Next.js and configure:
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

### 4. Custom Domain (Optional)
1. Go to your Vercel project settings
2. Add custom domain
3. Update `NEXT_PUBLIC_API_BASE_URL` accordingly

## 🔧 Fyers App Configuration

### 1. Create Fyers App
1. Go to [Fyers Developer Portal](https://myapi.fyers.in/)
2. Create a new app
3. Set app name and description

### 2. Configure Redirect URL
Set the redirect URL to:
```
https://your-railway-app.up.railway.app/auth/callback
```

### 3. Get Credentials
Copy the following from your Fyers app:
- App ID
- Secret Key
- Add these to your Railway environment variables

## 🗄️ Database Setup

### Option 1: Railway PostgreSQL (Recommended)
1. In your Railway project, add PostgreSQL service
2. Railway will automatically provide `DATABASE_URL`
3. No additional configuration needed

### Option 2: External PostgreSQL
1. Use services like:
   - Supabase
   - PlanetScale
   - AWS RDS
   - Google Cloud SQL
2. Get connection string
3. Add to Railway environment variables

## 🔐 Security Configuration

### 1. CORS Settings
Ensure `FRONTEND_URL` in Railway matches your Vercel domain exactly:
```env
FRONTEND_URL=https://your-vercel-app.vercel.app
```

### 2. Cookie Security
Production cookies are automatically configured with:
- `secure: true`
- `sameSite: "none"`
- `httpOnly: true`

### 3. Environment Variables
Never commit sensitive data:
- Add `.env` to `.gitignore`
- Use Railway/Vercel environment variables
- Rotate secrets regularly

## 📊 Monitoring & Logs

### Railway Logs
1. Go to your Railway project
2. Click on "Deployments"
3. View real-time logs
4. Monitor resource usage

### Vercel Analytics
1. Enable Vercel Analytics in project settings
2. Monitor performance metrics
3. Track user interactions

### Application Health
Monitor these endpoints:
- `GET /health` - Basic health check
- `GET /health/db` - Database connectivity
- `GET /api/trading/health` - Trading system status

## 🔄 CI/CD Pipeline

### Automatic Deployments
Both Railway and Vercel support automatic deployments:
- Push to `main` branch triggers deployment
- Preview deployments for pull requests
- Rollback capabilities

### Manual Deployments
1. **Railway**: Click "Deploy" button
2. **Vercel**: Click "Deploy" button or push to branch

## 🧪 Testing Deployment

### 1. Health Checks
```bash
# Test backend
curl https://your-railway-app.up.railway.app/health

# Test frontend
curl https://your-vercel-app.vercel.app
```

### 2. Authentication Flow
1. Visit your Vercel app
2. Click "Login with Fyers"
3. Complete OAuth flow
4. Verify dashboard loads

### 3. Trading Features
1. Navigate to trading dashboard
2. Place a paper order
3. Verify order appears in orders list
4. Test webhook endpoint

## 🚨 Troubleshooting

### Common Issues

#### 1. CORS Errors
**Problem**: Frontend can't connect to backend
**Solution**: 
- Verify `FRONTEND_URL` matches Vercel domain exactly
- Check for trailing slashes
- Ensure HTTPS is used

#### 2. Database Connection Issues
**Problem**: Database connection failed
**Solution**:
- Verify `DATABASE_URL` is correct
- Check database service is running
- Ensure network connectivity

#### 3. Fyers Authentication Issues
**Problem**: OAuth flow fails
**Solution**:
- Verify redirect URL in Fyers app settings
- Check `FYERS_REDIRECT_URL` environment variable
- Ensure app credentials are correct

#### 4. Webhook Not Working
**Problem**: Chartlink alerts not received
**Solution**:
- Check webhook URL format
- Verify webhook secret
- Test with curl or Postman

### Debug Mode
Enable debug logging by setting:
```env
FYERS_ENABLE_LOGGING=1
```

### Log Analysis
1. Check Railway logs for errors
2. Monitor Vercel function logs
3. Use browser dev tools for frontend issues

## 📈 Performance Optimization

### Backend Optimization
1. **Database Indexing**: Ensure proper indexes on frequently queried columns
2. **Connection Pooling**: Prisma handles this automatically
3. **Caching**: Symbol metadata is cached in memory
4. **Rate Limiting**: Built-in rate limiting for webhooks

### Frontend Optimization
1. **Static Generation**: Next.js optimizes automatically
2. **Image Optimization**: Built-in Next.js image optimization
3. **Code Splitting**: Automatic code splitting
4. **CDN**: Vercel provides global CDN

### Monitoring
1. **Railway Metrics**: Monitor CPU, memory, and network usage
2. **Vercel Analytics**: Track Core Web Vitals
3. **Application Metrics**: Custom trading metrics via API

## 🔄 Updates & Maintenance

### Regular Updates
1. **Dependencies**: Keep packages updated
2. **Security Patches**: Apply security updates promptly
3. **Database Migrations**: Run migrations carefully
4. **Feature Updates**: Deploy new features incrementally

### Backup Strategy
1. **Database Backups**: Railway provides automatic backups
2. **Code Backups**: GitHub provides version control
3. **Configuration Backups**: Document environment variables

### Rollback Plan
1. **Railway**: Use deployment history to rollback
2. **Vercel**: Use deployment history to rollback
3. **Database**: Use migration rollback commands

## 📞 Support

### Getting Help
1. Check this documentation
2. Review application logs
3. Check GitHub issues
4. Contact development team

### Emergency Procedures
1. **Service Down**: Check Railway/Vercel status pages
2. **Database Issues**: Check database service status
3. **Security Issues**: Rotate credentials immediately
4. **Data Loss**: Restore from backups

## 🎯 Production Checklist

Before going live, ensure:

- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] Fyers app configured correctly
- [ ] CORS settings verified
- [ ] SSL certificates active
- [ ] Monitoring configured
- [ ] Backup strategy in place
- [ ] Error handling tested
- [ ] Performance optimized
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Team trained on deployment process

## 📋 Post-Deployment

### Initial Testing
1. Test all major features
2. Verify webhook integration
3. Check order placement
4. Validate position tracking
5. Test error scenarios

### Monitoring Setup
1. Set up alerts for critical errors
2. Monitor key metrics
3. Track user activity
4. Monitor system performance

### User Onboarding
1. Create user documentation
2. Set up support channels
3. Train support team
4. Create troubleshooting guides
