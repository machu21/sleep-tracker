'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────────────────
interface SleepLog {
  id: string;
  created_at: string;
  sleep_time: string;
  wake_time: string;
  duration_hours: string;
  status?: string;
}

// ── Ring progress indicator ──────────────────────────────────────────────────
function RingCard({
  label, value, unit, progress, color, pulse
}: {
  label: string; value: string; unit?: string;
  progress?: number; color: string; pulse?: boolean;
}) {
  const r = 36, circ = 2 * Math.PI * r;
  const offset = circ - (progress ?? 0) * circ;
  return (
    <div style={{
      background: '#111827',
      border: '1px solid #1E2A45',
      borderRadius: 20,
      padding: '40px 32px',
      minHeight: 260,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
      minWidth: 0,
    }}>
      {progress !== undefined ? (
        <div style={{ position: 'relative', width: 88, height: 88 }}>
          <svg width="88" height="88" style={{ position: 'absolute', top: 0, left: 0 }}>
            <circle cx="44" cy="44" r={r} fill="none" stroke="#1E2A45" strokeWidth="5" />
            <circle
              cx="44" cy="44" r={r} fill="none"
              stroke={color} strokeWidth="5"
              strokeDasharray={circ} strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 44 44)"
              style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 6px ${color}66)` }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ color: '#F9FAFB', fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</span>
            {unit && <span style={{ color: '#6B7280', fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>{unit}</span>}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {pulse && (
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: color,
                boxShadow: `0 0 0 0 ${color}66`,
                animation: 'pulse-ring 2s ease-out infinite',
                display: 'inline-block'
              }} />
            </span>
          )}
          <span style={{ color, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{value}</span>
        </div>
      )}
      <span style={{ color: '#6B7280', fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center' }}>{label}</span>
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1E2A45', border: '1px solid #2D3F5E',
      borderRadius: 10, padding: '10px 14px',
    }}>
      <p style={{ color: '#6B7280', fontSize: 11, marginBottom: 4 }}>
        {new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </p>
      <p style={{ color: '#F9FAFB', fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>
        {payload[0].value} <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 400 }}>hrs</span>
      </p>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function statusMeta(status: string) {
  const s = status.toUpperCase();
  if (s === 'SLEEPING') return { color: '#818CF8', bg: '#1E1B4B', label: 'Sleeping' };
  if (s === 'AWAKE')    return { color: '#34D399', bg: '#064E3B', label: 'Awake' };
  if (s === 'EMPTY')    return { color: '#F59E0B', bg: '#451A03', label: 'Bed empty' };
  return                       { color: '#6B7280', bg: '#1F2937', label: status };
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [liveStatus, setLiveStatus] = useState<string>('—');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ sleep_time: '', wake_time: '' });
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('sleep_logs')
        .select('*')
        .order('created_at', { ascending: true });
      if (data) setLogs(data);
    };
    fetchData();

    const channel = supabase
      .channel('realtime-sleep')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sleep_logs' },
        (payload) => {
          setLogs((prev) => [...prev, payload.new as SleepLog]);
          setLiveStatus(payload.new.status ?? '—');
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSubmit = async () => {
    if (!formData.sleep_time || !formData.wake_time) return;
    setIsLoading(true);
    const sleepDate = new Date(formData.sleep_time);
    const wakeDate  = new Date(formData.wake_time);
    const durationInHours = ((wakeDate.getTime() - sleepDate.getTime()) / 3_600_000).toFixed(1);
    const { error } = await supabase.from('sleep_logs').insert([{
      sleep_time: sleepDate.toISOString(),
      wake_time:  wakeDate.toISOString(),
      duration_hours: durationInHours,
      created_at: sleepDate.toISOString(),
    }]);
    if (error) { alert('Failed to save: ' + error.message); }
    else { setIsModalOpen(false); setFormData({ sleep_time: '', wake_time: '' }); }
    setIsLoading(false);
  };

  const avgDuration = logs.length > 0
    ? (logs.reduce((acc, l) => acc + (parseFloat(l.duration_hours) || 0), 0) / logs.length)
    : 0;

  const lastDuration = logs.length > 0
    ? parseFloat(logs[logs.length - 1].duration_hours) || 0
    : 0;

  const goalHours = 8;
  const { color: statusColor, bg: statusBg, label: statusLabel } = statusMeta(liveStatus);

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0A0E1A; color: #F9FAFB; font-family: 'Inter', system-ui, sans-serif; }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(99,102,241,0.5); }
          70%  { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
          100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
        }
        @keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .fade-in { animation: fade-in 0.4s ease both; }
        input[type="datetime-local"] { color-scheme: dark; }
        ::-webkit-scrollbar { width: 4px; } 
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1E2A45; border-radius: 4px; }
        .log-row:hover { background: #111827; }
        .nav-btn:hover { background: #1E2A45; }
        .cta:hover { background: #2563EB; }
        @media (max-width: 640px) {
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .stats-grid > *:last-child { grid-column: 1 / -1; }
          .header-row { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
          .table-header, .log-row { grid-template-columns: 1fr 1fr 1fr !important; }
          .table-header > *:nth-child(3),
          .log-row > *:nth-child(3) { display: none; }
        }
      `}</style>

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(10,14,26,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #1E2A45',
        padding: '0 clamp(16px, 4vw, 40px)',
      }}>
        <div style={{ width: '100%', maxWidth: 1700, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
            </svg>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: '#F9FAFB' }}>Sleep Tracker</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Live status pill */}
            <div style={{
              background: statusBg, color: statusColor,
              padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 5, border: `1px solid ${statusColor}33`
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: statusColor,
                animation: liveStatus !== '—' ? 'pulse-ring 2s infinite' : 'none'
              }} />
              {statusLabel}
            </div>
            <button className="cta" onClick={() => setIsModalOpen(true)} style={{
              background: '#3B82F6', color: '#fff',
              border: 'none', borderRadius: 10, padding: '8px 16px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Log sleep
            </button>
          </div>
        </div>
      </header>

      <main style={{ width: '100%', maxWidth: 1700, margin: '0 auto', padding: 'clamp(24px, 4vw, 48px) clamp(16px, 4vw, 40px)' }}>

        {/* ── Hero title ──────────────────────────────────────────────────── */}
        <div className="fade-in" style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, letterSpacing: '-0.03em', color: '#F9FAFB' }}>
            Good night,{' '}
            <span style={{ color: '#818CF8' }}>sleep well.</span>
          </h1>
          <p style={{ color: '#6B7280', fontSize: 14, marginTop: 6 }}>
            {logs.length} sessions tracked · ESP32 connected
          </p>
        </div>

        {/* ── Stat cards ──────────────────────────────────────────────────── */}
        <div className="stats-grid fade-in" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 24, marginBottom: 24,
          animationDelay: '0.05s'
        }}>
          <RingCard
            label="Last night"
            value={lastDuration.toFixed(1)}
            unit="hrs"
            progress={Math.min(lastDuration / goalHours, 1)}
            color={lastDuration >= 7 ? '#10B981' : '#EF4444'}
          />
          <RingCard
            label="7-day avg"
            value={avgDuration.toFixed(1)}
            unit="hrs"
            progress={Math.min(avgDuration / goalHours, 1)}
            color="#3B82F6"
          />
          <RingCard
            label="Live status"
            value={statusLabel}
            color={statusColor}
            pulse={liveStatus !== '—'}
          />
        </div>

        {/* ── Chart ───────────────────────────────────────────────────────── */}
        <div className="fade-in" style={{
          background: '#111827', border: '1px solid #1E2A45',
          borderRadius: 20, padding: '24px 20px 16px',
          marginBottom: 24, animationDelay: '0.1s'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <p style={{ color: '#6B7280', fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Sleep trends</p>
              <p style={{ color: '#F9FAFB', fontSize: 16, fontWeight: 600 }}>Duration over time</p>
            </div>
            <div style={{
              background: '#1E2A45', borderRadius: 8, padding: '4px 10px',
              fontSize: 11, color: '#6B7280', fontWeight: 500
            }}>Goal: 8 hrs</div>
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={logs} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2A45" vertical={false} />
                <XAxis
                  dataKey="created_at"
                  tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  tick={{ fill: '#6B7280', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  domain={[0, 10]} tickCount={5}
                  tick={{ fill: '#6B7280', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3B82F640' }} />
                <Area
                  type="monotone" dataKey="duration_hours"
                  stroke="#3B82F6" strokeWidth={2.5}
                  fill="url(#sleepGrad)" dot={false}
                  activeDot={{ r: 5, fill: '#3B82F6', stroke: '#0A0E1A', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Log table ───────────────────────────────────────────────────── */}
        <div className="fade-in" style={{
          background: '#111827', border: '1px solid #1E2A45',
          borderRadius: 20, overflow: 'hidden', animationDelay: '0.15s'
        }} ref={tableRef}>
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #1E2A45' }}>
            <p style={{ color: '#6B7280', fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>History</p>
            <p style={{ color: '#F9FAFB', fontSize: 16, fontWeight: 600 }}>All sessions</p>
          </div>

          {/* Header */}
          <div className="table-header" style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
            padding: '10px 24px', borderBottom: '1px solid #1E2A45',
          }}>
            {['Date', 'Bedtime', 'Woke up', 'Duration'].map(h => (
              <span key={h} style={{ color: '#4B5563', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          {logs.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ color: '#4B5563', fontSize: 14 }}>No sessions yet.</p>
              <p style={{ color: '#374151', fontSize: 13, marginTop: 4 }}>Log your first sleep session above.</p>
            </div>
          ) : (
            [...logs].reverse().map((log, i) => {
              const dur = parseFloat(log.duration_hours) || 0;
              const durColor = dur >= 7 ? '#10B981' : dur >= 5 ? '#F59E0B' : '#EF4444';
              const barW = Math.min((dur / 10) * 100, 100);
              return (
                <div key={log.id} className="log-row" style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
                  padding: '14px 24px',
                  borderBottom: i < logs.length - 1 ? '1px solid #1E2A4520' : 'none',
                  transition: 'background 0.15s', cursor: 'default',
                  animationDelay: `${0.15 + i * 0.03}s`
                }}>
                  <span style={{ color: '#D1D5DB', fontSize: 13, fontWeight: 500 }}>
                    {new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span style={{ color: '#9CA3AF', fontSize: 13 }}>
                    {log.sleep_time ? new Date(log.sleep_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                  <span style={{ color: '#9CA3AF', fontSize: 13 }}>
                    {log.wake_time ? new Date(log.wake_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={{ color: durColor, fontSize: 13, fontWeight: 600 }}>{dur.toFixed(1)} hrs</span>
                    <div style={{ height: 3, background: '#1E2A45', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barW}%`, background: durColor, borderRadius: 2, opacity: 0.7 }} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* ── Modal ───────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div
          onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(6px)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16,
          }}
        >
          <div className="fade-in" style={{
            background: '#111827', border: '1px solid #1E2A45',
            borderRadius: 24, width: '100%', maxWidth: 400,
            padding: 32, boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <div>
                <p style={{ color: '#6B7280', fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>New entry</p>
                <h2 style={{ color: '#F9FAFB', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Log sleep</h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: '#1E2A45', border: 'none', color: '#9CA3AF', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >×</button>
            </div>

            {[
              { key: 'sleep_time', label: 'Bedtime' },
              { key: 'wake_time',  label: 'Wake-up time' }
            ].map(({ key, label }) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: '#6B7280', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  {label}
                </label>
                <input
                  type="datetime-local"
                  value={formData[key as keyof typeof formData]}
                  onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                  style={{
                    width: '100%', background: '#0A0E1A', border: '1px solid #1E2A45',
                    borderRadius: 12, padding: '12px 14px',
                    color: '#F9FAFB', fontSize: 14, outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            ))}

            {/* Duration preview */}
            {formData.sleep_time && formData.wake_time && (() => {
              const dur = ((new Date(formData.wake_time).getTime() - new Date(formData.sleep_time).getTime()) / 3_600_000);
              if (dur <= 0) return null;
              const color = dur >= 7 ? '#10B981' : dur >= 5 ? '#F59E0B' : '#EF4444';
              return (
                <div style={{ background: '#0A0E1A', border: `1px solid ${color}33`, borderRadius: 12, padding: '10px 14px', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#6B7280', fontSize: 12 }}>Duration</span>
                  <span style={{ color, fontSize: 14, fontWeight: 700 }}>{dur.toFixed(1)} hrs</span>
                </div>
              );
            })()}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ flex: 1, background: '#1E2A45', border: 'none', color: '#9CA3AF', borderRadius: 12, padding: '12px 0', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
              >Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={isLoading || !formData.sleep_time || !formData.wake_time}
                style={{
                  flex: 1, background: '#3B82F6', border: 'none', color: '#fff',
                  borderRadius: 12, padding: '12px 0', fontWeight: 600, fontSize: 14,
                  cursor: isLoading ? 'wait' : 'pointer', opacity: isLoading ? 0.7 : 1,
                  fontFamily: 'inherit', transition: 'opacity 0.15s'
                }}
              >{isLoading ? 'Saving…' : 'Save entry'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}