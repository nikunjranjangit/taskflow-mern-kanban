# TaskFlow MERN Kanban System

A **real-time, role-based project management system** featuring a dynamic Kanban board, isolated Socket.io workspaces, granular activity tracking, and an analytical performance metrics dashboard.

---

## 🚀 Features

* 🔐 **Secure Authentication & Authorization**

  * JWT Authentication with **Access Token + Refresh Token Rotation**
  * Secure **HttpOnly Cookies**
  * Role-based access (**Owner / Member**)

* 📋 **Dynamic Kanban Board**

  * Drag-and-drop task management
  * Task status tracking (**TODO, IN_PROGRESS, DONE**)
  * Task priority levels (**LOW, MEDIUM, HIGH**)

* ⚡ **Real-Time Collaboration**

  * Live updates using **Socket.io**
  * Isolated project workspaces for secure communication
  * Automatic reconnection handling during network interruptions

* 📊 **Performance Analytics Dashboard**

  * Workspace activity insights
  * Task performance tracking
  * Chronological activity monitoring

---

## 🛠️ Tech Stack

### Frontend

* **React.js (Vite)**
* **Tailwind CSS**
* **Context API**

**Why?**
React’s component-based architecture enables modular UI development and efficient state management, while Vite provides extremely fast hot-module replacement for smoother development.

### Backend

* **Node.js**
* **Express.js**
* **Socket.io**

**Why?**
Node.js and Express provide a lightweight, asynchronous runtime suitable for handling API requests and persistent WebSocket communication.

### Database

* **MongoDB (Mongoose)**

**Why?**
MongoDB’s document-based architecture integrates naturally with JSON-driven workflows and enables efficient relational referencing.

### Authentication

* **JWT Authentication**
* **Secure HttpOnly Cookies**
* **Refresh Token Rotation**

---

## 📊 Data Model & Relationships

The system follows a structured MongoDB relational design across four primary collections:

```text
[ User ] 📄 (1)
   │
   └─── 👥 Memberships ───► [ Workspace / Project ] 📄 (1)
                                 │
                                 ├─── 📋 [ Tasks ] 📄 (Many)
                                 │       │
                                 │       └─── 💬 [ Comments ] (Many)
                                 │
                                 └─── 📜 [ Activity Logs ] 📄 (Many)
```

### User Schema

Stores:

* Username
* Encrypted password (**bcrypt**)
* User tracking fields

### Workspace / Project Schema

Contains:

* Project metadata
* Member access control
* Role authorization (**Owner / Member**)

### Task Schema

Includes:

* Task columns (**TODO, IN_PROGRESS, DONE**)
* Task descriptions
* Priority levels (**LOW, MEDIUM, HIGH**)
* Assigned user references

### ActivityLog Schema

Tracks chronological project activities such as:

* `task_moved`
* `comment_added`

Each activity is mapped to a corresponding `projectId`.

---

## 🔐 Authentication & Refresh Token Flow

To maintain persistent login sessions securely, TaskFlow implements **Refresh Token Rotation**.

### Token Generation

After a successful login, the server generates:

#### Access Token

* Short-lived (**15 minutes**)
* Used to authenticate API requests

#### Refresh Token

* Long-lived (**7 days**)
* Stored securely using **HttpOnly Cookies**
* Protected against XSS attacks

### Automatic Token Refresh

When the access token expires:

1. Axios interceptors capture the `401 Unauthorized` response.
2. The frontend sends a request to:

```bash
/api/auth/refresh
```

3. The backend validates the refresh token.
4. If valid:

   * The previous refresh token is invalidated
   * A new token pair is generated
   * The session continues without interrupting the user workflow

---

## 🔌 WebSocket Architecture & Security

To ensure privacy and prevent cross-project event leakage, Socket.io communication is strictly isolated by project rooms.

### Authentication Handshake

At connection time:

* Socket requests are authenticated
* JWT payloads are verified through secure cookie parsing
* User identity is validated before connection approval

### Room Isolation

When a project board is opened:

The client emits:

```javascript
join_room(projectId)
```

The server:

* Validates workspace membership
* Confirms user authorization
* Joins the corresponding project room

### Targeted Event Broadcasting

After a database update is completed:

```javascript
io.to(projectId).emit('card_moved', updatedPayload);
```

This ensures updates are delivered **only to authorized members of that specific workspace**, instead of broadcasting globally.

### Disconnect Resilience

The client uses:

* Automatic reconnection
* Exponential backoff strategy

This helps restore socket connections seamlessly during temporary internet interruptions.

---

## ⚙️ Local Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/nikunjranjangit/taskflow-mern-kanban.git
cd taskflow-mern-kanban
```

### 2. Backend Setup

```bash
cd backend
npm install

# Create a .env file with your MongoDB URI and local environment variables

npm start
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
npm run dev
```

---

## 🧠 Challenges & Learnings

### Challenges Faced

Managing real-time Socket.io room handshakes alongside JWT cookie-based authentication required careful middleware structuring to prevent unauthorized cross-workspace communication.

### Future Improvements

With additional development time, the system could be enhanced by integrating a **Redis caching layer** to optimize activity feed performance for highly active workspaces.

---

## 📌 Project Overview

TaskFlow is designed to provide a secure, scalable, and collaborative project management experience with real-time updates, structured authorization, and performance visibility for teams.
