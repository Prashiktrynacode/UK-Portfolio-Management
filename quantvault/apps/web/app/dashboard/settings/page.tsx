'use client';

import { useState } from 'react';
import { Settings, User, Bell, Shield, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'profile', name: 'Profile', icon: User },
  { id: 'preferences', name: 'Preferences', icon: Palette },
  { id: 'notifications', name: 'Notifications', icon: Bell },
  { id: 'security', name: 'Security', icon: Shield },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Tabs */}
        <div className="md:w-48 flex md:flex-col gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <tab.icon className="size-4" />
              {tab.name}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-card border border-border rounded-xl p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Profile Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Display Name</label>
                  <input
                    type="text"
                    placeholder="Your name"
                    className="w-full max-w-md px-4 py-2.5 bg-input border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    disabled
                    className="w-full max-w-md px-4 py-2.5 bg-muted border border-border rounded-lg text-muted-foreground cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Display Preferences</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Currency</label>
                  <select className="w-full max-w-md px-4 py-2.5 bg-input border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none">
                    <option value="USD">USD - US Dollar</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="EUR">EUR - Euro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Default Benchmark</label>
                  <select className="w-full max-w-md px-4 py-2.5 bg-input border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none">
                    <option value="SPY">S&P 500 (SPY)</option>
                    <option value="QQQ">NASDAQ 100 (QQQ)</option>
                    <option value="VTI">Total Market (VTI)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Notification Settings</h2>
              <div className="space-y-4">
                <label className="flex items-center gap-3">
                  <input type="checkbox" defaultChecked className="rounded border-border" />
                  <span className="text-sm">Email alerts for significant portfolio changes</span>
                </label>
                <label className="flex items-center gap-3">
                  <input type="checkbox" defaultChecked className="rounded border-border" />
                  <span className="text-sm">Weekly portfolio summary digest</span>
                </label>
                <label className="flex items-center gap-3">
                  <input type="checkbox" className="rounded border-border" />
                  <span className="text-sm">Dividend payment notifications</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Security Settings</h2>
              <div className="space-y-4">
                <button className="px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors">
                  Change Password
                </button>
                <div className="pt-4 border-t border-border">
                  <h3 className="text-sm font-medium text-destructive mb-2">Danger Zone</h3>
                  <button className="px-4 py-2.5 bg-destructive/10 text-destructive rounded-lg font-medium hover:bg-destructive/20 transition-colors">
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
