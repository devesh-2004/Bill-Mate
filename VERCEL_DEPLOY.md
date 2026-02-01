# How to Deploy BillMate to Vercel

The project build is successful and ready for deployment.

## Steps

1. **Go to Vercel Dashboard**: Log in to [vercel.com](https://vercel.com).
2. **Add New Project**: Click **"Add New..."** -> **"Project"**.
3. **Import Repository**: Select `Bill-Mate` (the repo you just pushed).
4. **Configure Project**:
   - **Framework Preset**: Next.js (should be auto-detected).
   - **Root Directory**: `./` (default).
5. **Environment Variables** (Crucial!):
   Copy these values from your `.env.local` file and add them in the "Environment Variables" section:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Optional, add if you start using admin features, but keep it secure).
6. **Deploy**: Click **"Deploy"**.

## If Deployment Fails
- Check the Vercel logs.
- Ensure all Environment Variables are pasted correctly (no extra spaces).
- If you see "Table not found" errors in the live app, ensure your `SOLVE_ERROR.sql` was run in Supabase.
