# Railway Deployment Guide

Complete step-by-step guide to deploy this payment gateway on Railway.

## Prerequisites

- GitHub account
- Railway account (https://railway.app)
- A PostgreSQL database (Railway provides one)

## Step 1: Push to GitHub

1. VS Code → Source Control panel (Ctrl+Shift+G)
2. Commit message: "Initial project"
3. Click ✓ (Commit)
4. Click "Publish Branch"
5. Choose "Private" repository
6. Repo name: `payment-gateway`

## Step 2: Create Railway Project

1. Go to https://railway.app
2. Login with GitHub
3. Click **New Project**

## Step 3: Add PostgreSQL

1. In the new project, click **+ New**
2. Select **Database → PostgreSQL**
3. Wait for provisioning (30 seconds)
4. Click on the PostgreSQL service
5. Go to **Variables** tab
6. Copy `DATABASE_URL` value

## Step 4: Deploy Backend

1. In the same project, click **+ New → GitHub Repo**
2. Select your `payment-gateway` repository
3. Railway will detect the Dockerfile

### Configure Backend Service

Click on the backend service → **Settings**:

- **Root Directory**: `backend`
- **Build Command**: (leave empty, Docker handles it)
- **Start Command**: (leave empty, Docker CMD handles it)
- **Watch Paths**: `backend/**`

### Set Environment Variables

Click on backend service → **Variables** tab → **Raw Editor**

Paste the following (replace values):
