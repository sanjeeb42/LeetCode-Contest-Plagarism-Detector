<div align="center">
  <h1>🕵️‍♂️ LeetCode Detective</h1>
  <p><em>Identify plagiarism clusters and code-copying rings in LeetCode contests using graph analysis.</em></p>

  <a href="https://leetcode-contest-plagarism-detector.vercel.app/" target="_blank">
    <img src="https://img.shields.io/badge/Live_Demo-Vercel-black?style=for-the-badge&logo=vercel" alt="Live Demo" />
  </a>
  <br />
  <br />
</div>

> [!CAUTION]
> **Educational Purpose Only**: This tool is designed strictly for educational purposes to demonstrate algorithms for similarity detection. It is **not** intended to target, harm, or disrupt LeetCode's platform or services. Please use responsibly and respect LeetCode's Terms of Service.

---

## 🌟 Overview
**LeetCode Detective** automates the process of fetching submission code from LeetCode contests, running the powerful **JPlag** plagiarism detection engine, and visually mapping the results. It groups users into "Threat Clusters" based on structural code similarity, allowing for granular inspection of copying rings on a per-question basis.

### ✨ Key Features
- **Anonymous Fetching**: High-concurrency data scraping via `curl_cffi` to evade fingerprint blocks.
- **Advanced Code Analysis**: Uses structural tokenization (JPlag) for C++, Java, and Python to catch logic copying, even if variable names are changed.
- **Reference Library**: Automatically skips over common ChatGPT boilerplate and known solutions if provided.
- **Cloud Persistence**: Seamlessly syncs your algorithms into S3-compatible cloud storage (like Supabase or Cloudflare R2).
- **Cluster Visualization**: Utilizes Disjoint Set Union (DSU) to group heavily duplicated submissions together.

---

## 💻 Tech Stack
- **Frontend**: React, Tailwind CSS, Framer Motion, Vite
- **Backend**: Flask, Python 3, `curl_cffi`, Boto3 (S3 Sync)
- **Engine**: JPlag (Java 17)
- **Deployment**: Vercel (Frontend), Render (Backend), Supabase (Persistent S3 Storage)

---

## 🚀 Live Demo & Deployment

You can use the live frontend directly here: **[LeetCode Detective via Vercel](https://leetcode-contest-plagarism-detector.vercel.app/)**

### Want to deploy your own?
1. **Frontend**: Import the `frontend` folder to Vercel and set `VITE_API_URL` to your backend URL.
2. **Backend**: Import the `backend` folder containing the `Dockerfile` to Render or any Docker host. 
3. **Cloud Storage**: Add standard S3 variables (`S3_BUCKET_NAME`, `S3_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) to the backend to enable persistent storage.

---

## 🛠️ Local Development

### 1. System Requirements
- **Python 3.9+** (For the backend service)
- **Node.js 18+** & **npm** (For the frontend UI)
- **Java 17+** (Required to run the JPlag engine)

### 2. Backend Setup
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Start the Flask API on port 5050
python3 server.py
```
*(Optional: Add `LEETCODE_SESSION=your_cookie_value` to a `.env` file to fetch specific private submission types and avoid limits).*

### 3. Frontend Setup
```bash
cd frontend

# Install Node dependencies
npm install

# Start the Vite development server
npm run dev
```

---

## 🔍 How to Use

1. **Add Contest**: Enter the contest slug (e.g., `weekly-contest-481`) on the Home screen.
2. **Fetch Submissions**: Click "Fetch Submissions". The backend will rapidly scrape solutions for the top 2000 users.
3. **Run Intelligence Analysis**: Clicking this executes the JPlag engine on all collected files and builds the similarity graph.
4. **Inspect Threat Clusters**: Click "View Report" to see the Live Intelligence Feed!
    - Use the **Slider** to adjust the similarity tolerance (e.g., set to 80% to filter out coincidences and find obvious copies).
    - Switch **Tabs (Q1, Q2...)** to view cheating rings specific to each question.
    - **Export CSV**: Download a detailed forensic report for offline review.

---
<div align="center">
  <i>Made by Sanjeeb</i>
</div>
