import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, Database, HardDrive, DollarSign, UserCheck, Activity,
  Trash2, UserMinus, RefreshCw, ShieldAlert, Search, Upload, Lock,
  CheckCircle, AlertTriangle, XCircle, FileBox, Eye,
  Info, Zap,
  Crown, Star, ChevronLeft, ChevronRight,
  Shield, Server, MoreVertical, Key
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, PieChart as RechartsPie,
  Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip
} from 'recharts';
import { api } from './api';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function getRelativeTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatAbsoluteDate(isoString) {
  if (!isoString) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(isoString));
}

const PLAN_COLORS = { Free: '#64748b', Pro: '#4f46e5', Enterprise: '#8b5cf6' };

function AnimatedCounter({ value, duration = 800 }) {
  const isNumber = typeof value === 'number';
  const numericVal = isNumber ? value : parseFloat(String(value).replace(/[^0-9.]/g, '')) || 0;
  const isCurrency = String(value).startsWith('₹');
  const isBytes = String(value).endsWith('B') || String(value).includes('KB') || String(value).includes('MB') || String(value).includes('GB') || String(value).includes('TB');
  
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = numericVal;
    if (end === 0) {
      setCount(0);
      return;
    }
    const totalMiliseconds = duration;
    const incrementTime = 16;
    const steps = Math.ceil(totalMiliseconds / incrementTime);
    const increment = end / steps;
    let timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(start);
      }
    }, incrementTime);

    return () => clearInterval(timer);
  }, [numericVal, duration]);

  if (!isNumber && !isCurrency && !isBytes) {
    return <span>{value}</span>;
  }

  if (isCurrency) {
    return <span>₹{Math.floor(count).toLocaleString('en-IN')}</span>;
  }
  
  if (isBytes) {
    return <span>{value}</span>;
  }

  return <span>{Math.floor(count).toLocaleString()}</span>;
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600 mb-4 shadow-sm">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-500 max-w-sm leading-relaxed">{description}</p>
    </div>
  );
}

function StatCard({ label, value, subtext, icon, iconBg = 'bg-purple-50', iconColor = 'text-purple-600' }) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-purple-200 transition-all duration-300 text-left relative overflow-hidden flex flex-col justify-between h-36">
      <div className="absolute inset-0 bg-gradient-to-tr from-purple-50/0 to-purple-50/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <div className="flex items-start justify-between gap-4 relative z-10">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-800 truncate">
            <AnimatedCounter value={value} />
          </p>
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 ${iconBg} ${iconColor} shadow-sm`}>
          {icon}
        </div>
      </div>
      {subtext && (
        <p className="text-xs font-medium text-slate-400 relative z-10 flex items-center gap-1 mt-auto">
          {subtext}
        </p>
      )}
    </div>
  );
}

function HealthChip({ status }) {
  const s = String(status || '').toLowerCase();
  if (s === 'healthy') return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Healthy
    </span>
  );
  if (s === 'degraded') return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
      <AlertTriangle className="h-3 w-3 text-amber-500" /> Degraded
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 border border-red-200">
      <XCircle className="h-3 w-3 text-red-500" /> Offline
    </span>
  );
}

function ActionBadge({ action }) {
  const norm = String(action || '').toLowerCase();
  const variants = {
    login: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    upload: 'bg-blue-50 text-blue-700 border-blue-200',
    delete: 'bg-red-50 text-red-600 border-red-200',
    invoice: 'bg-purple-50 text-purple-700 border-purple-200',
    subscription: 'bg-amber-50 text-amber-700 border-amber-200',
    failed: 'bg-rose-100 text-rose-700 border-rose-200',
    registration: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };
  const key = Object.keys(variants).find(k => norm.includes(k)) || 'login';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border ${variants[key]}`}>
      {action}
    </span>
  );
}

function PlanBadge({ plan }) {
  const variants = {
    Enterprise: 'bg-purple-50 text-purple-700 border-purple-200',
    Pro: 'bg-blue-50 text-blue-700 border-blue-200',
    Free: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${variants[plan] || variants.Free}`}>
      {plan}
    </span>
  );
}

function UserAvatar({ name }) {
  const initials = (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const hue = [...(name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
      style={{ background: `linear-gradient(135deg, hsl(${hue},60%,55%), hsl(${(hue + 40) % 360},70%,50%))` }}>
      {initials}
    </div>
  );
}

const TABS = [
  { id: 'overview',      label: 'Overview',         icon: <Activity className="h-4 w-4" /> },
  { id: 'users',         label: 'User Management',  icon: <Users className="h-4 w-4" /> },
  { id: 'files',         label: 'File Metadata',    icon: <FileBox className="h-4 w-4" /> },
  { id: 'audit',         label: 'Audit Logs',       icon: <ShieldAlert className="h-4 w-4" /> },
  { id: 'health',        label: 'System Health',    icon: <Server className="h-4 w-4" /> },
  { id: 'optimization',  label: 'Optimization',     icon: <Zap className="h-4 w-4" /> },
];

function SubscriptionDonut({ cards }) {
  if (!cards) return null;
  const data = [
    { name: 'Free', value: cards.free_users || 0 },
    { name: 'Pro', value: cards.pro_users || 0 },
    { name: 'Enterprise', value: cards.enterprise_users || 0 },
  ].filter(d => d.value > 0);
  if (data.length === 0) return <div className="flex h-48 items-center justify-center text-sm text-slate-400">No data yet</div>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <RechartsPie>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
          {data.map(entry => <Cell key={entry.name} fill={PLAN_COLORS[entry.name]} />)}
        </Pie>
        <Tooltip formatter={v => [v, 'Users']} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
      </RechartsPie>
    </ResponsiveContainer>
  );
}

function StorageByPlanChart({ users }) {
  const data = useMemo(() => {
    if (!users || users.length === 0) return [];
    const byPlan = {};
    users.forEach(u => { byPlan[u.plan] = (byPlan[u.plan] || 0) + (u.storage_used || 0); });
    return Object.entries(byPlan).map(([plan, bytes]) => ({ plan, gb: +(bytes / (1024 ** 3)).toFixed(3) }));
  }, [users]);
  if (data.length === 0) return <div className="flex h-48 items-center justify-center text-sm text-slate-400">No storage data yet</div>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="plan" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
        <YAxis width={60} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} unit=" GB" />
        <Tooltip cursor={false} formatter={v => [`${v} GB`, 'Storage']} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
        <Bar dataKey="gb" name="Storage" radius={[4, 4, 0, 0]}>
          {data.map(entry => <Cell key={entry.plan} fill={PLAN_COLORS[entry.plan] || '#4f46e5'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function UploadsBarChart({ users }) {
  const data = useMemo(() => {
    if (!users || users.length === 0) return [];
    const byPlan = {};
    users.forEach(u => { byPlan[u.plan] = (byPlan[u.plan] || 0) + (u.files_uploaded || 0); });
    return Object.entries(byPlan).map(([plan, files]) => ({ plan, files }));
  }, [users]);
  if (data.length === 0) return <div className="flex h-48 items-center justify-center text-sm text-slate-400">No upload data yet</div>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="plan" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
        <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip cursor={false} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
        <Bar dataKey="files" name="Files" radius={[4, 4, 0, 0]}>
          {data.map(entry => <Cell key={entry.plan} fill={PLAN_COLORS[entry.plan] || '#4f46e5'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function activityStyle(action) {
  const norm = String(action || '').toLowerCase();
  if (norm.includes('upload')) return 'bg-blue-100 text-blue-600';
  if (norm.includes('delete')) return 'bg-red-100 text-red-600';
  if (norm.includes('subscription')) return 'bg-amber-100 text-amber-600';
  if (norm.includes('invoice')) return 'bg-purple-100 text-purple-600';
  if (norm.includes('fail')) return 'bg-rose-100 text-rose-600';
  if (norm.includes('registration')) return 'bg-indigo-100 text-indigo-600';
  return 'bg-emerald-100 text-emerald-600';
}

function ActivityTimeline({ logs }) {
  if (!logs || logs.length === 0) return (
    <EmptyState
      icon={Activity}
      title="No recent activity"
      description="All system activities, audit trails, and user requests will appear here once recorded."
    />
  );
  return (
    <div className="divide-y divide-slate-100">
      {logs.slice(0, 8).map((log, i) => (
        <div key={log.id || i} className="flex items-start gap-3 py-2.5 hover:bg-slate-50/60 rounded-lg transition-colors px-1">
          <div className={`flex-shrink-0 mt-0.5 h-7 w-7 rounded-full flex items-center justify-center text-xs ${activityStyle(log.action)}`}>
            <Activity className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <ActionBadge action={log.action} />
              <span className="text-xs text-slate-400 font-mono truncate">{log.user_email || log.resource_name}</span>
            </div>
            {log.description && <p className="mt-0.5 text-xs text-slate-500 truncate">{log.description}</p>}
          </div>
          <span className="flex-shrink-0 text-xs text-slate-400 tabular-nums">{getRelativeTime(log.created_at)}</span>
        </div>
      ))}
    </div>
  );
}


const HEALTH_ITEMS = [
  { key: 'database', label: 'PostgreSQL Database', desc: 'User data, billing & audit records', icon: <Database className="h-5 w-5" /> },
  { key: 'redis', label: 'Redis Cache', desc: 'Session & KPI caching layer', icon: <Zap className="h-5 w-5" /> },
  { key: 'storage', label: 'File Storage', desc: 'Object storage disk volume', icon: <HardDrive className="h-5 w-5" /> },
  { key: 'forecast_engine', label: 'Forecast Engine', desc: 'ML prediction & trend analysis', icon: <Activity className="h-5 w-5" /> },
  { key: 'backend_api', label: 'Backend API', desc: 'FastAPI application server', icon: <Server className="h-5 w-5" /> },
  { key: 'jwt_auth', label: 'JWT Authentication', desc: 'Token generation & validation', icon: <Shield className="h-5 w-5" /> },
];

function SystemHealthView({ health }) {
  if (!health) return (
    <div className="py-24 text-center text-slate-400 animate-pulse">
      <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin" /> Loading diagnostics…
    </div>
  );
  const enriched = { ...health, backend_api: 'Healthy', jwt_auth: 'Healthy' };
  const redisMetrics = health.redis_metrics || {
    status: health.redis === "Healthy" ? "Online" : "Offline",
    hits: 0,
    misses: 0,
    keys: 0,
    memory: "0 B",
    uptime: "0s"
  };
  const isRedisOnline = redisMetrics.status === "Online";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {HEALTH_ITEMS.map(item => {
          const status = enriched[item.key] || 'Offline';
          const isHealthy = status.toLowerCase() === 'healthy';
          return (
            <div key={item.key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow text-left">
              <div className="flex items-start justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isHealthy ? 'bg-indigo-50 text-indigo-600' : 'bg-red-50 text-red-500'}`}>
                  {item.icon}
                </div>
                <HealthChip status={status} />
              </div>
              <div className="mt-4">
                <h4 className="font-semibold text-slate-800 text-sm">{item.label}</h4>
                <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-left">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Redis Cache Performance & Monitoring</h3>
            <p className="text-xs text-slate-400 mt-1">Real-time usage metrics and keyspace analytics</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${
            isRedisOnline 
              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
              : "bg-red-50 text-red-600 border-red-200"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isRedisOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
            {isRedisOnline ? "Online" : "Offline"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cache Hits</p>
            <p className="text-xl font-bold text-slate-800 mt-1.5 tabular-nums">{redisMetrics.hits}</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cache Misses</p>
            <p className="text-xl font-bold text-slate-800 mt-1.5 tabular-nums">{redisMetrics.misses}</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cached Keys</p>
            <p className="text-xl font-bold text-slate-800 mt-1.5 tabular-nums">{redisMetrics.keys}</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Memory Used</p>
            <p className="text-xl font-bold text-slate-800 mt-1.5 tabular-nums">{redisMetrics.memory}</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 col-span-2 sm:col-span-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Uptime</p>
            <p className="text-xl font-bold text-slate-800 mt-1.5 truncate" title={redisMetrics.uptime}>{redisMetrics.uptime}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-700">Diagnostics Notes</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">Services are verified by live health probes. If any dependency shows Degraded or Offline, ensure PostgreSQL (port 5433) and Redis (port 6379) are running.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserManagementView({ users, onView, onSuspend, onChangePlan, onResetPassword, onDelete, actionInProgress }) {
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [verificationFilter, setVerificationFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [activeDropdownUserId, setActiveDropdownUserId] = useState(null);
  const PAGE_SIZE = 8;

  const filtered = useMemo(() => {
    return (users || []).filter(u => {
      const matchSearch = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
      const matchPlan = planFilter === 'All' || u.plan === planFilter;
      const matchStatus = statusFilter === 'All' || (statusFilter === 'Active' && u.is_active) || (statusFilter === 'Suspended' && !u.is_active);
      const matchVerification = verificationFilter === 'All' || (verificationFilter === 'Verified' && u.email_verified) || (verificationFilter === 'Unverified' && !u.email_verified);
      return matchSearch && matchPlan && matchStatus && matchVerification;
    });
  }, [users, search, planFilter, statusFilter, verificationFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const paginated = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 min-w-0">
          <input type="text" placeholder="Search by name or email…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition" />
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        </div>
        <div className="flex gap-2">
          <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-400 outline-none cursor-pointer">
            <option value="All">All Plans</option>
            <option value="Free">Free</option>
            <option value="Pro">Pro</option>
            <option value="Enterprise">Enterprise</option>
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-400 outline-none cursor-pointer">
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
          </select>
          <select value={verificationFilter} onChange={e => { setVerificationFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-400 outline-none cursor-pointer">
            <option value="All">All Verification</option>
            <option value="Verified">Verified</option>
            <option value="Unverified">Not Verified</option>
          </select>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-fade-in">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                {['User', 'Role', 'Plan', 'Storage', 'Files', 'Joined', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8">
                    <EmptyState
                      icon={Users}
                      title="No users found"
                      description="No registered user profiles matched your current search filters or criteria."
                    />
                  </td>
                </tr>
              ) : paginated.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar name={u.name} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-slate-800 truncate">{u.name}</p>
                          {u.email_verified ? (
                            <span className="inline-flex items-center rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200">
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 border border-slate-200">
                              Unverified
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border ${u.role === 'admin' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {u.role || 'customer'}
                    </span>
                  </td>
                  <td className="px-4 py-3"><PlanBadge plan={u.plan} /></td>
                  <td className="px-4 py-3 text-sm text-slate-600 font-mono tabular-nums">{formatBytes(u.storage_used)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 tabular-nums">{u.files_uploaded}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600 border border-red-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Suspended
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 relative">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setActiveDropdownUserId(activeDropdownUserId === u.id ? null : u.id)}
                        disabled={actionInProgress}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {activeDropdownUserId === u.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setActiveDropdownUserId(null)}
                          />
                          <div className="absolute right-4 mt-2 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg z-50 text-left">
                            <button
                              type="button"
                              onClick={() => { setActiveDropdownUserId(null); onView(u); }}
                              className="flex w-full items-center px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer border-none bg-transparent"
                            >
                              <Eye className="mr-2 h-3.5 w-3.5 text-slate-400" /> View Details
                            </button>
                            
                            <div className="h-px bg-slate-100 my-1" />
                            <div className="px-4 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Plan Action</div>
                            <button
                              type="button"
                              onClick={() => { setActiveDropdownUserId(null); onChangePlan(u, 'Free'); }}
                              className={`flex w-full items-center px-4 py-1.5 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer border-none bg-transparent ${u.plan === 'Free' ? 'font-bold text-indigo-600' : ''}`}
                            >
                              Set Free
                            </button>
                            <button
                              type="button"
                              onClick={() => { setActiveDropdownUserId(null); onChangePlan(u, 'Pro'); }}
                              className={`flex w-full items-center px-4 py-1.5 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer border-none bg-transparent ${u.plan === 'Pro' ? 'font-bold text-indigo-600' : ''}`}
                            >
                              Set Pro
                            </button>
                            <button
                              type="button"
                              onClick={() => { setActiveDropdownUserId(null); onChangePlan(u, 'Enterprise'); }}
                              className={`flex w-full items-center px-4 py-1.5 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer border-none bg-transparent ${u.plan === 'Enterprise' ? 'font-bold text-indigo-600' : ''}`}
                            >
                              Set Enterprise
                            </button>
                            
                            <div className="h-px bg-slate-100 my-1" />
                            <div className="px-4 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Account Action</div>
                            {u.is_active ? (
                              <button
                                type="button"
                                onClick={() => { setActiveDropdownUserId(null); onSuspend(u); }}
                                className="flex w-full items-center px-4 py-2 text-xs text-amber-600 hover:bg-amber-50 cursor-pointer border-none bg-transparent"
                              >
                                <UserMinus className="mr-2 h-3.5 w-3.5" /> Suspend User
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => { setActiveDropdownUserId(null); onSuspend(u); }}
                                className="flex w-full items-center px-4 py-2 text-xs text-emerald-600 hover:bg-emerald-50 cursor-pointer border-none bg-transparent"
                              >
                                <UserCheck className="mr-2 h-3.5 w-3.5" /> Reactivate User
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => { setActiveDropdownUserId(null); onResetPassword(u); }}
                              className="flex w-full items-center px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer border-none bg-transparent"
                            >
                              <Key className="mr-2 h-3.5 w-3.5 text-slate-400" /> Reset Password
                            </button>
                            <button
                              type="button"
                              onClick={() => { setActiveDropdownUserId(null); onDelete(u); }}
                              className="flex w-full items-center px-4 py-2 text-xs text-red-600 hover:bg-red-50 cursor-pointer border-none bg-transparent"
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete User
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <p className="text-xs text-slate-400">{(curPage - 1) * PAGE_SIZE + 1}–{Math.min(curPage * PAGE_SIZE, filtered.length)} of {filtered.length} users</p>
            <div className="flex items-center gap-1">
              <button disabled={curPage === 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs text-slate-500">{curPage} / {totalPages}</span>
              <button disabled={curPage === totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FileMetadataView({ files }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const filtered = useMemo(() => (files || []).filter(f => !search || f.filename?.toLowerCase().includes(search.toLowerCase()) || f.owner_email?.toLowerCase().includes(search.toLowerCase())), [files, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const paginated = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <Lock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Read-Only Metadata Access</p>
          <p className="text-xs text-amber-700 mt-0.5">Admins can view file metadata only. Direct downloads are disabled for security compliance.</p>
        </div>
      </div>
      <div className="relative max-w-sm">
        <input type="text" placeholder="Search files…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition" />
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                {['Filename', 'Owner', 'Size', 'Uploaded', 'Plan'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8">
                    <EmptyState
                      icon={FileBox}
                      title="No files found"
                      description="No upload metadata matched your search queries."
                    />
                  </td>
                </tr>
              ) : paginated.map(f => (
                <tr key={f.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <FileBox className="h-4 w-4 text-indigo-400" />
                      </div>
                      <span className="text-sm font-medium text-slate-800 truncate max-w-xs">{f.filename}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-indigo-600 font-medium">{f.owner_email || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 font-mono">{formatBytes(f.filesize)}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{getRelativeTime(f.uploaded_at)}</td>
                  <td className="px-4 py-3"><PlanBadge plan={f.plan} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <p className="text-xs text-slate-400">{filtered.length} files total</p>
            <div className="flex items-center gap-1">
              <button disabled={curPage === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 cursor-pointer"><ChevronLeft className="h-4 w-4" /></button>
              <span className="px-2 text-xs text-slate-500">{curPage} / {totalPages}</span>
              <button disabled={curPage === totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 cursor-pointer"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function AuditLogsView({ logs, page, setPage, totalPages, totalItems, loading, search, setSearch, action, setAction, startDate, setStartDate, endDate, setEndDate, sortBy, setSortBy }) {
  const [tempSearch, setTempSearch] = useState(search);
  useEffect(() => { const t = setTimeout(() => { setSearch(tempSearch); setPage(1); }, 500); return () => clearTimeout(t); }, [tempSearch]);
  const limit = 10;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div className="lg:col-span-2 relative">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Search</label>
            <input type="text" placeholder="Search logs…" value={tempSearch} onChange={e => setTempSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition" />
            <Search className="absolute left-3 bottom-3 h-4 w-4 text-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Action</label>
            <select value={action} onChange={e => { setAction(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-indigo-400 outline-none cursor-pointer">
              <option value="All">All Actions</option>
              <option value="User Registration">Registration</option>
              <option value="User Login">Login</option>
              <option value="Failed Login Attempt">Failed Login</option>
              <option value="File Upload">File Upload</option>
              <option value="File Delete">File Delete</option>
              <option value="Subscription Change">Subscription</option>
              <option value="Invoice Download">Invoice</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">From</label>
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-indigo-400 outline-none cursor-pointer" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">To</label>
            <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-indigo-400 outline-none cursor-pointer" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Order</label>
            <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-indigo-400 outline-none cursor-pointer">
              <option value="Newest">Newest First</option>
              <option value="Oldest">Oldest First</option>
            </select>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 animate-pulse"><RefreshCw className="h-6 w-6 mx-auto mb-2 animate-spin" /> Loading audit logs…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Time', 'User', 'Action', 'Resource', 'Description', 'IP'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                    <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-40" />No audit events found
                  </td></tr>
                ) : logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-medium text-slate-700">{getRelativeTime(log.created_at)}</p>
                      <p className="text-xs text-slate-400">{formatAbsoluteDate(log.created_at)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-indigo-600 font-medium whitespace-nowrap">{log.user_email || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><ActionBadge action={log.action} /></td>
                    <td className="px-4 py-3 text-sm text-slate-700 font-medium max-w-xs truncate">{log.resource_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">{log.description || '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">{log.ip_address || 'Local'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {logs.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <p className="text-xs text-slate-400">{(page - 1) * limit + 1}–{Math.min(page * limit, totalItems)} of {totalItems} events</p>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 cursor-pointer"><ChevronLeft className="h-4 w-4" /></button>
              <span className="px-2 text-xs text-slate-500">{page} / {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 cursor-pointer"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UserDetailDrawer({ user, onClose, onSuspend, onChangePlan, actionInProgress }) {
  if (!user) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-white border-l border-slate-200 shadow-2xl flex flex-col h-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">Account Details</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer transition"><XCircle className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center gap-3">
            <UserAvatar name={user.name} />
            <div>
              <p className="text-base font-semibold text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-400 font-mono">{user.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Storage</p>
              <p className="text-lg font-bold text-slate-800 mt-1">{formatBytes(user.storage_used)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Files</p>
              <p className="text-lg font-bold text-slate-800 mt-1">{user.files_uploaded}</p>
            </div>
          </div>
          <div className="space-y-3 text-left">
            {[
              { label: 'Plan', value: <PlanBadge plan={user.plan} /> },
              { label: 'Role', value: <span className="text-sm capitalize text-slate-700">{user.role}</span> },
              { label: 'Status', value: user.is_active ? <span className="text-sm text-emerald-600 font-semibold">Active</span> : <span className="text-sm text-red-500 font-semibold">Suspended</span> },
              { label: 'Joined', value: <span className="text-sm text-slate-600">{user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</span> },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
                {value}
              </div>
            ))}
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Override Plan</p>
            <div className="flex gap-2">
              {['Free', 'Pro', 'Enterprise'].map(plan => (
                <button key={plan} disabled={actionInProgress || user.plan === plan} onClick={() => onChangePlan(user, plan)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${user.plan === plan ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:text-purple-600'}`}>
                  {plan}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 p-4">
          <button disabled={actionInProgress} onClick={() => onSuspend(user)}
            className={`w-full py-2 text-sm font-semibold rounded-lg border transition cursor-pointer ${user.is_active ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}>
            {user.is_active ? 'Suspend User' : 'Activate User'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteUserModal({ user, onConfirm, onCancel, actionInProgress }) {
  if (!user) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-left">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 mb-4">
          <UserMinus className="h-6 w-6 text-red-500" />
        </div>
        <h3 className="text-base font-semibold text-slate-800">Delete User Account</h3>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          Are you sure you want to permanently delete <span className="font-semibold text-slate-700">{user.email}</span>? This purges all their files, logs, and billing records and cannot be undone.
        </p>
        <div className="mt-6 flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition">Cancel</button>
          <button disabled={actionInProgress} onClick={onConfirm}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg cursor-pointer transition disabled:opacity-60">
            {actionInProgress ? 'Deleting…' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
      {toast.type === 'error' ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
      <p className="text-sm font-medium">{toast.message}</p>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 cursor-pointer"><XCircle className="h-4 w-4" /></button>
    </div>
  );
}


export default function AdminDashboard({ userName, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [cards, setCards] = useState(null);
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [health, setHealth] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsMeta, setLogsMeta] = useState({ total_pages: 1, total_items: 0 });
  const [recentLogs, setRecentLogs] = useState([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditAction, setAuditAction] = useState('All');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [auditSortBy, setAuditSortBy] = useState('Newest');
  const [loading, setLoading] = useState({});
  const [toast, setToast] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [tempPasswordResult, setTempPasswordResult] = useState(null);
  const [now, setNow] = useState(new Date());
  const [securityStats, setSecurityStats] = useState(null);
  const [adminOptimization, setAdminOptimization] = useState(null);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const showToast = (message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 4000); };
  const setTabLoading = (key, val) => setLoading(prev => ({ ...prev, [key]: val }));

  const fetchCards = useCallback(async () => {
    setTabLoading('cards', true);
    try { const r = await api.get('/admin/dashboard-cards'); setCards(r.data); }
    catch { showToast('Failed to load dashboard stats', 'error'); }
    finally { setTabLoading('cards', false); }
  }, []);

  const fetchUsers = useCallback(async () => {
    setTabLoading('users', true);
    try { const r = await api.get('/admin/users'); setUsers(r.data); }
    catch { showToast('Failed to load users', 'error'); }
    finally { setTabLoading('users', false); }
  }, []);

  const fetchFiles = useCallback(async () => {
    setTabLoading('files', true);
    try { const r = await api.get('/admin/files'); setFiles(r.data); }
    catch { showToast('Failed to load files', 'error'); }
    finally { setTabLoading('files', false); }
  }, []);

  const fetchHealth = useCallback(async () => {
    setTabLoading('health', true);
    try { const r = await api.get('/admin/system-health'); setHealth(r.data); }
    catch { showToast('Failed to load system health', 'error'); }
    finally { setTabLoading('health', false); }
  }, []);

  const fetchLogs = useCallback(async () => {
    setTabLoading('logs', true);
    try {
      const params = { page: auditPage, limit: 10, sort_by: auditSortBy };
      if (auditSearch) params.search = auditSearch;
      if (auditAction !== 'All') params.action = auditAction;
      if (auditStartDate) params.start_date = auditStartDate;
      if (auditEndDate) params.end_date = auditEndDate;
      const r = await api.get('/admin/audit-logs', { params });
      setLogs(r.data.items || []);
      setLogsMeta({ total_pages: r.data.total_pages || 1, total_items: r.data.total_items || 0 });
    } catch { showToast('Failed to load audit logs', 'error'); }
    finally { setTabLoading('logs', false); }
  }, [auditPage, auditSearch, auditAction, auditStartDate, auditEndDate, auditSortBy]);

  const fetchRecentLogs = useCallback(async () => {
    try { const r = await api.get('/admin/audit-logs', { params: { page: 1, limit: 8, sort_by: 'Newest' } }); setRecentLogs(r.data.items || []); } catch (err) { console.error(err); }
  }, []);

  const fetchSecurity = useCallback(async () => {
    try { const r = await api.get('/admin/security-stats'); setSecurityStats(r.data); } catch (err) { console.error(err); }
  }, []);

  const fetchOptimization = useCallback(async () => {
    setTabLoading('optimization', true);
    try { const r = await api.get('/admin/storage-optimization'); setAdminOptimization(r.data); }
    catch { showToast('Failed to load optimization data', 'error'); }
    finally { setTabLoading('optimization', false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') { fetchCards(); fetchUsers(); fetchRecentLogs(); fetchSecurity(); }
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'files') fetchFiles();
    if (activeTab === 'audit') fetchLogs();
    if (activeTab === 'health') fetchHealth();
    if (activeTab === 'optimization') fetchOptimization();
  }, [activeTab]);

  useEffect(() => { if (activeTab === 'audit') fetchLogs(); }, [auditPage, auditSearch, auditAction, auditStartDate, auditEndDate, auditSortBy]);

  const handleSuspend = (user) => {
    setConfirmAction({ type: user.is_active ? 'suspend' : 'reactivate', user });
  };

  const handleChangePlan = (user, plan) => {
    setConfirmAction({ type: 'plan', user, data: plan });
  };

  const handleResetPassword = (user) => {
    setConfirmAction({ type: 'reset_password', user });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, user, data } = confirmAction;
    setActionInProgress(true);
    try {
      if (type === 'suspend') {
        await api.post(`/admin/users/${user.id}/suspend`);
        showToast(`${user.email} suspended successfully`);
        if (selectedUser?.id === user.id) setSelectedUser(prev => ({ ...prev, is_active: false }));
      } else if (type === 'reactivate') {
        await api.post(`/admin/users/${user.id}/suspend`);
        showToast(`${user.email} reactivated successfully`);
        if (selectedUser?.id === user.id) setSelectedUser(prev => ({ ...prev, is_active: true }));
      } else if (type === 'plan') {
        await api.post(`/admin/users/${user.id}/change-plan`, { plan: data });
        showToast(`${user.email} plan updated to ${data}`);
        if (selectedUser?.id === user.id) setSelectedUser(prev => ({ ...prev, plan: data }));
      } else if (type === 'reset_password') {
        const res = await api.post(`/admin/users/${user.id}/reset-password`);
        setTempPasswordResult({
          user,
          password: res.data.temp_password
        });
        showToast(`Password reset successfully for ${user.email}`);
      }
      fetchUsers();
      fetchCards();
    } catch (e) {
      showToast(e.response?.data?.detail || 'Action failed', 'error');
    } finally {
      setActionInProgress(false);
      setConfirmAction(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setActionInProgress(true);
    try {
      await api.delete(`/admin/users/${userToDelete.id}`);
      showToast(`${userToDelete.email} deleted successfully`);
      setUserToDelete(null); setSelectedUser(null);
      fetchUsers(); fetchCards();
    } catch (e) { showToast(e.response?.data?.detail || 'Failed to delete user', 'error'); }
    finally { setActionInProgress(false); }
  };

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-16">
      <header className="border-b border-slate-200 bg-white shadow-sm sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">System Administration</p>
            <h1 className="mt-0.5 text-xl font-semibold text-slate-900">Admin Control Center</h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-sm font-semibold text-slate-700 tabular-nums">{timeStr}</span>
              <span className="text-xs text-slate-400">{dateStr}</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              All Systems Operational
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)', border: '1px solid #e0e7ff', borderRadius: '40px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: 'white', fontSize: '0.65rem', fontWeight: 700 }}>{(userName || 'A').charAt(0).toUpperCase()}</span>
              </div>
              <span style={{ fontSize: '0.82rem', color: '#4338ca', fontWeight: 600, whiteSpace: 'nowrap' }}>{userName || 'Admin'}</span>
              <span style={{ fontSize: '0.65rem', background: '#e0e7ff', color: '#4338ca', borderRadius: '20px', padding: '2px 6px', fontWeight: 700 }}>Admin</span>
            </div>
            <button onClick={onLogout}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fecaca'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
              aria-label="Sign out">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white px-4">
        <div className="mx-auto max-w-7xl">
          <nav className="-mb-px flex space-x-1 overflow-x-auto" aria-label="Admin tabs">
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 border-b-2 px-4 py-4 text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${active ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:border-slate-350 hover:text-slate-800'}`}>
                  <span className={active ? 'text-purple-600' : 'text-slate-400'}>{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="relative rounded-2xl border border-purple-100 bg-gradient-to-r from-purple-50 via-indigo-50/30 to-white px-8 py-7 shadow-sm text-left overflow-hidden">
              <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-gradient-to-br from-purple-200/30 to-indigo-200/30 blur-3xl pointer-events-none" />
              <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight text-slate-800">Welcome back, {userName || 'Admin'} 👋</h2>
                  <p className="text-sm font-medium text-slate-500 mt-1.5">Configure, audit, and analyze the WeCloud storage billing platform.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3.5 py-1.5 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />All systems operational
                  </span>
                  <button onClick={() => { fetchCards(); fetchUsers(); fetchRecentLogs(); }}
                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-200 bg-white rounded-xl hover:bg-slate-50 hover:border-slate-300 cursor-pointer shadow-sm active:scale-95 transition-all">
                    <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading.cards ? 'animate-spin' : ''}`} />Sync Data
                  </button>
                </div>
              </div>
            </div>

            {loading.cards && !cards ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-36 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col justify-between animate-pulse">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2.5 w-2/3">
                        <div className="h-3 bg-slate-200 rounded-md w-1/2" />
                        <div className="h-8 bg-slate-200 rounded-md w-3/4" />
                      </div>
                      <div className="h-12 w-12 bg-slate-200 rounded-xl" />
                    </div>
                    <div className="h-3 bg-slate-100 rounded-md w-1/3" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Total Users" value={cards?.total_users ?? 0} subtext="Registered accounts" icon={<Users className="h-5 w-5" />} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
                <StatCard label="Active Users" value={cards?.active_users ?? 0} subtext="Currently active" icon={<UserCheck className="h-5 w-5" />} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
                <StatCard label="Storage Used" value={formatBytes(cards?.storage_used ?? 0)} subtext="Across all users" icon={<HardDrive className="h-5 w-5" />} iconBg="bg-blue-50" iconColor="text-blue-600" />
                <StatCard label="Files Uploaded" value={cards?.files_uploaded ?? 0} subtext="Total objects" icon={<FileBox className="h-5 w-5" />} iconBg="bg-violet-50" iconColor="text-violet-600" />
                <StatCard label="Monthly Revenue" value={new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(cards?.revenue ?? 0)} subtext="Estimated earnings" icon={<DollarSign className="h-5 w-5" />} iconBg="bg-cyan-50" iconColor="text-cyan-600" />
                <StatCard label="Verified Users" value={cards?.verified_users ?? 0} subtext="Email verified" icon={<CheckCircle className="h-5 w-5" />} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
                <StatCard label="Pending Verification" value={cards?.pending_verification ?? 0} subtext="OTP pending" icon={<AlertTriangle className="h-5 w-5" />} iconBg="bg-amber-50" iconColor="text-amber-600" />
                <StatCard label="Pro Users" value={cards?.pro_users ?? 0} subtext="Pro plan subscribers" icon={<Star className="h-5 w-5" />} iconBg="bg-blue-50" iconColor="text-blue-600" />
                <StatCard label="Enterprise Users" value={cards?.enterprise_users ?? 0} subtext="Enterprise plan" icon={<Crown className="h-5 w-5" />} iconBg="bg-purple-50" iconColor="text-purple-600" />
                <StatCard label="Today's Uploads" value={cards?.today_uploads ?? 0} subtext="Added today" icon={<Upload className="h-5 w-5" />} iconBg="bg-amber-50" iconColor="text-amber-600" />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-left">
                <h3 className="text-base font-bold text-slate-800">Subscription Distribution</h3>
                <p className="text-xs font-medium text-slate-400 mt-1 mb-4">Users by plan tier</p>
                <SubscriptionDonut cards={cards} />
              </div>
              <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-left">
                <h3 className="text-base font-bold text-slate-800">Storage by Plan</h3>
                <p className="text-xs font-medium text-slate-400 mt-1 mb-4">GB consumed per plan tier</p>
                <StorageByPlanChart users={users} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-left">
                <h3 className="text-base font-bold text-slate-800">Uploads by Plan</h3>
                <p className="text-xs font-medium text-slate-400 mt-1 mb-4">File count per subscription tier</p>
                <UploadsBarChart users={users} />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-left flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Recent Activity</h3>
                    <p className="text-xs font-medium text-slate-400 mt-0.5">Latest platform security events</p>
                  </div>
                  <button onClick={() => setActiveTab('audit')} className="text-xs font-semibold text-purple-600 hover:text-purple-700 cursor-pointer transition">View all →</button>
                </div>
                <ActivityTimeline logs={recentLogs} />
              </div>
            </div>

            {/* Security Card */}
            <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50/60 via-orange-50/30 to-white p-6 shadow-sm text-left">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                    <ShieldAlert className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Security Overview</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">Redis-backed rate limiting activity</p>
                  </div>
                </div>
                <button onClick={fetchSecurity} className="text-xs font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 bg-white hover:bg-slate-50 transition cursor-pointer">
                  Refresh
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                <div className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Blocked Today</p>
                  <p className="text-2xl font-extrabold text-red-600 mt-1">{securityStats?.blocked_requests_today ?? 0}</p>
                  <p className="text-xs text-slate-400 mt-1">Rate-limited requests</p>
                </div>
                <div className="rounded-xl border border-orange-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Blocked</p>
                  <p className="text-2xl font-extrabold text-orange-600 mt-1">{securityStats?.rate_limited_requests ?? 0}</p>
                  <p className="text-xs text-slate-400 mt-1">All-time blocked</p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Top Endpoint</p>
                  <p className="text-sm font-extrabold text-amber-700 mt-1 truncate font-mono">{securityStats?.most_targeted_endpoint ?? 'N/A'}</p>
                  <p className="text-xs text-slate-400 mt-1">Most attacked route</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Blocked IPs</p>
                  <p className="text-2xl font-extrabold text-slate-700 mt-1">{securityStats?.top_blocked_ips?.length ?? 0}</p>
                  <p className="text-xs text-slate-400 mt-1">Unique IPs blocked</p>
                </div>
              </div>
              {securityStats?.top_blocked_ips?.length > 0 ? (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Top Blocked IPs</p>
                  <div className="space-y-2">
                    {securityStats.top_blocked_ips.map((item, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-600">{i + 1}</span>
                          <span className="text-sm font-mono text-slate-700">{item.ip}</span>
                        </div>
                        <span className="rounded-full bg-red-50 border border-red-100 px-2.5 py-0.5 text-xs font-bold text-red-600">{item.count} blocks</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <ShieldAlert className="h-8 w-8 text-slate-200 mb-2" />
                  <p className="text-sm font-semibold text-slate-400">No blocked IPs yet</p>
                  <p className="text-xs text-slate-300 mt-1">Rate limiting is active and monitoring traffic</p>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-800 mb-4 text-left">Quick Actions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'User Management', desc: 'Manage accounts & plans', icon: <Users className="h-5 w-5" />, color: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100', tab: 'users' },
                  { label: 'Audit Logs', desc: 'Security event trail', icon: <ShieldAlert className="h-5 w-5" />, color: 'bg-purple-50 text-purple-600 hover:bg-purple-100', tab: 'audit' },
                  { label: 'File Metadata', desc: 'All platform files', icon: <FileBox className="h-5 w-5" />, color: 'bg-blue-50 text-blue-600 hover:bg-blue-100', tab: 'files' },
                  { label: 'System Health', desc: 'Service diagnostics', icon: <Server className="h-5 w-5" />, color: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100', tab: 'health' },
                ].map(a => (
                  <button key={a.tab} onClick={() => setActiveTab(a.tab)}
                    className="flex flex-col items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:shadow-md hover:border-purple-200 transition-all duration-300 cursor-pointer group">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 ${a.color} shadow-sm`}>{a.icon}</div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{a.label}</p>
                      <p className="text-xs font-medium text-slate-400 mt-1 leading-normal">{a.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-left">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">User Management</h2>
                <p className="text-sm text-slate-500 mt-0.5">Manage accounts, plans and access levels.</p>
              </div>
              <button onClick={fetchUsers} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 cursor-pointer transition">
                <RefreshCw className={`h-4 w-4 ${loading.users ? 'animate-spin' : ''}`} />Refresh
              </button>
            </div>
            {loading.users && users.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white h-48 flex items-center justify-center animate-pulse">
                <p className="text-sm text-slate-400">Loading users…</p>
              </div>
            ) : (
              <UserManagementView users={users} onView={setSelectedUser} onSuspend={handleSuspend} onChangePlan={handleChangePlan} onResetPassword={handleResetPassword} onDelete={setUserToDelete} actionInProgress={actionInProgress} />
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-left">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">File Metadata</h2>
                <p className="text-sm text-slate-500 mt-0.5">Browse all uploaded file records. Downloads are disabled for security.</p>
              </div>
              <button onClick={fetchFiles} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 cursor-pointer transition">
                <RefreshCw className={`h-4 w-4 ${loading.files ? 'animate-spin' : ''}`} />Refresh
              </button>
            </div>
            {loading.files && files.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white h-48 flex items-center justify-center animate-pulse">
                <p className="text-sm text-slate-400">Loading files…</p>
              </div>
            ) : <FileMetadataView files={files} />}
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-left">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Audit Logs</h2>
                <p className="text-sm text-slate-500 mt-0.5">Complete security event trail across all users and actions.</p>
              </div>
              <button onClick={fetchLogs} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 cursor-pointer transition">
                <RefreshCw className={`h-4 w-4 ${loading.logs ? 'animate-spin' : ''}`} />Refresh
              </button>
            </div>
            <AuditLogsView logs={logs} page={auditPage} setPage={setAuditPage} totalPages={logsMeta.total_pages} totalItems={logsMeta.total_items}
              loading={loading.logs} search={auditSearch} setSearch={setAuditSearch} action={auditAction} setAction={setAuditAction}
              startDate={auditStartDate} setStartDate={setAuditStartDate} endDate={auditEndDate} setEndDate={setAuditEndDate}
              sortBy={auditSortBy} setSortBy={setAuditSortBy} />
          </div>
        )}

        {activeTab === 'health' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-left">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">System Health</h2>
                <p className="text-sm text-slate-500 mt-0.5">Real-time status of all platform services and infrastructure.</p>
              </div>
              <button onClick={fetchHealth} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 cursor-pointer transition">
                <RefreshCw className={`h-4 w-4 ${loading.health ? 'animate-spin' : ''}`} />Run Diagnostics
              </button>
            </div>
            <SystemHealthView health={health} />
          </div>
        )}

        {activeTab === 'optimization' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-left">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Platform Storage Optimization</h2>
                <p className="text-sm text-slate-500 mt-0.5">Aggregated storage health, savings potential, and analysis across all users.</p>
              </div>
              <button onClick={fetchOptimization} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 cursor-pointer transition">
                <RefreshCw className={`h-4 w-4 ${loading.optimization ? 'animate-spin' : ''}`} />Refresh Stats
              </button>
            </div>
            <AdminOptimizationView data={adminOptimization} loading={loading.optimization} />
          </div>
        )}
      </main>

      {selectedUser && <UserDetailDrawer user={selectedUser} onClose={() => setSelectedUser(null)} onSuspend={handleSuspend} onChangePlan={handleChangePlan} actionInProgress={actionInProgress} />}
      {userToDelete && <DeleteUserModal user={userToDelete} onConfirm={handleDeleteUser} onCancel={() => setUserToDelete(null)} actionInProgress={actionInProgress} />}
      {confirmAction && (
        <AdminActionConfirmModal
          action={confirmAction}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
          actionInProgress={actionInProgress}
        />
      )}
      {tempPasswordResult && (
        <TempPasswordModal
          result={tempPasswordResult}
          onClose={() => setTempPasswordResult(null)}
        />
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function AdminOptimizationView({ data, loading }) {
  if (loading || !data) {
    return (
      <div className="py-24 text-center text-slate-400 animate-pulse">
        <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-purple-600" /> Loading optimization statistics…
      </div>
    );
  }

  const {
    platform_health_score = 100,
    avg_health_by_plan = {},
    total_potential_savings_bytes = 0,
    total_large_files = 0,
    total_duplicate_groups = 0,
    total_duplicate_files = 0,
    total_unused_files = 0,
    file_type_distribution = {},
    largest_users = []
  } = data;

  const score = platform_health_score;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (score / 100) * circumference;

  const scoreColor = score >= 75 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 75 ? "Excellent" : score >= 40 ? "Needs Attention" : "Critical";
  const scoreBg = score >= 75 ? "from-emerald-50 to-green-50/50 border-emerald-100 text-emerald-800"
                : score >= 40 ? "from-amber-50 to-yellow-50/50 border-amber-100 text-amber-800"
                : "from-red-50 to-rose-50/50 border-red-100 text-red-800";

  const chartColors = {
    Images: "#6366f1", Videos: "#8b5cf6", Documents: "#06b6d4",
    Archives: "#f59e0b", Other: "#94a3b8",
  };

  const chartData = Object.entries(file_type_distribution || {})
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const totalBytes = Object.values(file_type_distribution).reduce((a, b) => a + b, 0);

  const insights = [];
  if (total_potential_savings_bytes > 0) {
    insights.push({
      id: 'savings',
      title: 'Potential Platform Savings',
      description: `WeCloud can reclaim up to ${formatBytes(total_potential_savings_bytes)} of storage by prompting users to clean up duplicate and unused files.`,
      icon: <DollarSign className="h-5 w-5 text-emerald-600" />,
      bg: 'bg-emerald-50 border-emerald-100',
      text: 'text-emerald-800'
    });
  }
  if (total_duplicate_files > 0) {
    insights.push({
      id: 'duplicates',
      title: 'Identical Duplicate Files',
      description: `Detected ${total_duplicate_files} duplicate files (${total_duplicate_groups} distinct groups) stored across user accounts.`,
      icon: <Zap className="h-5 w-5 text-amber-600" />,
      bg: 'bg-amber-50 border-amber-100',
      text: 'text-amber-800'
    });
  }
  if (total_large_files > 0) {
    insights.push({
      id: 'large',
      title: 'High Density of Large Files',
      description: `There are ${total_large_files} files larger than 100 MB uploaded to the platform. Suggesting zip/archive methods could optimize bandwidth.`,
      icon: <HardDrive className="h-5 w-5 text-blue-600" />,
      bg: 'bg-blue-50 border-blue-100',
      text: 'text-blue-800'
    });
  }
  if (total_unused_files > 0) {
    insights.push({
      id: 'unused',
      title: 'Stale Unused Uploads',
      description: `${total_unused_files} files (never downloaded since upload) are currently occupying space. Consider implementing an auto-archive policy.`,
      icon: <Info className="h-5 w-5 text-purple-600" />,
      bg: 'bg-purple-50 border-purple-100',
      text: 'text-purple-800'
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 text-slate-800">
        <div className={`rounded-2xl border bg-gradient-to-br ${scoreBg} p-6 flex flex-col items-center justify-center text-center shadow-sm`}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Platform Health</p>
          <svg width="120" height="120" viewBox="0 0 140 140" className="mx-auto">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="12" />
            <circle
              cx="70" cy="70" r={radius} fill="none"
              stroke={scoreColor} strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${strokeDash} ${circumference}`}
              strokeDashoffset="0"
              transform="rotate(-90 70 70)"
              style={{ transition: "stroke-dasharray 1s ease" }}
            />
            <text x="70" y="65" textAnchor="middle" fontSize="28" fontWeight="800" fill={scoreColor}>{score}</text>
            <text x="70" y="84" textAnchor="middle" fontSize="10" fill="#94a3b8">/100</text>
          </svg>
          <span className="mt-3 rounded-full px-3 py-1 text-xs font-bold" style={{ background: `${scoreColor}18`, color: scoreColor }}>
            {scoreLabel}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-emerald-50 text-emerald-600 border-emerald-100">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-800 mt-3">{formatBytes(total_potential_savings_bytes)}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Platform Space Waste</p>
            <p className="text-[10px] text-slate-400 mt-1">Across duplicate & unused files</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-amber-50 text-amber-600 border-amber-100">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-800 mt-3">{total_duplicate_files}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Duplicate Files</p>
            <p className="text-[10px] text-slate-400 mt-1">{total_duplicate_groups} identical groups</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-blue-50 text-blue-600 border-blue-100">
            <HardDrive className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-800 mt-3">{total_large_files}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Large Files</p>
            <p className="text-[10px] text-slate-400 mt-1">Size greater than 100 MB</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-purple-50 text-purple-600 border-purple-100">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-800 mt-3">{total_unused_files}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Unused Files</p>
            <p className="text-[10px] text-slate-400 mt-1">Never downloaded</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between text-left">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-1 font-sans">Health Score by Plan</h3>
            <p className="text-xs text-slate-400 mb-4 font-sans">Average storage quality score per tier</p>
            <div className="space-y-4">
              {['Free', 'Pro', 'Enterprise'].map(plan => {
                const planScore = avg_health_by_plan[plan] !== undefined ? avg_health_by_plan[plan] : 100;
                const planColor = planScore >= 75 ? "bg-emerald-500" : planScore >= 40 ? "bg-amber-500" : "bg-red-500";
                const planText = planScore >= 75 ? "text-emerald-600" : planScore >= 40 ? "text-amber-600" : "text-red-600";
                return (
                  <div key={plan} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <PlanBadge plan={plan} />
                      </span>
                      <span className={planText}>{planScore} / 100</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className={`h-2 rounded-full ${planColor} transition-all duration-700`} style={{ width: `${planScore}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-[10px] leading-relaxed text-slate-400">
              * Health scores decrease as users consume a higher percentage of their plan quota, upload more duplicate files, or leave files unused for long periods.
            </p>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-left">
          <h3 className="text-sm font-bold text-slate-800 mb-4 font-sans">Platform Storage Distribution</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
              {chartData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-xs text-slate-400">No files uploaded yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <RechartsPie>
                    <Pie data={chartData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3}>
                      {chartData.map(entry => (
                        <Cell key={entry.name} fill={chartColors[entry.name] || "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={v => formatBytes(v)} contentStyle={{ borderRadius: 8 }} />
                  </RechartsPie>
                </ResponsiveContainer>
              )}
            </div>

            <div className="space-y-3.5 text-slate-800">
              {['Images', 'Videos', 'Documents', 'Archives', 'Other'].map(type => {
                const bytes = file_type_distribution[type] || 0;
                const pct = totalBytes > 0 ? (bytes / totalBytes * 100) : 0;
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ background: chartColors[type] || "#94a3b8" }} />
                        {type}
                      </span>
                      <span className="font-bold text-slate-700">{formatBytes(bytes)} <span className="text-slate-400 font-normal">({pct.toFixed(1)}%)</span></span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: chartColors[type] || "#94a3b8" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Largest Users storage breakdown */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-left">
        <h3 className="text-sm font-bold text-slate-800 mb-1 font-sans">Largest Users Storage Breakdown</h3>
        <p className="text-xs text-slate-400 mb-4 font-sans">Top 10 users sorted by consumed object storage size and individual health score.</p>
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">User</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">Plan</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">Storage Used</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">Health Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {largest_users && largest_users.length > 0 ? (
                largest_users.map(u => {
                  const healthColor = u.health_score >= 75 ? "text-emerald-600 bg-emerald-50 border-emerald-100"
                                    : u.health_score >= 40 ? "text-amber-600 bg-amber-50 border-amber-100"
                                    : "text-red-655 bg-red-50 border-red-100";
                  return (
                    <tr key={u.id} className="bg-white hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{u.name}</div>
                        <div className="text-xs text-slate-400 font-sans">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <PlanBadge plan={u.plan} />
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 text-xs font-bold">{formatBytes(u.storage_used)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold border ${healthColor}`}>
                          {u.health_score} / 100
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" className="text-center py-6 text-slate-400 font-sans">No user storage metadata found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-left">
        <h3 className="text-sm font-bold text-slate-800 mb-4 font-sans">System Optimization Recommendations</h3>
        {insights.length === 0 ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 py-10 text-center text-emerald-800 animate-fade-in">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
            <p className="text-sm font-bold">Platform storage is fully optimized!</p>
            <p className="text-xs text-emerald-600 mt-0.5">No immediate clean-up recommendations required.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map(item => (
              <div key={item.id} className={`rounded-xl border p-4 flex gap-4 items-start ${item.bg}`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 shadow-sm">
                  {item.icon}
                </div>
                <div>
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${item.text}`}>{item.title}</h4>
                  <p className="text-xs mt-1 text-slate-600 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminActionConfirmModal({ action, onConfirm, onCancel, actionInProgress }) {
  if (!action) return null;
  const { type, user, data } = action;

  let title = '';
  let description = '';
  let confirmText = '';
  let confirmColor = 'bg-indigo-600 hover:bg-indigo-750 focus:ring-indigo-100';

  if (type === 'suspend') {
    title = 'Suspend User Account';
    description = `Are you sure you want to suspend the user account for ${user.email}? They will no longer be able to log in to the system.`;
    confirmText = 'Suspend Account';
    confirmColor = 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-100';
  } else if (type === 'reactivate') {
    title = 'Reactivate User Account';
    description = `Are you sure you want to reactivate the user account for ${user.email}? They will regain full access to their dashboard and files.`;
    confirmText = 'Reactivate Account';
    confirmColor = 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-100';
  } else if (type === 'plan') {
    title = `Change Plan to ${data}`;
    description = `Are you sure you want to override the subscription plan for ${user.email} to ${data}? This will affect their storage limit and billing charges.`;
    confirmText = `Change to ${data}`;
  } else if (type === 'reset_password') {
    title = 'Reset User Password';
    description = `Are you sure you want to generate a new temporary password for ${user.email}? Their current password will be immediately invalidated.`;
    confirmText = 'Reset Password';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-left">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-4">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={actionInProgress}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={actionInProgress}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-all focus:ring-2 focus:ring-offset-2 disabled:opacity-50 cursor-pointer ${confirmColor}`}
          >
            {actionInProgress ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function TempPasswordModal({ result, onClose }) {
  if (!result) return null;
  const { user, password } = result;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-left">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 mb-4">
          <CheckCircle className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800">Password Reset Complete</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          A new temporary password has been successfully generated for <strong className="text-slate-700">{user.email}</strong>:
        </p>
        
        <div className="mt-4 p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between font-mono text-base font-bold text-slate-800 select-all">
          <span>{password}</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(password);
              alert("Password copied to clipboard!");
            }}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer border-none bg-transparent"
          >
            Copy
          </button>
        </div>
        
        <p className="mt-3 text-xs text-amber-600 font-medium">
          * Please share this temporary password with the user. They should change it immediately after logging in.
        </p>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 text-sm font-semibold shadow-sm cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

