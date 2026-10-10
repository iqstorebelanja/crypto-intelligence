import React, { useCallback, useEffect, useState } from 'react';
import {
  Megaphone,
  Radio,
  Sliders,
  Eye,
  MousePointer,
  RotateCw,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowRight,
  Shield,
  Smartphone,
  Monitor,
  ExternalLink,
  Edit2
} from 'lucide-react';
import {
  AdAnalyticsSummary,
  AdColorTheme,
  AdPlacementConfig,
  AdProviderStatus,
  AdProviderType,
  ExternalAdProviderConfig,
  GlobalAdConfig,
  HouseAd,
  HouseAdAudience
} from '../../types';
import { ResponsiveAdSlot } from '../ads/ResponsiveAdSlot';

interface AdminAdvertisingProps {
  token: string | null;
}

type AdvertisingSubTab =
  | 'provider'
  | 'house_ads'
  | 'rotation'
  | 'placement'
  | 'status'
  | 'analytics';

export const AdminAdvertising: React.FC<AdminAdvertisingProps> = ({ token }) => {
  const [subTab, setSubTab] = useState<AdvertisingSubTab>('house_ads');
  const [config, setConfig] = useState<GlobalAdConfig | null>(null);
  const [creatives, setCreatives] = useState<HouseAd[]>([]);
  const [analytics, setAnalytics] = useState<AdAnalyticsSummary | null>(null);
  const [providerStatus, setProviderStatus] = useState<AdProviderStatus>('NOT_CONFIGURED');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal / Form state for Creating/Editing House Ad
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingAd, setEditingAd] = useState<HouseAd | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    targetUrl: '',
    ctaText: 'Learn More',
    badge: 'PROMOTION',
    colorTheme: 'cyan' as AdColorTheme,
    targetAudience: 'ALL' as HouseAdAudience,
    priority: 8,
    active: true,
    rotationEnabled: true,
    exchange: 'ALL' as const
  });

  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Load Admin Advertising Data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/advertising', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setCreatives(data.creatives || []);
        setAnalytics(data.analytics || null);
        setProviderStatus(data.providerStatus || 'NOT_CONFIGURED');
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to load advertising management data.' });
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save Config Changes
  const handleSaveConfig = async (updatedConfig: Partial<GlobalAdConfig>) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/advertising/config', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(updatedConfig)
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setStatusMessage({ type: 'success', text: 'Advertising settings saved successfully.' });
        setTimeout(() => setStatusMessage(null), 3500);
      } else {
        const err = await res.json();
        setStatusMessage({ type: 'error', text: err.error || 'Failed to save configuration.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network error saving configuration.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Active State of House Ad
  const handleToggleActive = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/advertising/creatives/${id}/toggle`, {
        method: 'POST',
        headers: authHeaders
      });
      if (res.ok) {
        const updated = await res.json();
        setCreatives(prev => prev.map(c => (c.id === id ? updated : c)));
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to toggle creative status.' });
    }
  };

  // Delete House Ad
  const handleDeleteAd = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this promotional creative?')) return;
    try {
      const res = await fetch(`/api/admin/advertising/creatives/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      if (res.ok) {
        setCreatives(prev => prev.filter(c => c.id !== id));
        setStatusMessage({ type: 'success', text: 'Creative deleted successfully.' });
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to delete creative.' });
    }
  };

  // Create or Update House Ad
  const handleSaveCreative = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.targetUrl.trim()) {
      alert('Title and Target URL are required.');
      return;
    }

    try {
      const url = editingAd
        ? `/api/admin/advertising/creatives/${editingAd.id}`
        : '/api/admin/advertising/creatives';
      const method = editingAd ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        const saved = await res.json();
        if (editingAd) {
          setCreatives(prev => prev.map(c => (c.id === saved.id ? saved : c)));
          setStatusMessage({ type: 'success', text: 'Creative updated successfully.' });
        } else {
          setCreatives(prev => [saved, ...prev]);
          setStatusMessage({ type: 'success', text: 'Creative created successfully.' });
        }
        setIsModalOpen(false);
        setEditingAd(null);
        setTimeout(() => setStatusMessage(null), 3000);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save creative.');
      }
    } catch {
      alert('Network error saving creative.');
    }
  };

  const openCreateModal = () => {
    setEditingAd(null);
    setFormData({
      title: '',
      description: '',
      targetUrl: '',
      ctaText: 'Learn More',
      badge: 'PROMOTION',
      colorTheme: 'cyan',
      targetAudience: 'ALL',
      priority: 8,
      active: true,
      rotationEnabled: true,
      exchange: 'ALL'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (ad: HouseAd) => {
    setEditingAd(ad);
    setFormData({
      title: ad.title,
      description: ad.description,
      targetUrl: ad.targetUrl,
      ctaText: ad.ctaText,
      badge: ad.badge || 'PROMOTION',
      colorTheme: ad.colorTheme || 'cyan',
      targetAudience: ad.targetAudience,
      priority: ad.priority,
      active: ad.active,
      rotationEnabled: ad.rotationEnabled,
      exchange: ad.exchange as any
    });
    setIsModalOpen(true);
  };

  // Reset Analytics
  const handleResetAnalytics = async () => {
    if (!window.confirm('Reset all advertising impression and click counters?')) return;
    try {
      const res = await fetch('/api/admin/advertising/reset-analytics', {
        method: 'POST',
        headers: authHeaders
      });
      if (res.ok) {
        setAnalytics({
          totalImpressions: 0,
          totalClicks: 0,
          overallCtr: 0,
          creativeMetrics: [],
          recentEvents: []
        });
        setStatusMessage({ type: 'success', text: 'Analytics counters reset successfully.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Failed to reset analytics.' });
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-[#0a1120] border border-[#17253d] rounded-2xl shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                GLOBAL FOOTER ADVERTISING & ROTATION SYSTEM
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                Phase 13
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Manage non-blocking responsive footer advertising, House Ad rotation, placements, and creative performance.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-xl bg-[#111c30] hover:bg-[#182845] border border-[#1f3456] text-xs text-slate-300 flex items-center space-x-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={openCreateModal}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create House Ad</span>
          </button>
        </div>
      </div>

      {/* Status Alert Notification */}
      {statusMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
              : 'bg-rose-950/80 border-rose-700 text-rose-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* 6 Sub-Tab Navigation */}
      <div className="flex items-center space-x-1 border-b border-[#182338] overflow-x-auto no-scrollbar pb-1 text-xs">
        {[
          { id: 'house_ads', label: 'House Ads', icon: <Megaphone className="w-3.5 h-3.5" /> },
          { id: 'rotation', label: 'Rotation', icon: <RotateCw className="w-3.5 h-3.5" /> },
          { id: 'provider', label: 'Ad Provider', icon: <Radio className="w-3.5 h-3.5" /> },
          { id: 'placement', label: 'Placements', icon: <Layers className="w-3.5 h-3.5" /> },
          { id: 'status', label: 'Status & Safety', icon: <Shield className="w-3.5 h-3.5" /> },
          { id: 'analytics', label: 'Analytics', icon: <Eye className="w-3.5 h-3.5" /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id as AdvertisingSubTab)}
            className={`px-3 py-2 rounded-t-xl flex items-center space-x-1.5 transition-all ${
              subTab === tab.id
                ? 'bg-[#101b2f] text-cyan-400 border-t-2 border-cyan-400 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#0c1322]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ============================================================== */}
      {/* SUB-TAB 1: HOUSE ADS (Internal Promotional Creatives) */}
      {/* ============================================================== */}
      {subTab === 'house_ads' && (
        <div className="space-y-6">
          {/* Live Preview Box */}
          <div className="p-4 bg-[#080d16] border border-[#16233a] rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-slate-300 uppercase tracking-wider">
                Live Responsive Creative Preview
              </span>
              <span className="text-[10px] text-cyan-400">
                Active in rotation: {creatives.filter(c => c.active && c.rotationEnabled).length}
              </span>
            </div>
            {creatives.length > 0 ? (
              <div className="pt-2">
                <ResponsiveAdSlot
                  creative={creatives[0]}
                  totalCreatives={creatives.length}
                  currentIndex={0}
                  allowDismissal={true}
                />
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-3 text-center">
                No creatives currently defined. Click "Create House Ad" to add one.
              </p>
            )}
          </div>

          {/* Creatives Table */}
          <div className="bg-[#0b1220] border border-[#17253d] rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#17253d] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">House Promotional Creatives</h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  Internal announcements, feature discovery banners, and PRO membership prompts.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Total: <strong className="text-white">{creatives.length}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#080d16] text-slate-400 uppercase text-[10px] border-b border-[#17253d]">
                  <tr>
                    <th className="py-3 px-4">Title & Copy</th>
                    <th className="py-3 px-3">Audience</th>
                    <th className="py-3 px-3">Theme</th>
                    <th className="py-3 px-3">Priority</th>
                    <th className="py-3 px-3">CTA / Destination</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#131f33]">
                  {creatives.map(ad => (
                    <tr key={ad.id} className="hover:bg-[#0f192b]/50 transition-colors">
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-center space-x-2 mb-0.5">
                          {ad.badge && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                              {ad.badge}
                            </span>
                          )}
                          <span className="font-bold text-slate-200 truncate">{ad.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-sans line-clamp-1 truncate">
                          {ad.description}
                        </p>
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            ad.targetAudience === 'FREE'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : ad.targetAudience === 'PRO'
                              ? 'bg-purple-950 text-purple-300 border border-purple-800'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {ad.targetAudience}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="text-[11px] text-slate-300 capitalize">{ad.colorTheme || 'cyan'}</span>
                      </td>

                      <td className="py-3.5 px-3 font-bold text-slate-300">{ad.priority}/10</td>

                      <td className="py-3.5 px-3 max-w-[140px] truncate">
                        <span className="text-cyan-400 font-bold">{ad.ctaText}</span>
                        <div className="text-[10px] text-slate-500 truncate">{ad.targetUrl}</div>
                      </td>

                      <td className="py-3.5 px-3">
                        <button
                          onClick={() => handleToggleActive(ad.id)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                            ad.active
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                              : 'bg-slate-800 text-slate-500 border-slate-700'
                          }`}
                        >
                          {ad.active ? 'ACTIVE' : 'INACTIVE'}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(ad)}
                          className="p-1 rounded text-slate-400 hover:text-amber-400 transition-colors"
                          title="Edit Creative"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAd(ad.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors"
                          title="Delete Creative"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 2: ROTATION SETTINGS */}
      {/* ============================================================== */}
      {subTab === 'rotation' && config && (
        <div className="p-6 bg-[#0b1220] border border-[#17253d] rounded-2xl space-y-6 shadow-xl max-w-2xl">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <RotateCw className="w-4 h-4 text-cyan-400" />
              <span>Creative Rotation Architecture</span>
            </h3>
            <p className="text-xs text-slate-400 font-sans mt-1">
              Internal House Ad rotation switches active promotional creatives client-side without reloading pages,
              without invoking AI models, and without reconnecting WebSockets.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            {/* Enable/Disable Rotation */}
            <div className="flex items-center justify-between p-3.5 bg-[#080d16] border border-[#16233a] rounded-xl">
              <div>
                <span className="text-xs font-bold text-white block">Enable House Ad Rotation</span>
                <span className="text-[11px] text-slate-400 font-sans">
                  Automatically cycle through active promotional banners
                </span>
              </div>
              <input
                type="checkbox"
                checked={config.houseAdRotation.enabled}
                onChange={e =>
                  handleSaveConfig({
                    houseAdRotation: {
                      ...config.houseAdRotation,
                      enabled: e.target.checked
                    }
                  })
                }
                className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </div>

            {/* Rotation Interval */}
            <div className="p-4 bg-[#080d16] border border-[#16233a] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Rotation Interval</span>
                  <span className="text-[11px] text-slate-400 font-sans">
                    Default: 15 seconds (Min: {config.houseAdRotation.minIntervalSeconds}s, Max: 120s)
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-base font-bold text-cyan-400">
                    {config.houseAdRotation.intervalSeconds}
                  </span>
                  <span className="text-xs text-slate-500">sec</span>
                </div>
              </div>

              <input
                type="range"
                min={config.houseAdRotation.minIntervalSeconds || 10}
                max={120}
                step={5}
                value={config.houseAdRotation.intervalSeconds}
                onChange={e =>
                  handleSaveConfig({
                    houseAdRotation: {
                      ...config.houseAdRotation,
                      intervalSeconds: parseInt(e.target.value, 10)
                    }
                  })
                }
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            {/* Randomize Sequence */}
            <div className="flex items-center justify-between p-3.5 bg-[#080d16] border border-[#16233a] rounded-xl">
              <div>
                <span className="text-xs font-bold text-white block">Controlled Randomization</span>
                <span className="text-[11px] text-slate-400 font-sans">
                  Prevents repeating the same creative consecutively when multiple are active
                </span>
              </div>
              <input
                type="checkbox"
                checked={config.houseAdRotation.randomizeOrder}
                onChange={e =>
                  handleSaveConfig({
                    houseAdRotation: {
                      ...config.houseAdRotation,
                      randomizeOrder: e.target.checked
                    }
                  })
                }
                className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </div>

            {/* Visibility Aware Pause */}
            <div className="flex items-center justify-between p-3.5 bg-[#080d16] border border-[#16233a] rounded-xl">
              <div>
                <span className="text-xs font-bold text-white block">Visibility-Aware Rotation</span>
                <span className="text-[11px] text-slate-400 font-sans">
                  Pauses rotation timer when browser tab is hidden to save client CPU & battery
                </span>
              </div>
              <input
                type="checkbox"
                checked={config.houseAdRotation.pauseWhenHidden}
                onChange={e =>
                  handleSaveConfig({
                    houseAdRotation: {
                      ...config.houseAdRotation,
                      pauseWhenHidden: e.target.checked
                    }
                  })
                }
                className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 3: AD PROVIDER & EXTERNAL NETWORK */}
      {/* ============================================================== */}
      {subTab === 'provider' && config && (
        <div className="p-6 bg-[#0b1220] border border-[#17253d] rounded-2xl space-y-6 shadow-xl max-w-2xl">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <span>Ad Provider & External Network Configuration</span>
            </h3>
            <p className="text-xs text-slate-400 font-sans mt-1">
              Configure external programmatic advertising providers (e.g. Google Ad Manager) with automated House Ad fallback.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            {/* Master Ad System Switch */}
            <div className="flex items-center justify-between p-3.5 bg-[#080d16] border border-[#16233a] rounded-xl">
              <div>
                <span className="text-xs font-bold text-white block">Global Advertising System</span>
                <span className="text-[11px] text-slate-400 font-sans">
                  Master switch for all footer promotional slots
                </span>
              </div>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={e => handleSaveConfig({ enabled: e.target.checked })}
                className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </div>

            {/* Provider Type Selector */}
            <div className="p-4 bg-[#080d16] border border-[#16233a] rounded-xl space-y-2">
              <label className="text-xs font-bold text-white block">Provider Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'HOUSE_ONLY', label: 'House Ads Only', desc: 'Internal promos only' },
                  { id: 'HYBRID', label: 'Hybrid (Recommended)', desc: 'Network with House Fallback' },
                  { id: 'EXTERNAL_ONLY', label: 'External Only', desc: 'Network only' }
                ].map(mode => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleSaveConfig({ providerType: mode.id as AdProviderType })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      config.providerType === mode.id
                        ? 'bg-cyan-950/60 border-cyan-500/60 text-white font-bold'
                        : 'bg-[#0b1220] border-[#182338] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs">{mode.label}</div>
                    <div className="text-[10px] text-slate-500 mt-1 font-sans">{mode.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* External Network Form */}
            <div className="p-4 bg-[#080d16] border border-[#16233a] rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-slate-300">Google Ad Manager / Network Settings</h4>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Publisher ID / Account</label>
                  <input
                    type="text"
                    value={config.externalProvider.publisherId || ''}
                    onChange={e =>
                      setConfig({
                        ...config,
                        externalProvider: {
                          ...config.externalProvider,
                          publisherId: e.target.value
                        }
                      })
                    }
                    placeholder="e.g. ca-pub-1234567890"
                    className="w-full bg-[#0c1424] border border-[#1c2e4a] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Desktop Slot ID</label>
                    <input
                      type="text"
                      value={config.externalProvider.slotIdDesktop || ''}
                      onChange={e =>
                        setConfig({
                          ...config,
                          externalProvider: {
                            ...config.externalProvider,
                            slotIdDesktop: e.target.value
                          }
                        })
                      }
                      placeholder="slot_footer_desktop"
                      className="w-full bg-[#0c1424] border border-[#1c2e4a] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Mobile Slot ID</label>
                    <input
                      type="text"
                      value={config.externalProvider.slotIdMobile || ''}
                      onChange={e =>
                        setConfig({
                          ...config,
                          externalProvider: {
                            ...config.externalProvider,
                            slotIdMobile: e.target.value
                          }
                        })
                      }
                      placeholder="slot_footer_mobile"
                      className="w-full bg-[#0c1424] border border-[#1c2e4a] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleSaveConfig({
                      externalProvider: config.externalProvider
                    })
                  }
                  disabled={isSaving}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  Save External Settings
                </button>
              </div>
            </div>

            {/* Compliance Note */}
            <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-amber-300 text-[11px] font-sans leading-relaxed">
              <strong>Ad Network Compliance Notice:</strong> External ad provider reload frequency is governed strictly
              by official ad network policy. The 15-second creative rotation applies only to internal House Ads.
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 4: PLACEMENTS & LAYOUT */}
      {/* ============================================================== */}
      {subTab === 'placement' && config && (
        <div className="p-6 bg-[#0b1220] border border-[#17253d] rounded-2xl space-y-6 shadow-xl max-w-2xl">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Global Viewport Placement Controls</span>
            </h3>
            <p className="text-xs text-slate-400 font-sans mt-1">
              Configure where promotional footer slots are permitted across viewports and application routes.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            {/* Desktop Placement */}
            <div className="flex items-center justify-between p-3.5 bg-[#080d16] border border-[#16233a] rounded-xl">
              <div className="flex items-center space-x-3">
                <Monitor className="w-5 h-5 text-cyan-400" />
                <div>
                  <span className="text-xs font-bold text-white block">Desktop Viewport Footer</span>
                  <span className="text-[11px] text-slate-400 font-sans">
                    Positioned at bottom of desktop viewport with reserved layout padding
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.placements.desktopFooter}
                onChange={e =>
                  handleSaveConfig({
                    placements: {
                      ...config.placements,
                      desktopFooter: e.target.checked
                    }
                  })
                }
                className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </div>

            {/* Mobile Placement */}
            <div className="flex items-center justify-between p-3.5 bg-[#080d16] border border-[#16233a] rounded-xl">
              <div className="flex items-center space-x-3">
                <Smartphone className="w-5 h-5 text-cyan-400" />
                <div>
                  <span className="text-xs font-bold text-white block">Mobile Viewport Footer</span>
                  <span className="text-[11px] text-slate-400 font-sans">
                    Positioned strictly ABOVE mobile bottom navigation & safe area
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.placements.mobileFooter}
                onChange={e =>
                  handleSaveConfig({
                    placements: {
                      ...config.placements,
                      mobileFooter: e.target.checked
                    }
                  })
                }
                className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </div>

            {/* Community Route Safety */}
            <div className="flex items-center justify-between p-3.5 bg-[#080d16] border border-[#16233a] rounded-xl">
              <div>
                <span className="text-xs font-bold text-white block">Community Route Footer Ad</span>
                <span className="text-[11px] text-slate-400 font-sans">
                  Default OFF to ensure message composer and sticker picker are never obstructed
                </span>
              </div>
              <input
                type="checkbox"
                checked={config.placements.communityEnabled}
                onChange={e =>
                  handleSaveConfig({
                    placements: {
                      ...config.placements,
                      communityEnabled: e.target.checked
                    }
                  })
                }
                className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </div>

            {/* AI Trader Protection Notice */}
            <div className="p-3.5 bg-[#080d16] border border-[#16233a] rounded-xl space-y-1">
              <span className="text-xs font-bold text-white block">AI Trader Isolation Rule</span>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                Advertisements are permanently prohibited from being injected into AI conversation bubbles.
                The existing 15-second rewarded ad access gate for FREE users remains separate and unaffected.
              </p>
            </div>

            {/* Allow Dismissal */}
            <div className="flex items-center justify-between p-3.5 bg-[#080d16] border border-[#16233a] rounded-xl">
              <div>
                <span className="text-xs font-bold text-white block">Allow User Dismissal / Snooze</span>
                <span className="text-[11px] text-slate-400 font-sans">
                  Snooze promotion for {config.dismissSnoozeMinutes} minutes when user clicks ✕
                </span>
              </div>
              <input
                type="checkbox"
                checked={config.allowDismissal}
                onChange={e => handleSaveConfig({ allowDismissal: e.target.checked })}
                className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 5: STATUS & SYSTEM HEALTH */}
      {/* ============================================================== */}
      {subTab === 'status' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-[#0b1220] border border-[#17253d] rounded-2xl space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Monetization Layer Health</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-[#080d16] border border-[#16233a] rounded-xl">
                <span className="text-slate-400">Ad System Master State</span>
                <span className="text-emerald-400 font-bold">OPERATIONAL</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-[#080d16] border border-[#16233a] rounded-xl">
                <span className="text-slate-400">External Provider Engine</span>
                <span className="text-amber-400 font-bold">{providerStatus}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-[#080d16] border border-[#16233a] rounded-xl">
                <span className="text-slate-400">Active House Creatives</span>
                <span className="text-cyan-400 font-bold">
                  {creatives.filter(c => c.active).length} of {creatives.length}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-[#080d16] border border-[#16233a] rounded-xl">
                <span className="text-slate-400">Rotation Cycle Timer</span>
                <span className="text-white font-bold">{config?.houseAdRotation.intervalSeconds || 15}s</span>
              </div>
            </div>
          </div>

          <div className="p-5 bg-[#0b1220] border border-[#17253d] rounded-2xl space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-cyan-400" />
              <span>Architectural Isolation Verification</span>
            </h3>

            <div className="space-y-2 text-xs font-sans">
              <div className="p-2.5 bg-[#080d16] border border-[#16233a] rounded-xl space-y-0.5">
                <span className="text-xs font-bold text-slate-200 font-mono">Market Data Independence</span>
                <p className="text-[11px] text-slate-400">
                  Ad rotation triggers 0 market API requests and causes 0 WebSocket churn.
                </p>
              </div>

              <div className="p-2.5 bg-[#080d16] border border-[#16233a] rounded-xl space-y-0.5">
                <span className="text-xs font-bold text-slate-200 font-mono">Zero AI Token Expenditure</span>
                <p className="text-[11px] text-slate-400">
                  House ad rotation is entirely client-side and never consumes Gemini / LLM quotas.
                </p>
              </div>

              <div className="p-2.5 bg-[#080d16] border border-[#16233a] rounded-xl space-y-0.5">
                <span className="text-xs font-bold text-slate-200 font-mono">Audience Entitlement Safety</span>
                <p className="text-[11px] text-slate-400">
                  Both FREE and PRO view the lightweight footer banner, while PRO users retain ad-free AI Trader.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 6: ANALYTICS & TELEMETRY */}
      {/* ============================================================== */}
      {subTab === 'analytics' && analytics && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-[#0b1220] border border-[#17253d] rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Total Impressions</span>
                <Eye className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {analytics.totalImpressions.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500 font-sans">Non-billable verified viewports</span>
            </div>

            <div className="p-4 bg-[#0b1220] border border-[#17253d] rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Total Clicks</span>
                <MousePointer className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {analytics.totalClicks.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500 font-sans">Organic intentional user interactions</span>
            </div>

            <div className="p-4 bg-[#0b1220] border border-[#17253d] rounded-2xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Overall CTR</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400">
                {analytics.overallCtr.toFixed(2)}%
              </div>
              <span className="text-[10px] text-slate-500 font-sans">Click-through conversion efficiency</span>
            </div>
          </div>

          {/* Breakdown Table by Creative */}
          <div className="bg-[#0b1220] border border-[#17253d] rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#17253d] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Creative Performance Breakdown</h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  Detailed conversion telemetry per promotional banner.
                </p>
              </div>
              <button
                onClick={handleResetAnalytics}
                className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800 text-rose-300 text-xs font-bold transition-colors"
              >
                Reset Counters
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#080d16] text-slate-400 uppercase text-[10px] border-b border-[#17253d]">
                  <tr>
                    <th className="py-3 px-4">Creative Title</th>
                    <th className="py-3 px-4">Impressions</th>
                    <th className="py-3 px-4">Clicks</th>
                    <th className="py-3 px-4">CTR %</th>
                    <th className="py-3 px-4">Conversion Ratio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#131f33]">
                  {analytics.creativeMetrics.map(item => (
                    <tr key={item.creativeId} className="hover:bg-[#0f192b]/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-200">{item.title}</td>
                      <td className="py-3 px-4">{item.impressions.toLocaleString()}</td>
                      <td className="py-3 px-4 text-emerald-400 font-bold">{item.clicks}</td>
                      <td className="py-3 px-4 text-amber-400 font-bold">{item.ctr.toFixed(2)}%</td>
                      <td className="py-3 px-4">
                        <div className="w-32 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-cyan-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, item.ctr * 10)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREATE / EDIT PROMOTIONAL CREATIVE */}
      {/* ============================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1220] border border-[#1d2d47] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#17253d] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Megaphone className="w-4 h-4 text-cyan-400" />
                <span>{editingAd ? 'Edit Promotional Creative' : 'Create New House Ad'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCreative} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Creative Title *</label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Upgrade to PRO Membership"
                  className="w-full bg-[#080d16] border border-[#182338] rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Description / Copy</label>
                <textarea
                  rows={2}
                  maxLength={180}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Unlock unlimited AI consultations, private alpha channels & breakout alerts."
                  className="w-full bg-[#080d16] border border-[#182338] rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">Target URL *</label>
                  <input
                    type="text"
                    required
                    value={formData.targetUrl}
                    onChange={e => setFormData({ ...formData, targetUrl: e.target.value })}
                    placeholder="/signals or https://..."
                    className="w-full bg-[#080d16] border border-[#182338] rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">CTA Button Text</label>
                  <input
                    type="text"
                    maxLength={30}
                    value={formData.ctaText}
                    onChange={e => setFormData({ ...formData, ctaText: e.target.value })}
                    placeholder="e.g. Explore PRO"
                    className="w-full bg-[#080d16] border border-[#182338] rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">Target Audience</label>
                  <select
                    value={formData.targetAudience}
                    onChange={e =>
                      setFormData({ ...formData, targetAudience: e.target.value as HouseAdAudience })
                    }
                    className="w-full bg-[#080d16] border border-[#182338] rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="ALL">ALL Users</option>
                    <option value="FREE">FREE Only</option>
                    <option value="PRO">PRO Only</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Color Theme</label>
                  <select
                    value={formData.colorTheme}
                    onChange={e =>
                      setFormData({ ...formData, colorTheme: e.target.value as AdColorTheme })
                    }
                    className="w-full bg-[#080d16] border border-[#182338] rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="cyan">Cyan</option>
                    <option value="amber">Amber</option>
                    <option value="emerald">Emerald</option>
                    <option value="purple">Purple</option>
                    <option value="blue">Blue</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Priority (1-10)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.priority}
                    onChange={e =>
                      setFormData({ ...formData, priority: parseInt(e.target.value, 10) || 5 })
                    }
                    className="w-full bg-[#080d16] border border-[#182338] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Badge Text (Optional)</label>
                <input
                  type="text"
                  maxLength={20}
                  value={formData.badge}
                  onChange={e => setFormData({ ...formData, badge: e.target.value.toUpperCase() })}
                  placeholder="e.g. PRO ACCESS, NEW FEATURE"
                  className="w-full bg-[#080d16] border border-[#182338] rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="flex items-center space-x-4 pt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={e => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700"
                  />
                  <span className="text-slate-300">Active</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.rotationEnabled}
                    onChange={e => setFormData({ ...formData, rotationEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700"
                  />
                  <span className="text-slate-300">Include in Rotation</span>
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-[#17253d]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all shadow-md active:scale-95"
                >
                  {editingAd ? 'Save Changes' : 'Create Creative'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
