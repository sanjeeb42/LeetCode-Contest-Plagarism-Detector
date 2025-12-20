# LeetCode Detective 🕵️‍♂️
> *Identify plagiarism clusters in LeetCode contests using JPlag and graph clustering.*

**Project developed in personal capacity.**

## Overview
This tool automates the process of fetching submission code from LeetCode contests, running the JPlag plagiarism detection engine, and visualizing the results. It groups users into "Threat Clusters" based on code similarity, allowing for granular inspection of copying rings on a per-question basis.

## Prerequisites

### 1. System Requirements
-   **Python 3.8+** (for backend service)
-   **Node.js 18+** & **npm** (for frontend UI)
-   **Java 17+** (Required for JPlag execution)

### 2. LeetCode Account (Optional but Recommended)
While the tool can fetch some data anonymously, providing a session cookie is recommended for fetching specific submission types and avoiding rate limits.

## Installation

### Backend Setup
1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Install required Python packages:
    ```bash
    pip install flask flask-cors requests python-dotenv curl_cffi
    ```
3.  (Optional) Create a `.env` file in the `backend` directory to add your session cookie:
    ```env
    LEETCODE_SESSION=your_cookie_value_here
    ```

### Frontend Setup
1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

## Usage

### 1. Start Support Service (Backend)
Open a terminal and run:
```bash
cd backend
python3 server.py
```
*The server will start on http://127.0.0.1:5050*

### 2. Launch Interface (Frontend)
Open a new terminal window and run:
```bash
cd frontend
npm run dev
```
*The application will open in your browser (typically http://localhost:5173)*

### 3. Workflow
1.  **Add Contest**: Enter the contest slug (e.g., `weekly-contest-481`) on the home screen.
2.  **Fetch Data**: Click "Fetch Submissions". The system will download code for the top ~2000 users.
3.  **Analyze**: Click "Run Intelligence Analysis". This executes JPlag and builds the similarity graph.
4.  **Inspect**: Click "View Report" to see the "Live Intelligence Feed".
    -   Use the **Slider** to adjust the similarity threshold (e.g., 80% to find obvious copies).
    -   Switch **Tabs** (Q1, Q2...) to view clusters specific to each question.
    -   **Export CSV**: Download a detailed report for offline review.

## Tech Stack
-   **Backend**: Flask, curl_cffi (concurrent fetching), JPlag (Java)
-   **Frontend**: React, Tailwind CSS, Framer Motion
-   **Logic**: Disjoint Set Union (DSU) for clustering, ThreadPoolExecutor for parallel I/O

---
*Made by Sanjeeb*
