import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export default function App() {
  // Session Authentication & Account States
  const [accessToken, setAccessToken] = useState('');
  const [user, setUser] = useState(null);
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Layout View Tabs Control ('DASHBOARD' vs 'PROJECT_BOARD')
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('DASHBOARD');
  const [dashboardMetrics, setDashboardMetrics] = useState(null);

  // Project Workspace Boundaries
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [uiError, setUiError] = useState('');
  const [projectActivity, setProjectActivity] = useState([]);

  // Advanced Kanban Board Grid States
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('MEDIUM');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [isTaskSubmitInFlight, setIsTaskSubmitInFlight] = useState(false);

  // Task Comments Modal Sub-Engine States
  const [activeInspectionTask, setActiveInspectionTask] = useState(null);
  const [taskComments, setTaskComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');

  // Server-Side Search, Filter, & Pagination Controllers
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isBoardLoading, setIsBoardLoading] = useState(false);

  const socketRef = useRef(null);

  const secureFetch = async (url, options = {}) => {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    let response = await fetch(url, options);

    if (response.status === 401 && accessToken) {
      try {
        const refreshResponse = await fetch('http://localhost:5000/api/auth/refresh', { method: 'POST' });
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          setAccessToken(refreshData.accessToken);
          options.headers['Authorization'] = `Bearer ${refreshData.accessToken}`;
          response = await fetch(url, options);
        } else {
          handleForcedLogout();
        }
      } catch (err) {
        handleForcedLogout();
      }
    }
    return response;
  };

  const handleForcedLogout = () => {
    setAccessToken(''); setUser(null); setCurrentProject(null);
    if (socketRef.current) socketRef.current.disconnect();
  };

  useEffect(() => {
    if (accessToken) {
      socketRef.current = io('http://localhost:5000', { auth: { token: accessToken } });
      return () => { if (socketRef.current) socketRef.current.disconnect(); };
    }
  }, [accessToken]);

  useEffect(() => {
    if (currentProject && socketRef.current && activeWorkspaceTab === 'PROJECT_BOARD') {
      socketRef.current.emit('join_project', { projectId: currentProject._id });
      
      socketRef.current.on('board_mutated', () => { fetchWorkspaceTasks(); fetchProjectLogs(); });
      socketRef.current.on('activity_updated', () => { fetchProjectLogs(); });
      socketRef.current.on('comment_pushed', ({ comment }) => {
        setTaskComments(prev => [...prev, comment]);
      });

      fetchWorkspaceTasks();
      fetchProjectLogs();

      return () => {
        if (socketRef.current) {
          socketRef.current.emit('leave_project', { projectId: currentProject._id });
          socketRef.current.off('board_mutated');
          socketRef.current.off('activity_updated');
          socketRef.current.off('comment_pushed');
        }
      };
    }
  }, [currentProject, currentPage, searchQuery, filterPriority, sortBy, activeWorkspaceTab]);

  useEffect(() => {
    if (accessToken) {
      fetchUserWorkspaces();
      if (activeWorkspaceTab === 'DASHBOARD') fetchDashboardMetrics();
    }
  }, [accessToken, activeWorkspaceTab]);

  const fetchUserWorkspaces = async () => {
    const res = await secureFetch('http://localhost:5000/api/projects');
    if (res.ok) setProjects(await res.json());
  };

  const fetchDashboardMetrics = async () => {
    const res = await secureFetch('http://localhost:5000/api/tasks/dashboard/metrics');
    if (res.ok) setDashboardMetrics(await res.json());
  };

  const fetchProjectLogs = async () => {
    if (!currentProject) return;
    const res = await secureFetch(`http://localhost:5000/api/tasks/${currentProject._id}/activity`);
    if (res.ok) setProjectActivity(await res.json());
  };

  const fetchWorkspaceTasks = async () => {
    if (!currentProject) return;
    setIsBoardLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: currentPage, limit: 6, sort: sortBy, search: searchQuery, priority: filterPriority
      });
      const res = await secureFetch(`http://localhost:5000/api/tasks/${currentProject._id}?${queryParams}`);
      const data = await res.json();
      if (res.ok) {
        setTasks(data.tasks || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err) {
      setUiError('Synchronization disruption.');
    } finally {
      setIsBoardLoading(false);
    }
  };

  const handleAuthenticationSubmit = async (e) => {
    e.preventDefault();
    setAuthError(''); setIsAuthLoading(true);
    const path = isLoginView ? 'login' : 'register';
    const payload = isLoginView ? { email, password } : { name, email, password };

    try {
      const res = await fetch(`http://localhost:5000/api/auth/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Verification rejected.');
      setAccessToken(data.accessToken);
      setUser(data.user);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projectTitle) return;
    const res = await secureFetch('http://localhost:5000/api/projects', {
      method: 'POST',
      body: JSON.stringify({ title: projectTitle })
    });
    if (res.ok) { setProjectTitle(''); fetchUserWorkspaces(); fetchDashboardMetrics(); }
  };

  const handleInviteUser = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setUiError('');
    const res = await secureFetch(`http://localhost:5000/api/projects/${currentProject._id}/invite`, {
      method: 'POST',
      body: JSON.stringify({ email: inviteEmail })
    });
    const data = await res.json();
    if (res.ok) { setInviteEmail(''); alert(data.message); }
    else { setUiError(data.message); }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle) return;
    setIsTaskSubmitInFlight(true); setUiError('');

    const res = await secureFetch('http://localhost:5000/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: newTaskTitle, description: newTaskDesc, priority: newTaskPriority,
        dueDate: newTaskDueDate || undefined, assignee: newTaskAssignee || undefined, project: currentProject._id
      })
    });
    if (res.ok) {
      setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskDueDate(''); setNewTaskAssignee('');
      fetchWorkspaceTasks();
    } else {
      const d = await res.json(); setUiError(d.message);
    }
    setIsTaskSubmitInFlight(false);
  };

  const handleMoveTask = async (taskId, currentStatus) => {
    setUiError('');
    const nextStatus = currentStatus === 'TODO' ? 'IN_PROGRESS' : 'DONE';
    const res = await secureFetch(`http://localhost:5000/api/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: nextStatus })
    });
    if (res.ok) fetchWorkspaceTasks();
    else { const d = await res.json(); setUiError(d.message); }
  };

  const launchInspectionComments = async (task) => {
    setActiveInspectionTask(task);
    const res = await secureFetch(`http://localhost:5000/api/tasks/${task._id}/comments`);
    if (res.ok) setTaskComments(await res.json());
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newCommentText) return;
    const res = await secureFetch(`http://localhost:5000/api/tasks/${activeInspectionTask._id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text: newCommentText })
    });
    if (res.ok) { setNewCommentText(''); }
  };

  if (!accessToken) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#0f172a', fontFamily: 'sans-serif' }}>
        <div style={{ padding: '40px', backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}>
          <h2 style={{ textAlign: 'center', color: '#1e293b' }}>TaskFlow Core Gateway</h2>
          <form onSubmit={handleAuthenticationSubmit}>
            {!isLoginView && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>Profile Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: '93%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
              </div>
            )}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '93%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>Secret Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '93%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} required />
            </div>
            {authError && <div style={{ color: 'red', marginBottom: '12px', fontWeight: 'bold' }}>⚠️ {authError}</div>}
            <button type="submit" disabled={isAuthLoading} style={{ width: '100%', padding: '12px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
              {isLoginView ? 'Sign In to Hub' : 'Register Account'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '20px', color: '#64748b', cursor: 'pointer' }} onClick={() => setIsLoginView(!isLoginView)}>
            {isLoginView ? "Need a platform account? Register here" : "Have gateway credentials? Sign in"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
      
      {/* SIDEBAR NAVIGATION CONTROL LAYER */}
      <aside style={{ width: '260px', backgroundColor: '#1e293b', color: '#fff', padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <h2>TaskFlow Hub</h2>
        <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>User: <strong style={{ color: '#3b82f6' }}>{user?.name}</strong></div>
        
        <button onClick={() => setActiveWorkspaceTab('DASHBOARD')} style={{ width: '100%', padding: '12px', textAlign: 'left', backgroundColor: activeWorkspaceTab === 'DASHBOARD' ? '#3b82f6' : 'transparent', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '16px' }}>
          📊 Personal Dashboard
        </button>

        <h4 style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '11px', margin: '0 0 10px 0' }}>Project Boards</h4>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {projects.map(p => (
            <div key={p._id} onClick={() => { setCurrentProject(p); setCurrentPage(1); setActiveWorkspaceTab('PROJECT_BOARD'); }} style={{ padding: '12px', borderRadius: '6px', backgroundColor: (currentProject?._id === p._id && activeWorkspaceTab === 'PROJECT_BOARD') ? '#3b82f6' : '#334155', marginBottom: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              📁 {p.title}
            </div>
          ))}
        </div>

        <form onSubmit={handleCreateProject} style={{ marginTop: '16px' }}>
          <input type="text" placeholder="Workspace Name" value={projectTitle} onChange={e => setProjectTitle(e.target.value)} style={{ width: '88%', padding: '8px', marginBottom: '8px', borderRadius: '4px', border: 'none', backgroundColor: '#334155', color: '#fff' }} />
          <button type="submit" style={{ width: '100%', padding: '8px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>+ Add Board</button>
        </form>
        <button onClick={handleForcedLogout} style={{ marginTop: '16px', padding: '10px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Sign Out</button>
      </aside>

      {/* CORE DISPLAY WORKSPACE INTERACTION CANVAS */}
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        {uiError && <div style={{ padding: '12px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#ef4444', borderRadius: '6px', marginBottom: '20px', fontWeight: 'bold' }}>⚠️ Action Blocked: {uiError}</div>}

        {/* COMPONENT 1: METRICS ANALYTICAL DASHBOARD SCREEN */}
        {activeWorkspaceTab === 'DASHBOARD' ? (
          <div>
            <h1 style={{ color: '#0f172a', margin: '0 0 24px 0' }}>My Enterprise Performance Ecosystem</h1>
            {dashboardMetrics ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                  <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 'bold' }}>Active Memberships</div>
                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#1e293b', marginTop: '8px' }}>{dashboardMetrics.projectCount} Projects</div>
                  </div>
                  <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 'bold' }}>Completed This Week</div>
                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#10b981', marginTop: '8px' }}>{dashboardMetrics.completedThisWeek} Cards</div>
                  </div>
                  <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 'bold' }}>Highest Risk Pipeline</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ef4444', marginTop: '12px' }}>{dashboardMetrics.highestOpenTasksProject}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <h3>My Task Allocations By Status</h3>
                    <p>📋 To Do Node Accumulation: <strong>{dashboardMetrics.statusMetrics?.TODO}</strong></p>
                    <p>⚡ Active Flights In Progress: <strong>{dashboardMetrics.statusMetrics?.IN_PROGRESS}</strong></p>
                    <p>✅ Resolved Done Columns: <strong>{dashboardMetrics.statusMetrics?.DONE}</strong></p>
                  </div>

                  <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <h3>Cross-Workspace Recent Activities</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {dashboardMetrics.chronologicalActivity?.map(log => (
                        <div key={log._id} style={{ fontSize: '13px', paddingBottom: '6px', borderBottom: '1px dashed #e2e8f0' }}>
                          📌 <strong>{log.user?.name}</strong> {log.details} inside <span style={{ color: '#3b82f6' }}>{log.project?.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : <p>Compiling database ledger indices...</p>}
          </div>
        ) : (
          
          /* COMPONENT 2: INTERACTIVE ACTION KANBAN BOARD SCREEN */
          <div>
            <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div>
                <h1>{currentProject.title}</h1>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Workspace Context: {currentProject._id}</p>
              </div>
              <form onSubmit={handleInviteUser} style={{ display: 'flex', gap: '8px' }}>
                <input type="email" placeholder="Collaborator email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} required />
                <button type="submit" style={{ padding: '8px 12px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>+ Invite Member</button>
              </form>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '24px' }}>
              
              {/* BOARD INTERACTION GRID CANVAS COLUMN */}
              <div>
                <section style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', gap: '12px' }}>
                  <input type="text" placeholder="🔍 Filter tasks by text search matching title..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', flex: 1 }} />
                  <select value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setCurrentPage(1); }} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    <option value="">All Priorities</option>
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    <option value="createdAt">Date Created</option>
                    <option value="dueDate">Due Date</option>
                    <option value="priority">Priority Rank</option>
                  </select>
                </section>

                <section style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '24px' }}>
                  <form onSubmit={handleCreateTask} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <input type="text" placeholder="Task Name *" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} required />
                    <input type="text" placeholder="Details" value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                    <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)} style={{ padding: '8px', borderRadius: '4px' }}>
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                    </select>
                    <input type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                    <select value={newTaskAssignee} onChange={e => setNewTaskAssignee(e.target.value)} style={{ padding: '8px', borderRadius: '4px' }}>
                      <option value="">Unassigned</option>
                      <option value="65f1a2b3c4d5e6f7a8b9c0d1">Alice Owner</option>
                      <option value="65f1a2b3c4d5e6f7a8b9c0d2">Bob Member</option>
                    </select>
                    <button type="submit" disabled={isTaskSubmitInFlight} style={{ padding: '10px 16px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Create Card</button>
                  </form>
                </section>

                {isBoardLoading ? <p>Syncing board vectors...</p> : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    {['TODO', 'IN_PROGRESS', 'DONE'].map(col => (
                      <div key={col} style={{ backgroundColor: '#edf2f7', padding: '12px', borderRadius: '8px', minHeight: '350px' }}>
                        <h4 style={{ margin: '0 0 12px 0', color: '#475569' }}>{col}</h4>
                        {tasks.filter(t => t.status === col).map(t => (
                          <div key={t._id} style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '6px', marginBottom: '12px', borderLeft: t.priority === 'HIGH' ? '4px solid #ef4444' : '4px solid #3b82f6' }}>
                            <h5 style={{ margin: '0 0 4px 0' }}>{t.title}</h5>
                            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 8px 0' }}>{t.description}</p>
                            <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                              <span style={{ fontSize: '10px', padding: '2px 4px', backgroundColor: '#f1f5f9', borderRadius: '4px' }}>{t.priority}</span>
                            </div>
                            <button onClick={() => launchInspectionComments(t)} style={{ width: '100%', padding: '6px', backgroundColor: '#cbd5e1', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '4px' }}>💬 Chat Remarks</button>
                            {col !== 'DONE' && (
                              <button onClick={() => handleMoveTask(t._id, t.status)} style={{ width: '100%', padding: '6px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Advance Column →</button>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                
                <footer style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
                  <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} style={{ padding: '6px 12px' }}>Prev</button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} style={{ padding: '6px 12px' }}>Next</button>
                </footer>
              </div>

              {/* REVERSE-CHRONOLOGICAL ACTIVITY FEEDS DISPLAY SIDEBAR */}
              <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', height: 'fit-content' }}>
                <h3 style={{ margin: '0 0 16px 0' }}>Workspace Activity Stream</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto' }}>
                  {projectActivity.map(log => (
                    <div key={log._id} style={{ fontSize: '12px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                      ⏱️ <strong>{log.user?.name}</strong> {log.details}
                      <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '2px' }}>{new Date(log.createdAt).toLocaleTimeString()}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* SYSTEM INSPECTION DIALOG MODAL: Real-Time Live Comments Container */}
      {activeInspectionTask && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '100%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3>Task Discussions: {activeInspectionTask.title}</h3>
              <button onClick={() => setActiveInspectionTask(null)} style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer' }}>✖</button>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px' }}>
              {taskComments.map(c => (
                <div key={c._id} style={{ padding: '8px', backgroundColor: '#fff', borderRadius: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>{c.author?.name} • {new Date(c.createdAt).toLocaleTimeString()}</div>
                  <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '4px' }}>{c.text}</div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px' }}>
              <input type="text" placeholder="Type a chat comment remark..." value={newCommentText} onChange={e => setNewCommentText(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e1' }} required />
              <button type="submit" style={{ padding: '10px 16px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Send</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}