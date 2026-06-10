# TaskFlow MERN Kanban System

A real-time, role-based project management system featuring a dynamic Kanban board, isolated Socket.io workspaces, granular activity tracking, and an analytical performance metrics dashboard.

## 🚀 Key Features
- **Real-Time Kanban Sync:** Project boards update instantly across team members using scoped Socket.io rooms.
- **Role-Based Access Control (RBAC):** Strict front-end route masking and server-side JWT verification separating Project Owners from Workspace Members.
- **Granular Activity Logs:** Automated database logging of task movements, column state transitions, and user comments.
- **Metrics Dashboard:** Cross-workspace analytics displaying task completion metrics and real-time team activity streams.

## 🛠️ Tech Stack
- **Frontend:** React.js, Tailwind CSS, Context API
- **Backend:** Node.js, Express.js, Socket.io
- **Database:** MongoDB (via Mongoose)
- **Authentication:** JSON Web Tokens (JWT) with Secure HttpOnly Cookies

## 📦 Local Installation & Setup
## 1. Clone the Repository

```bash
git clone https://github.com/nikunranjangit/taskflow-mern-kanban.git
cd taskflow-mern-kanban
```

## 2. Backend Setup

```bash
cd backend
npm install
# Create a .env file based on the keys outlined in .env.example
npm start
```

## 3. Frontend Setup

```bash
cd ../frontend
npm install
npm start
```
