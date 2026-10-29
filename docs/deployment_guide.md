# MediPulse: Complete Deployment & Presentation Guide
### Ready-to-Use Deployment Strategies for College Presentations & Viva Evaluations

---

## 🎯 Executive Summary of Deployment Options

| Strategy | Best For | Cost | Setup Time | Uptime / Reliability |
| :--- | :--- | :--- | :--- | :--- |
| **Option 1: Live Public Tunnel (localtunnel/ngrok)** | **In-Person College Presentations / Viva** | Free | **30 Seconds** | ⭐⭐⭐⭐⭐ Zero cloud delay, runs directly from your laptop |
| **Option 2: Render.com Cloud Web Service** | **Permanent Public URL on GitHub** | Free | **3 Minutes** | ⭐⭐⭐⭐ Free tier (sleeps after 15m idle) |
| **Option 3: Hugging Face Spaces (Docker)** | **Academic Portfolio / Evaluator Sharing** | Free | **5 Minutes** | ⭐⭐⭐⭐⭐ Always awake, 16GB RAM free |
| **Option 4: Docker Container** | **Local Evaluator Machine / Cloud VM** | Free | **2 Minutes** | ⭐⭐⭐⭐⭐ Standardized container |

---

## Option 1: Instant Live HTTPS Link (Best for In-Person Presentations)

During college presentations, examiners often want to test the application on their own laptops, tablets, or mobile phones, or you may be presenting from a podium. 

Instead of dealing with cloud build times or free-tier cold starts, you can expose your local running app over a secure, encrypted HTTPS link in one click.

### Windows (1-Click):
Double-click:
```cmd
share_live_presentation.bat
```

### Or Manually via Terminal:
1. Start the unified server:
   ```cmd
   python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
   ```
2. In a second terminal, run:
   ```cmd
   npx localtunnel --port 8000
   ```
3. A public link will appear:
   ```text
   your url is: https://bright-pandas-sing.loca.lt
   ```
4. Open the link on any device. When prompted for a tunnel password, enter your external IP (localtunnel displays a link to view it in 1 click).

*(Alternative with Cloudflare Tunnel: `npx cloudflared tunnel --url http://127.0.0.1:8000`)*

---

## Option 2: 1-Click Cloud Deployment on Render.com (Permanent Web Service)

MediPulse includes a pre-configured [`render.yaml`](file:///c:/Users/Baskar/Documents/College/SEM-7/AIML/Mini-Project/render.yaml) that deploys the unified FastAPI + React app onto a single free web service.

### Step-by-Step Instructions:
1. **Push your code to GitHub**:
   ```cmd
   git add -A
   git commit -m "feat: add deployment configuration"
   git push -u origin main
   ```
2. Go to **[dashboard.render.com](https://dashboard.render.com)** and log in with GitHub.
3. Click **New +** → **Web Service**.
4. Select your **`MediPulse`** GitHub repository.
5. Fill in the deployment settings:
   - **Name:** `medipulse-analytics`
   - **Runtime:** `Python 3`
   - **Build Command:**
     ```bash
     pip install -r requirements_prod.txt && cd frontend && npm install && npm run build && cd ..
     ```
   - **Start Command:**
     ```bash
     uvicorn backend.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Instance Type:** `Free`
6. Click **Deploy Web Service**.
7. In ~2 minutes, Render will build the frontend assets, warm the ML models, and give you a public live URL:
   ```text
   https://medipulse-analytics.onrender.com
   ```

---

## Option 3: Deploy on Hugging Face Spaces (Ideal for AIML Projects)

Hugging Face Spaces offers free 16GB RAM cloud instances with persistent uptime and zero cold-start sleep.

### Step-by-Step Instructions:
1. Create a free account at **[huggingface.co](https://huggingface.co)**.
2. Click **New Space** (top right profile menu).
3. Set:
   - **Space Name:** `medipulse-readmission-analytics`
   - **License:** `mit`
   - **Space SDK:** Choose **Docker** → **Blank**.
   - **Visibility:** Public.
4. Click **Create Space**.
5. Clone your space repository locally or push your files:
   ```cmd
   git remote add hf https://huggingface.co/spaces/<YOUR_USERNAME>/medipulse-readmission-analytics
   git push hf main
   ```
   *Hugging Face automatically detects our [`Dockerfile`](file:///c:/Users/Baskar/Documents/College/SEM-7/AIML/Mini-Project/Dockerfile), builds the multi-stage image, and serves the app live.*

---

## Option 4: Deploy with Docker (Local or Cloud VM)

MediPulse includes a production multi-stage [`Dockerfile`](file:///c:/Users/Baskar/Documents/College/SEM-7/AIML/Mini-Project/Dockerfile) that compiles the React Vite frontend and copies the optimized Python serving environment.

### Run with Docker:
```bash
# 1. Build Docker image
docker build -t medipulse:latest .

# 2. Run container on port 8000
docker run -d -p 8000:8000 --name medipulse-container medipulse:latest
```
Visit **`http://localhost:8000`** in your browser.

### Run with Docker Compose:
```bash
docker compose up --build -d
```

---

## Option 5: Split Deployment (Frontend on Vercel + Backend on Render/Railway)

If you prefer deploying the React frontend on **Vercel** and the FastAPI backend on **Render**:

1. **Deploy Backend on Render** using instructions in Option 2, obtaining your API URL (e.g. `https://medipulse-api.onrender.com`).
2. **Deploy Frontend on Vercel**:
   - Go to [vercel.com](https://vercel.com) → Import Git repository.
   - Set **Root Directory** to `frontend`.
   - Add Environment Variable:
     - `VITE_API_URL` = `https://medipulse-api.onrender.com`
   - Click **Deploy**.

---

## 💡 Recommendation for Presentation Day

> [!TIP]
> **Recommended Strategy for In-Person Presentation:**
> 1. Use **Option 1 (`share_live_presentation.bat`)** on presentation day. This guarantees instant response times, zero cloud sleep delays, and displays the exact model outputs and Spark charts without depending on venue Wi-Fi speeds.
> 2. Have **Option 2 (Render)** or **Option 3 (Hugging Face)** deployed beforehand and put the link in your PPT slide so examiners can explore it after your presentation.
