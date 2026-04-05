# Deployment Guide
Follow these steps to deploy your Plagiarism Detector for free.

## Phase 1: Deploying the Backend (API)
Your backend app contains both Python (Flask) and Java (JPlag) components. We have now added a `Dockerfile` that packages both together.

1. Commit your latest code to your **GitHub repository**.
2. Create an account on a platform that supports Docker deployments, such as [Koyeb](https://www.koyeb.com/) (Recommended) or [Render](https://render.com/).
3. Create a **New Service** (or Web Service) from your GitHub repository.
4. If prompted for a root directory, optionally specify `backend/` or just make sure it points to the `Dockerfile` inside the `backend` folder.
5. In the builder settings, select **Deploy from Dockerfile**. 
6. Set any Environment Variables if needed, but the default configuration will gracefully listen to the deployment port.
7. Click **Deploy**.
8. Wait a few minutes. Once successfully deployed, your platform will provide a public URL (e.g., `https://my-leetcode-api.koyeb.app`). Save this URL.

## Phase 2: Deploying the Frontend (UI)
The frontend uses Vite and React. We have updated your app to automatically point to our new Backend URL if we set a specific environment variable.

1. Create an account on [Vercel](https://vercel.com/) or [Netlify](https://www.netlify.com/). Vercel is highly recommended for Vite projects.
2. Click **Add New Project** and import your GitHub repository.
3. In the Vercel **Project Settings / Configure Project** page:
   - Expand the **Root Directory** section and change it to the `frontend` folder.
   - Vercel will automatically detect `Vite` and populate the Build and Output commands.
4. **Crucial Step**: Expand the **Environment Variables** section.
   - Key: `VITE_API_URL`
   - Value: `[Paste the Backend URL you got from Phase 1]` (e.g., `https://my-leetcode-api.koyeb.app`)
5. Click **Deploy**.
6. Once deployed, Vercel will also provide you with a live frontend URL (e.g., `https://leetcode-ui.vercel.app`), which you can now use to access your Plagiarism Detector!

## Notes on Ephemeral Storage
Free containers usually have ephemeral filesystems. Any files generated dynamically (such as cached submissions or SQLite file changes) will likely be erased when the server restarts or wakes up. Because we are downloading LeetCode submissions temporarily to process them, this resets everything perfectly. However, if you add database features later (like logging in to save preferences), you should connect an external managed database.
