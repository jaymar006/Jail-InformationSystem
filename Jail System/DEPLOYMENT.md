# 🚀 Deployment Guide - Jail Information System

This guide will help you deploy your Jail Information System to the cloud so it can be accessed from anywhere.

## 📋 Prerequisites

- ✅ Code pushed to GitHub
- ✅ GitHub account
- ✅ Railway account (free)
- ✅ Vercel account (free)

## 🎯 Deployment Architecture

```
Frontend (React) → Vercel → https://your-app.vercel.app
Backend (Node.js) → Railway → https://your-app.railway.app
Database (SQLite) → Railway (persistent storage)
```

## 🔧 Step 1: Deploy Backend to Railway

### 1.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with your GitHub account
3. Authorize Railway to access your repositories

### 1.2 Deploy Backend
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose your repository: `Jail-InformationSystem`
4. Select **"Deploy"** (Railway will auto-detect it's a Node.js app)
5. Wait for deployment to complete

### 1.3 Configure Environment Variables
In Railway dashboard, go to your project → **Variables** tab and add:

```bash
JWT_SECRET=your_very_secure_jwt_secret_here_make_it_long_and_random
DB_PATH=/app/data/jail_visitation.sqlite
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url.vercel.app
```

**Important**: Replace `your_very_secure_jwt_secret_here_make_it_long_and_random` with a long, random string (at least 32 characters).

### 1.4 Get Backend URL
After deployment, Railway will provide a URL like:
`https://your-app-name.railway.app`

**Save this URL** - you'll need it for the frontend deployment.

## 🎨 Step 2: Deploy Frontend to Vercel

### 2.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with your GitHub account
3. Authorize Vercel to access your repositories

### 2.2 Deploy Frontend
1. Click **"New Project"**
2. Import your GitHub repository: `Jail-InformationSystem`
3. Configure the project:
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
4. Click **"Deploy"**

### 2.3 Configure Environment Variables
In Vercel dashboard, go to your project → **Settings** → **Environment Variables** and add:

```bash
REACT_APP_API_URL=https://your-backend-url.railway.app
```

**Important**: Replace `https://your-backend-url.railway.app` with your actual Railway backend URL.

### 2.4 Redeploy Frontend
After adding environment variables:
1. Go to **Deployments** tab
2. Click **"Redeploy"** on the latest deployment
3. Wait for deployment to complete

## 🔄 Step 3: Update Backend CORS

After getting your frontend URL from Vercel:

1. Go back to Railway dashboard
2. Update the `FRONTEND_URL` environment variable with your Vercel URL
3. Railway will automatically redeploy

## ✅ Step 4: Test Your Deployment

### 4.1 Test Backend
Visit: `https://your-backend-url.railway.app/api/health`
You should see:
```json
{
  "status": "OK",
  "message": "Server is running!",
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

### 4.2 Test Frontend
Visit: `https://your-frontend-url.vercel.app`
You should see your Jail Information System login page.

### 4.3 Test Full Application
1. Login with your credentials
2. Test creating a PDL
3. Test adding visitors
4. Test all major features

## 🛠️ Troubleshooting

### Backend Issues
- **CORS errors**: Check that `FRONTEND_URL` in Railway matches your Vercel URL exactly
- **Database issues**: Railway provides persistent storage, but you may need to re-import your data
- **Environment variables**: Make sure all required variables are set in Railway

### Frontend Issues
- **API connection errors**: Verify `REACT_APP_API_URL` is set correctly in Vercel
- **Build failures**: Check that all dependencies are in `package.json`
- **Routing issues**: The `vercel.json` file handles client-side routing

### Database Migration
If you need to migrate your existing SQLite database:

1. **Export your local database**:
   ```bash
   # Copy your local database file
   cp backend/data/jail_visitation.sqlite ./backup.sqlite
   ```

2. **Upload to Railway** (if needed):
   - Railway provides persistent storage automatically
   - Your database will be created on first run

## 🔐 Security Notes

- ✅ JWT secret is now environment-based (secure)
- ✅ CORS is configured for your specific frontend URL
- ✅ Database is persistent on Railway
- ✅ All sensitive data is in environment variables

## 📱 Access Your Application

Once deployed, you can access your Jail Information System from anywhere:

- **Frontend**: `https://your-app.vercel.app`
- **Backend API**: `https://your-app.railway.app`

## 🆘 Support

If you encounter issues:
1. Check Railway logs in the dashboard
2. Check Vercel logs in the dashboard
3. Verify all environment variables are set correctly
4. Test the health endpoint: `/api/health`

## 🎉 Congratulations!

Your Jail Information System is now live and accessible from anywhere in the world! 🌍
